/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.SpecExecRow;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Results of a Rule and of a CDE, read from the native testcase results of the bindings and
 * measured against the threshold of each declaration.
 */
public final class DqResultService {
  public static final int DEFAULT_LIMIT = 25;
  public static final int MAX_LIMIT = 200;
  private static final double STALE_FACTOR = 1.5;
  private static final String STATUS_CACHE_KEY = "statuses";
  private static final int STATUS_CACHE_SECONDS = 30;
  private static final Cache<String, Map<String, String>> STATUS_CACHE =
      Caffeine.newBuilder()
          .maximumSize(1)
          .expireAfterWrite(Duration.ofSeconds(STATUS_CACHE_SECONDS))
          .build();

  private DqResultService() {}

  /** Native result of one binding measured against its threshold. */
  record Evaluated(
      BindingRow binding,
      String specName,
      String ruleCode,
      DqOutcome outcome,
      TestCaseResult result,
      boolean stale) {}

  record RuleState(
      RuleExecRow row,
      DqRuleContext context,
      boolean effective,
      Map<String, SpecExecRow> specRows,
      List<Evaluated> evaluated) {}

  public static Map<String, Object> ruleResults(
      String ruleId, String specKey, Predicate<String> canViewTable, int offset, int limit) {
    final RuleState state = load(ruleId);
    final List<Evaluated> scoped = scope(state.evaluated(), specKey);
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("rule", ruleSummary(state));
    body.put("schedule", DqRuleTestService.schedule(ruleId));
    body.put("status", statusOf(state));
    body.put("summary", summary(live(state.evaluated()), state));
    body.put("specs", specSummaries(state));
    body.put("testCases", page(scoped, canViewTable, offset, limit, body));
    return body;
  }

  public static Map<String, Object> cdeResults(
      String cdeId,
      String ruleFilter,
      String outcomeFilter,
      Predicate<String> canViewTable,
      int offset,
      int limit) {
    final List<RuleState> states = ruleStatesOfCde(cdeId);
    final List<Map<String, Object>> rules = new ArrayList<>();
    final List<Evaluated> all = new ArrayList<>();
    for (RuleState state : states) {
      rules.add(ruleRow(state));
      all.addAll(live(state.evaluated()));
    }
    final List<Evaluated> filtered =
        all.stream()
            .filter(item -> ruleFilter == null || item.binding().ruleTermId().equals(ruleFilter))
            .filter(item -> outcomeFilter == null || item.outcome().name().equals(outcomeFilter))
            .toList();
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("cdeTermId", cdeId);
    body.put("summary", cdeSummary(states, all));
    body.put("dimensions", dimensions(states));
    body.put("rules", rules);
    body.put("testCases", page(filtered, canViewTable, offset, limit, body));
    return body;
  }

  /**
   * Status of every effective Rule, for the list filter. Computed from the native results, so it is
   * kept for a short time to spare the list from reading every testcase on each request.
   */
  public static Map<String, String> ruleStatuses() {
    return STATUS_CACHE.get(
        STATUS_CACHE_KEY,
        key -> {
          final Map<String, String> statuses = new LinkedHashMap<>();
          for (UUID ruleId : DqRuleSource.effectiveRuleIds()) {
            statuses.put(ruleId.toString(), statusOfRule(ruleId.toString()));
          }
          return statuses;
        });
  }

  private static String statusOfRule(String ruleId) {
    String status = DqOutcome.NOT_DECLARED;
    if (dao().findRuleExec(ruleId) != null) {
      status = statusOf(load(ruleId));
    }
    return status;
  }

  // ---- loading and evaluating ---------------------------------------------------------------

  static RuleState load(String ruleId) {
    final RuleExecRow row = dao().findRuleExec(ruleId);
    final DqRuleSource source = DqRuleSource.load(UUID.fromString(ruleId));
    if (row == null || source == null) {
      throw DqTestErrors.notFound(
          DqTestErrors.RUN_NOT_AVAILABLE, "The rule has no applied tests yet");
    }
    final Map<String, SpecExecRow> specRows = new LinkedHashMap<>();
    dao().listSpecs(ruleId).forEach(spec -> specRows.put(spec.specKey(), spec));
    final RuleState partial =
        new RuleState(row, source.context(), source.effective(), specRows, List.of());
    return new RuleState(row, source.context(), source.effective(), specRows, evaluate(partial));
  }

  static List<RuleState> ruleStatesOfCde(String cdeId) {
    final List<RuleState> states = new ArrayList<>();
    for (RuleExecRow row : dao().listRuleExecByCde(cdeId)) {
      states.add(load(row.ruleTermId()));
    }
    return states;
  }

  private static List<Evaluated> evaluate(RuleState state) {
    final Optional<Duration> interval =
        DqSchedule.interval(state.row().scheduleCron(), state.row().scheduleTimezone());
    final Map<String, DqTestSpec> specs = new LinkedHashMap<>();
    state.context().specs().forEach(spec -> specs.put(spec.getKey(), spec));
    final List<Evaluated> evaluated = new ArrayList<>();
    for (BindingRow binding : dao().listBindings(state.row().ruleTermId())) {
      evaluated.add(evaluateBinding(state, binding, specs.get(binding.specKey()), interval));
    }
    evaluated.sort(
        Comparator.comparing((Evaluated item) -> item.binding().specKey())
            .thenComparing(item -> item.binding().columnFqn()));
    return evaluated;
  }

  private static Evaluated evaluateBinding(
      RuleState state, BindingRow binding, DqTestSpec spec, Optional<Duration> interval) {
    TestCaseResult result = null;
    DqOutcome outcome = DqOutcome.NO_RESULT;
    if (DqTestReconciler.ACTIVE.equals(binding.state()) && binding.testCaseFqn() != null) {
      result = resultsRepository().listLastTestCaseResult(binding.testCaseFqn());
      outcome = DqOutcome.evaluate(thresholdOf(spec, state.context()), result);
    }
    final String specName =
        Optional.ofNullable(state.specRows().get(binding.specKey()))
            .map(SpecExecRow::name)
            .orElse(binding.specKey());
    return new Evaluated(
        binding, specName, state.context().code(), outcome, result, isStale(result, interval));
  }

  static DqThreshold thresholdOf(DqTestSpec spec, DqRuleContext rule) {
    final String text =
        spec != null && !nullOrEmpty(spec.getThreshold())
            ? spec.getThreshold()
            : rule.qualityThreshold();
    return DqThreshold.parse(text).orElse(null);
  }

  private static boolean isStale(TestCaseResult result, Optional<Duration> interval) {
    return result != null
        && result.getTimestamp() != null
        && interval.isPresent()
        && System.currentTimeMillis() - result.getTimestamp()
            > interval.get().toMillis() * STALE_FACTOR;
  }

  private static List<Evaluated> live(List<Evaluated> evaluated) {
    return evaluated.stream()
        .filter(item -> DqTestReconciler.ACTIVE.equals(item.binding().state()))
        .toList();
  }

  private static List<Evaluated> scope(List<Evaluated> evaluated, String specKey) {
    return evaluated.stream()
        .filter(item -> !DqTestReconciler.RETIRED.equals(item.binding().state()) || specKey != null)
        .filter(item -> specKey == null || item.binding().specKey().equals(specKey))
        .toList();
  }

  // ---- shaping -----------------------------------------------------------------------------

  private static String statusOf(RuleState state) {
    final List<Evaluated> live = live(state.evaluated());
    return state.context().specs().isEmpty() && state.specRows().isEmpty()
        ? DqOutcome.NOT_DECLARED
        : DqOutcome.aggregate(live.stream().map(Evaluated::outcome).toList()).name();
  }

  private static Map<String, Object> ruleSummary(RuleState state) {
    final Map<String, Object> rule = new LinkedHashMap<>();
    rule.put("id", state.context().ruleId());
    rule.put("code", state.context().code());
    rule.put("fullyQualifiedName", state.context().fullyQualifiedName());
    rule.put("displayName", state.context().displayName());
    rule.put("threshold", state.context().qualityThreshold());
    rule.put("dimension", state.context().dimension());
    rule.put("effective", state.effective());
    rule.put("businessVersion", state.context().businessVersion());
    return rule;
  }

  private static Map<String, Object> summary(List<Evaluated> live, RuleState state) {
    final Map<DqOutcome, Integer> counts = new EnumMap<>(DqOutcome.class);
    live.forEach(item -> counts.merge(item.outcome(), 1, Integer::sum));
    final Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("specs", state.context().specs().size());
    summary.put("applied", live.size());
    summary.put("notApplicable", countState(state, DqTestReconciler.NOT_APPLICABLE));
    summary.put("passed", counts.getOrDefault(DqOutcome.PASSED, 0));
    summary.put("failed", counts.getOrDefault(DqOutcome.FAILED, 0));
    summary.put("aborted", counts.getOrDefault(DqOutcome.ABORTED, 0));
    summary.put("noResult", counts.getOrDefault(DqOutcome.NO_RESULT, 0));
    summary.put("stale", live.stream().filter(Evaluated::stale).count());
    summary.put("lastRunAt", lastRun(live));
    return summary;
  }

  private static long countState(RuleState state, String bindingState) {
    return state.evaluated().stream()
        .filter(item -> bindingState.equals(item.binding().state()))
        .count();
  }

  private static Long lastRun(List<Evaluated> live) {
    return live.stream()
        .map(Evaluated::result)
        .filter(result -> result != null && result.getTimestamp() != null)
        .map(TestCaseResult::getTimestamp)
        .max(Long::compare)
        .orElse(null);
  }

  private static List<Map<String, Object>> specSummaries(RuleState state) {
    final List<Map<String, Object>> specs = new ArrayList<>();
    for (SpecExecRow specRow : state.specRows().values()) {
      final List<Evaluated> items =
          state.evaluated().stream()
              .filter(item -> item.binding().specKey().equals(specRow.specKey()))
              .toList();
      final DqTestSpec spec =
          state.context().specs().stream()
              .filter(candidate -> candidate.getKey().equals(specRow.specKey()))
              .findFirst()
              .orElse(null);
      final Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("key", specRow.specKey());
      entry.put("name", specRow.name());
      entry.put("kind", specRow.kind());
      entry.put("testDefinitionFqn", specRow.testDefinitionFqn());
      entry.put("retired", DqTestReconciler.RETIRED.equals(specRow.state()));
      entry.put("threshold", spec == null ? null : spec.getThreshold());
      entry.put(
          "effectiveThreshold",
          spec == null
              ? state.context().qualityThreshold()
              : Optional.ofNullable(nullOrEmpty(spec.getThreshold()) ? null : spec.getThreshold())
                  .orElse(state.context().qualityThreshold()));
      entry.put(
          "status",
          DqOutcome.aggregate(live(items).stream().map(Evaluated::outcome).toList()).name());
      entry.put("summary", summary(live(items), state));
      specs.add(entry);
    }
    return specs;
  }

  private static List<Map<String, Object>> page(
      List<Evaluated> items,
      Predicate<String> canViewTable,
      int offset,
      int limit,
      Map<String, Object> body) {
    final int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
    final int safeOffset = Math.max(0, offset);
    final List<Evaluated> visible =
        items.stream().filter(item -> canViewTable.test(tableOf(item))).toList();
    body.put("hiddenTestCases", items.size() - visible.size());
    body.put("paging", Map.of("offset", safeOffset, "limit", safeLimit, "total", visible.size()));
    return visible.stream()
        .skip(safeOffset)
        .limit(safeLimit)
        .map(DqResultService::testCaseRow)
        .toList();
  }

  static String tableOf(Evaluated item) {
    return FullyQualifiedName.getParentFQN(item.binding().columnFqn());
  }

  private static Map<String, Object> testCaseRow(Evaluated item) {
    final BindingRow binding = item.binding();
    final String[] parts = FullyQualifiedName.split(binding.columnFqn());
    final TestCaseResult result = item.result();
    final Map<String, Object> row = new LinkedHashMap<>();
    row.put("testCaseId", binding.testCaseId());
    row.put("testCaseFqn", binding.testCaseFqn());
    row.put("ruleId", binding.ruleTermId());
    row.put("ruleCode", item.ruleCode());
    row.put("spec", Map.of("key", binding.specKey(), "name", item.specName()));
    row.put(
        "column",
        Map.of(
            "fqn",
            binding.columnFqn(),
            "table",
            parts.length >= 2 ? parts[parts.length - 2] : "",
            "service",
            parts[0]));
    row.put("state", binding.state());
    row.put("stateReason", binding.stateReason());
    row.put("lastError", binding.lastError());
    row.put("thresholdResult", item.outcome().name());
    row.put(
        "nativeStatus",
        result == null || result.getTestCaseStatus() == null
            ? null
            : result.getTestCaseStatus().value());
    row.put("passedRowsPercentage", result == null ? null : result.getPassedRowsPercentage());
    row.put("failedRows", result == null ? null : result.getFailedRows());
    row.put("timestamp", result == null ? null : result.getTimestamp());
    row.put("stale", item.stale());
    return row;
  }

  private static Map<String, Object> ruleRow(RuleState state) {
    final List<Evaluated> live = live(state.evaluated());
    final Map<String, Object> row = new LinkedHashMap<>();
    row.putAll(ruleSummary(state));
    row.put("status", statusOf(state));
    row.put("cron", state.row().scheduleCron());
    row.put("specs", state.context().specs().size());
    row.put("columns", live.stream().map(item -> item.binding().columnKey()).distinct().count());
    row.put("summary", summary(live, state));
    return row;
  }

  private static Map<String, Object> cdeSummary(List<RuleState> states, List<Evaluated> all) {
    final Map<String, Object> summary = new LinkedHashMap<>();
    final Map<String, Long> byStatus = new LinkedHashMap<>();
    states.forEach(state -> byStatus.merge(statusOf(state), 1L, Long::sum));
    final long passed = all.stream().filter(item -> item.outcome() == DqOutcome.PASSED).count();
    summary.put("rules", states.size());
    summary.put(
        "rulesWithTests",
        states.stream().filter(state -> !live(state.evaluated()).isEmpty()).count());
    summary.put("rulesByStatus", byStatus);
    summary.put("testCases", all.size());
    summary.put("passedTestCases", passed);
    summary.put("passRate", all.isEmpty() ? null : (double) passed / all.size());
    return summary;
  }

  private static List<Map<String, Object>> dimensions(List<RuleState> states) {
    final Map<String, List<RuleState>> byDimension = new LinkedHashMap<>();
    states.forEach(
        state ->
            byDimension
                .computeIfAbsent(
                    String.valueOf(state.context().dimension()), key -> new ArrayList<>())
                .add(state));
    final List<Map<String, Object>> dimensions = new ArrayList<>();
    byDimension.forEach(
        (dimension, group) -> {
          final long passed =
              group.stream()
                  .filter(state -> DqOutcome.PASSED.name().equals(statusOf(state)))
                  .count();
          final Map<String, Object> entry = new LinkedHashMap<>();
          entry.put("dimension", "null".equals(dimension) ? null : dimension);
          entry.put("rules", group.size());
          entry.put("passedRules", passed);
          entry.put("passRate", (double) passed / group.size());
          dimensions.add(entry);
        });
    return dimensions;
  }

  static DqRuleTestDAO dao() {
    return Entity.getJdbi().onDemand(DqRuleTestDAO.class);
  }

  static TestCaseResultRepository resultsRepository() {
    return (TestCaseResultRepository) Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT);
  }
}
