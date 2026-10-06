/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
import org.openmetadata.service.config.PortalConfiguration;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.SpecExecRow;
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

  /** Triggers the pipeline of every declaration of the Rule that has a live testcase. */
  public static Map<String, Object> run(String ruleId, String actor) {
    final List<IngestionPipeline> pipelines = requireRunnablePipelines(ruleId);
    if (pipelines.stream()
        .map(DqPipelineGateway::latestStatus)
        .anyMatch(DqRuleTestService::isRunning)) {
      throw DqTestErrors.conflict(
          DqTestErrors.RUN_IN_PROGRESS, "The tests of this rule are already running");
    }
    final Map<String, Object> body = new LinkedHashMap<>();
    if (PortalConfiguration.isActive()) {
      // The Portal cannot reach the pipeline service; the OpenMetadata server runs the pipelines
      pipelines.forEach(pipeline -> DqTestOutbox.enqueueIngestionPipelineTrigger(pipeline.getId()));
      body.put("triggered", true);
      body.put("message", "The run is queued; the OpenMetadata server starts it");
    } else {
      body.putAll(trigger(ruleId, actor, pipelines));
    }
    return body;
  }

  private static Map<String, Object> trigger(
      String ruleId, String actor, List<IngestionPipeline> pipelines) {
    boolean triggered = true;
    String message = null;
    for (IngestionPipeline pipeline : pipelines) {
      final PipelineServiceClientResponse response = DqPipelineGateway.trigger(pipeline);
      LOG.info(
          "Data Quality rule run triggered rule={} actor={} pipeline={} code={}",
          ruleId,
          actor,
          pipeline.getName(),
          response.getCode());
      if (response.getCode() == null || response.getCode() != 200) {
        triggered = false;
        message = response.getReason();
      }
    }
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("triggered", triggered);
    body.put("message", message);
    return body;
  }

  /**
   * The state of the latest run: running while any declaration runs, else the newest run. Also lists
   * the pipeline of every declaration with its own state.
   */
  public static Map<String, Object> latestRun(String ruleId) {
    final List<PipelineStatus> statuses = new ArrayList<>();
    final List<Map<String, Object>> pipelines = new ArrayList<>();
    final RuleExecRow row = dao().findRuleExec(ruleId);
    if (row != null) {
      final Map<String, String> specNames = specNames(ruleId);
      for (IngestionPipeline pipeline : specPipelines(row)) {
        final PipelineStatus status = DqPipelineGateway.latestStatus(pipeline);
        if (status != null) {
          statuses.add(status);
        }
        pipelines.add(pipelineRun(pipeline, status, specNames));
      }
    }
    final Map<String, Object> run = new LinkedHashMap<>();
    run.put("state", null);
    final PipelineStatus latest = newestOrRunning(statuses);
    if (latest != null) {
      run.put("state", stateOf(latest));
      run.put("runId", latest.getRunId());
      run.put("startedAt", latest.getStartDate());
      run.put("endedAt", latest.getEndDate());
    }
    run.put("pipelines", pipelines);
    return run;
  }

  private static PipelineStatus newestOrRunning(List<PipelineStatus> statuses) {
    return statuses.stream()
        .filter(DqRuleTestService::isRunning)
        .findFirst()
        .orElseGet(
            () ->
                statuses.stream()
                    .max(Comparator.comparingLong(DqRuleTestService::startedAt))
                    .orElse(null));
  }

  private static Map<String, Object> pipelineRun(
      IngestionPipeline pipeline, PipelineStatus status, Map<String, String> specNames) {
    final String specKey =
        pipeline.getName().substring(DqPipelineGateway.PIPELINE_NAME.length() + 1);
    final Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("specKey", specKey);
    entry.put("specName", specNames.getOrDefault(specKey, specKey));
    entry.put("pipelineName", pipeline.getName());
    entry.put("pipelineFqn", pipeline.getFullyQualifiedName());
    entry.put(
        "schedule",
        pipeline.getAirflowConfig() == null
            ? null
            : pipeline.getAirflowConfig().getScheduleInterval());
    entry.put("deployed", Boolean.TRUE.equals(pipeline.getDeployed()));
    entry.put("state", status == null ? null : stateOf(status));
    entry.put("startedAt", status == null ? null : status.getStartDate());
    entry.put("endedAt", status == null ? null : status.getEndDate());
    return entry;
  }

  private static String stateOf(PipelineStatus status) {
    return status.getPipelineState() == null ? null : status.getPipelineState().value();
  }

  private static Map<String, String> specNames(String ruleId) {
    final Map<String, String> names = new LinkedHashMap<>();
    dao().listSpecs(ruleId).forEach(spec -> names.put(spec.specKey(), spec.name()));
    return names;
  }

  private static long startedAt(PipelineStatus status) {
    return status.getStartDate() == null ? 0L : status.getStartDate();
  }

  private static List<IngestionPipeline> specPipelines(RuleExecRow row) {
    final List<String> specKeys =
        dao().listSpecs(row.ruleTermId()).stream()
            .filter(spec -> !DqTestReconciler.RETIRED.equals(spec.state()))
            .map(SpecExecRow::specKey)
            .toList();
    return DqPipelineGateway.findSpecPipelines(row.testSuiteId(), specKeys);
  }

  private static List<IngestionPipeline> requireRunnablePipelines(String ruleId) {
    final RuleExecRow row = requireExecRow(ruleId);
    final List<IngestionPipeline> pipelines = specPipelines(row);
    if (pipelines.isEmpty()
        || dao().listBindingsByState(ruleId, DqTestReconciler.ACTIVE).isEmpty()) {
      throw DqTestErrors.conflict(
          DqTestErrors.RUN_NOT_AVAILABLE, "The rule has no applied testcase to run yet");
    }
    return pipelines;
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
