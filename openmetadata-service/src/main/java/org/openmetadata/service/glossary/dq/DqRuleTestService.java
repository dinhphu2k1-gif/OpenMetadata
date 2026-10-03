/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.DqTestSpecs;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Configuration, test definition list, preview, schedule and run of Data Quality Rule tests. */
@Slf4j
public final class DqRuleTestService {
  private DqRuleTestService() {}

  public static Map<String, Object> config() {
    final Map<String, Object> config = new LinkedHashMap<>();
    config.put("defaultTimezone", DqSchedule.DEFAULT_TIMEZONE);
    return config;
  }

  /** Column-level definitions the pipeline can run and a user may pick for a library test. */
  public static List<Map<String, Object>> libraryDefinitions() {
    final TestDefinitionRepository repository =
        (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);
    final List<TestDefinition> all =
        repository.listAll(
            new Fields(repository.getAllowedFields(), "parameterDefinition,supportedDataTypes"),
            new org.openmetadata.service.jdbi3.ListFilter(Include.NON_DELETED));
    return all.stream()
        .filter(DqRuleTestService::isSelectable)
        .sorted(Comparator.comparing(TestDefinition::getName))
        .map(DqRuleTestService::definitionSummary)
        .toList();
  }

  /** Which Columns of the CDE a set of declarations would be applied to, and which do not apply. */
  public static Map<String, Object> preview(String cdeTermId, DqTestSpecs specs) {
    final List<DqTestSpec> items =
        specs == null || specs.getItems() == null ? List.of() : specs.getItems();
    final List<ColumnRow> columns =
        nullOrEmpty(cdeTermId) ? List.of() : dao().listAvailableColumnsByCde(cdeTermId);
    final List<TestDefinition> definitions =
        items.stream().map(DqRuleTestService::previewDefinition).toList();
    final List<Map<String, Object>> rows = new ArrayList<>();
    int testCases = 0;
    int notApplicable = 0;
    for (ColumnRow column : columns) {
      final Map<String, Object> row = columnRow(column);
      final List<Map<String, Object>> verdicts = new ArrayList<>();
      for (int index = 0; index < items.size(); index++) {
        final boolean applicable = isApplicable(definitions.get(index), column);
        verdicts.add(verdict(items.get(index), index, applicable));
        testCases += applicable ? 1 : 0;
        notApplicable += applicable ? 0 : 1;
      }
      row.put("tests", verdicts);
      rows.add(row);
    }
    return previewBody(cdeTermId, items.size(), rows, testCases, notApplicable);
  }

  public static Map<String, Object> schedule(String ruleId) {
    final RuleExecRow row = dao().findRuleExec(ruleId);
    final Map<String, Object> schedule = new LinkedHashMap<>();
    schedule.put("ruleId", ruleId);
    schedule.put("cron", row == null ? null : row.scheduleCron());
    schedule.put(
        "timezone",
        row == null || row.scheduleTimezone() == null
            ? DqSchedule.DEFAULT_TIMEZONE
            : row.scheduleTimezone());
    schedule.put("updatedBy", row == null ? null : row.scheduleUpdatedBy());
    schedule.put("updatedAt", row == null ? null : row.scheduleUpdatedAt());
    schedule.put("nextRuns", nextRuns(row));
    return schedule;
  }

  /** Validates a schedule and returns the next runs it would produce. */
  public static Map<String, Object> previewSchedule(String cron, String timezone) {
    DqSchedule.validate(cron, timezone);
    final Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("cron", cron);
    preview.put("timezone", timezone == null ? DqSchedule.DEFAULT_TIMEZONE : timezone);
    preview.put(
        "nextRuns",
        DqSchedule.nextRuns(cron, timezone, DqSchedule.PREVIEW_RUNS).stream()
            .map(run -> run.toInstant().toEpochMilli())
            .toList());
    return preview;
  }

  /** Sets or clears (null cron) the schedule of a Rule; effective at once, no approval. */
  public static Map<String, Object> setSchedule(
      String ruleId, String cron, String timezone, String actor) {
    DqSchedule.validate(cron, timezone);
    final RuleExecRow row = requireExecRow(ruleId);
    dao().updateSchedule(ruleId, cron, timezone, actor, System.currentTimeMillis());
    DqTestOutbox.enqueuePipelineSync(dao(), ruleId);
    DqTestOutbox.drainAsync();
    LOG.info(
        "Data Quality rule schedule changed rule={} actor={} old={} new={}",
        ruleId,
        actor,
        row.scheduleCron(),
        cron);
    return schedule(ruleId);
  }

  /** Triggers the pipeline of the Rule, which runs every testcase of the Rule. */
  public static Map<String, Object> run(String ruleId, String actor) {
    final IngestionPipeline pipeline = requireRunnablePipeline(ruleId);
    if (isRunning(DqPipelineGateway.latestStatus(pipeline))) {
      throw DqTestErrors.conflict(
          DqTestErrors.RUN_IN_PROGRESS, "The tests of this rule are already running");
    }
    final PipelineServiceClientResponse response = DqPipelineGateway.trigger(pipeline);
    LOG.info(
        "Data Quality rule run triggered rule={} actor={} code={}",
        ruleId,
        actor,
        response.getCode());
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("triggered", response.getCode() != null && response.getCode() == 200);
    body.put("message", response.getReason());
    return body;
  }

  public static Map<String, Object> latestRun(String ruleId) {
    final RuleExecRow row = dao().findRuleExec(ruleId);
    final IngestionPipeline pipeline =
        row == null ? null : DqPipelineGateway.find(row.pipelineId());
    final Map<String, Object> run = new LinkedHashMap<>();
    run.put("state", null);
    if (pipeline != null) {
      final PipelineStatus status = DqPipelineGateway.latestStatus(pipeline);
      run.put("pipelineId", pipeline.getId());
      run.put("pipelineFqn", pipeline.getFullyQualifiedName());
      if (status != null) {
        run.put(
            "state", status.getPipelineState() == null ? null : status.getPipelineState().value());
        run.put("runId", status.getRunId());
        run.put("startedAt", status.getStartDate());
        run.put("endedAt", status.getEndDate());
      }
    }
    return run;
  }

  private static IngestionPipeline requireRunnablePipeline(String ruleId) {
    final RuleExecRow row = requireExecRow(ruleId);
    final IngestionPipeline pipeline =
        row.pipelineId() == null ? null : DqPipelineGateway.find(row.pipelineId());
    if (pipeline == null || dao().listBindingsByState(ruleId, DqTestReconciler.ACTIVE).isEmpty()) {
      throw DqTestErrors.conflict(
          DqTestErrors.RUN_NOT_AVAILABLE, "The rule has no applied testcase to run yet");
    }
    return pipeline;
  }

  private static RuleExecRow requireExecRow(String ruleId) {
    final RuleExecRow row = dao().findRuleExec(ruleId);
    if (row == null) {
      throw DqTestErrors.conflict(
          DqTestErrors.RUN_NOT_AVAILABLE, "The rule has not been applied yet; approve it first");
    }
    return row;
  }

  private static boolean isRunning(PipelineStatus status) {
    return status != null
        && (status.getPipelineState() == PipelineStatusType.RUNNING
            || status.getPipelineState() == PipelineStatusType.QUEUED);
  }

  private static List<Long> nextRuns(RuleExecRow row) {
    return row == null || row.scheduleCron() == null
        ? List.of()
        : DqSchedule.nextRuns(row.scheduleCron(), row.scheduleTimezone(), DqSchedule.PREVIEW_RUNS)
            .stream()
            .map(ZonedDateTime::toInstant)
            .map(java.time.Instant::toEpochMilli)
            .toList();
  }

  private static boolean isSelectable(TestDefinition definition) {
    return !Boolean.FALSE.equals(definition.getEnabled())
        && definition.getEntityType() == TestDefinitionEntityType.COLUMN
        && definition.getTestPlatforms() != null
        && definition.getTestPlatforms().contains(TestPlatform.OPEN_METADATA)
        && !definition.getName().startsWith(DqTestSpecValidator.MANAGED_DEFINITION_PREFIX);
  }

  private static Map<String, Object> definitionSummary(TestDefinition definition) {
    final Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("fqn", definition.getFullyQualifiedName());
    summary.put("name", definition.getName());
    summary.put("displayName", definition.getDisplayName());
    summary.put("description", definition.getDescription());
    summary.put(
        "supportsRowLevelPassedFailed",
        Boolean.TRUE.equals(definition.getSupportsRowLevelPassedFailed()));
    summary.put("supportedDataTypes", definition.getSupportedDataTypes());
    summary.put("parameterDefinition", parameterSummary(definition.getParameterDefinition()));
    return summary;
  }

  private static List<Map<String, Object>> parameterSummary(List<TestCaseParameter> parameters) {
    final List<Map<String, Object>> summary = new ArrayList<>();
    if (parameters != null) {
      for (TestCaseParameter parameter : parameters) {
        final Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("name", parameter.getName());
        entry.put("displayName", parameter.getDisplayName());
        entry.put("description", parameter.getDescription());
        entry.put(
            "dataType", parameter.getDataType() == null ? null : parameter.getDataType().value());
        entry.put("required", Boolean.TRUE.equals(parameter.getRequired()));
        entry.put("optionValues", parameter.getOptionValues());
        summary.add(entry);
      }
    }
    return summary;
  }

  private static TestDefinition previewDefinition(DqTestSpec spec) {
    TestDefinition definition = null;
    if (spec.getKind() == DqTestSpecKind.LIBRARY && !nullOrEmpty(spec.getTestDefinitionFqn())) {
      definition = DqTestSpecService.definitionResolver().apply(spec.getTestDefinitionFqn());
    }
    return definition;
  }

  private static boolean isApplicable(TestDefinition definition, ColumnRow column) {
    return definition == null || DqTestCaseGateway.isApplicable(definition, column);
  }

  private static Map<String, Object> columnRow(ColumnRow column) {
    final String[] parts =
        org.openmetadata.service.util.FullyQualifiedName.split(column.columnFqn());
    final Map<String, Object> row = new LinkedHashMap<>();
    row.put("columnKey", column.columnKey());
    row.put("columnFqn", column.columnFqn());
    row.put("service", parts[0]);
    row.put("table", parts.length >= 2 ? parts[parts.length - 2] : null);
    row.put("dataType", column.dataType());
    return row;
  }

  private static Map<String, Object> verdict(DqTestSpec spec, int index, boolean applicable) {
    final Map<String, Object> verdict = new LinkedHashMap<>();
    verdict.put("specKey", spec.getKey());
    verdict.put("index", index);
    verdict.put("name", spec.getName());
    verdict.put("applicable", applicable);
    verdict.put("reason", applicable ? null : "DATA_TYPE");
    return verdict;
  }

  private static Map<String, Object> previewBody(
      String cdeTermId,
      int specs,
      List<Map<String, Object>> rows,
      int testCases,
      int notApplicable) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("cdeTermId", cdeTermId);
    body.put("columns", rows);
    final Map<String, Object> totals = new LinkedHashMap<>();
    totals.put("specs", specs);
    totals.put("columns", rows.size());
    totals.put("testCases", testCases);
    totals.put("notApplicable", notApplicable);
    body.put("totals", totals);
    return body;
  }

  static DqRuleTestDAO dao() {
    return Entity.getJdbi().onDemand(DqRuleTestDAO.class);
  }

  static UUID uuid(String id) {
    return UUID.fromString(id);
  }
}
