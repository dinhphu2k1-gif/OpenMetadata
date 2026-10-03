/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.dq.DqResultService.RuleState;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * Daily pass rate of a Rule or a CDE over the last 30 or 90 days, computed when read from the
 * native time-series of every testcase that was bound in the period, including retired ones.
 */
public final class DqTrendService {
  public static final int SHORT_PERIOD_DAYS = 30;
  public static final int LONG_PERIOD_DAYS = 90;
  private static final long DAY_MILLIS = 86_400_000L;

  private DqTrendService() {}

  public static Map<String, Object> ruleTrend(String ruleId, int days, String specKey) {
    final RuleState state = DqResultService.load(ruleId);
    final List<BindingRow> bindings =
        state.evaluated().stream()
            .map(item -> item.binding())
            .filter(binding -> specKey == null || binding.specKey().equals(specKey))
            .toList();
    return trend(List.of(state), bindings, normalize(days));
  }

  public static Map<String, Object> cdeTrend(String cdeId, int days) {
    final List<RuleState> states = DqResultService.ruleStatesOfCde(cdeId);
    final List<BindingRow> bindings = new ArrayList<>();
    states.forEach(state -> state.evaluated().forEach(item -> bindings.add(item.binding())));
    return trend(states, bindings, normalize(days));
  }

  private static Map<String, Object> trend(
      List<RuleState> states, List<BindingRow> bindings, int days) {
    final long end = System.currentTimeMillis();
    final long start = end - days * DAY_MILLIS;
    final Map<LocalDate, int[]> byDay = new TreeMap<>();
    final Map<String, RuleState> statesById = new HashMap<>();
    states.forEach(state -> statesById.put(state.row().ruleTermId(), state));
    for (BindingRow binding : bindings) {
      if (binding.testCaseFqn() != null) {
        addBinding(byDay, binding, statesById.get(binding.ruleTermId()), start, end);
      }
    }
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("days", days);
    body.put("points", points(byDay));
    body.put("versions", versions(states, start));
    return body;
  }

  private static void addBinding(
      Map<LocalDate, int[]> byDay, BindingRow binding, RuleState state, long start, long end) {
    final DqTestSpec spec =
        state.context().specs().stream()
            .filter(candidate -> candidate.getKey().equals(binding.specKey()))
            .findFirst()
            .orElse(null);
    final DqThreshold threshold = DqResultService.thresholdOf(spec, state.context());
    final Map<LocalDate, DqOutcome> latestPerDay = new HashMap<>();
    final Map<LocalDate, Long> latestAt = new HashMap<>();
    for (TestCaseResult result :
        DqResultService.resultsRepository()
            .getTestCaseResults(binding.testCaseFqn(), start, end)
            .getData()) {
      final LocalDate day = dayOf(result.getTimestamp());
      if (latestAt.getOrDefault(day, Long.MIN_VALUE) < result.getTimestamp()) {
        latestAt.put(day, result.getTimestamp());
        latestPerDay.put(day, DqOutcome.evaluate(threshold, result));
      }
    }
    latestPerDay.forEach((day, outcome) -> count(byDay, day, outcome));
  }

  private static void count(Map<LocalDate, int[]> byDay, LocalDate day, DqOutcome outcome) {
    if (outcome == DqOutcome.PASSED || outcome == DqOutcome.FAILED) {
      final int[] counts = byDay.computeIfAbsent(day, key -> new int[2]);
      counts[0] += outcome == DqOutcome.PASSED ? 1 : 0;
      counts[1] += 1;
    }
  }

  private static List<Map<String, Object>> points(Map<LocalDate, int[]> byDay) {
    final List<Map<String, Object>> points = new ArrayList<>();
    byDay.forEach(
        (day, counts) -> {
          final Map<String, Object> point = new LinkedHashMap<>();
          point.put("date", day.toString());
          point.put("passed", counts[0]);
          point.put("total", counts[1]);
          point.put("passRate", (double) counts[0] / counts[1]);
          points.add(point);
        });
    return points;
  }

  private static List<Map<String, Object>> versions(List<RuleState> states, long start) {
    final List<Map<String, Object>> versions = new ArrayList<>();
    for (RuleState state : states) {
      for (PublishedSnapshotRecord snapshot :
          Entity.getJdbi()
              .onDemand(GlossaryVersionDAO.class)
              .listPublished(Entity.GLOSSARY_TERM, UUID.fromString(state.row().ruleTermId()))) {
        if (snapshot.publishedAt() >= start) {
          final Map<String, Object> version = new LinkedHashMap<>();
          version.put("ruleCode", state.context().code());
          version.put("businessVersion", snapshot.businessVersion());
          version.put("publishedAt", snapshot.publishedAt());
          versions.add(version);
        }
      }
    }
    return versions;
  }

  private static LocalDate dayOf(long timestamp) {
    return Instant.ofEpochMilli(timestamp)
        .atZone(ZoneId.of(DqSchedule.DEFAULT_TIMEZONE))
        .toLocalDate();
  }

  private static int normalize(int days) {
    return days >= LONG_PERIOD_DAYS ? LONG_PERIOD_DAYS : SHORT_PERIOD_DAYS;
  }
}
