/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.SpecExecRow;

/**
 * Brings OpenMetadata to the testcases a Data Quality Rule asks for. The desired set is computed
 * from the database: for an effective Rule, every declaration on every available Column of its
 * CDE. The reconciler is idempotent, takes the lock of the Rule's row so two runs never overlap,
 * and records a failure on the binding instead of aborting the others.
 */
@Slf4j
public final class DqTestReconciler {
  public static final String ACTIVE = "ACTIVE";
  public static final String NOT_APPLICABLE = "NOT_APPLICABLE";
  public static final String RETIRED = "RETIRED";
  public static final String ERROR = "ERROR";

  private static final int MAX_ERROR_LENGTH = 2_000;

  private DqTestReconciler() {}

  /** Reconciles one Rule; returns the number of bindings left in ERROR. */
  public static int reconcileRule(String ruleId) {
    int errors = 0;
    final DqRuleSource source = DqRuleSource.load(UUID.fromString(ruleId));
    if (source != null) {
      errors = Entity.getJdbi().inTransaction(handle -> new Run(handle, source).execute());
    }
    return errors;
  }

  private static final class Run {
    private final DqRuleTestDAO dao;
    private final DqRuleContext rule;
    private final boolean effective;
    private final String ruleId;
    private final long now = System.currentTimeMillis();
    private final List<UUID> touched = new ArrayList<>();
    private final Map<String, BindingRow> existing = new HashMap<>();
    private final Set<String> desired = new HashSet<>();
    private int errors;

    Run(Handle handle, DqRuleSource source) {
      this.dao = handle.attach(DqRuleTestDAO.class);
      this.rule = source.context();
      this.effective = source.effective();
      this.ruleId = rule.ruleId().toString();
    }

    int execute() {
      dao.insertRuleExecIfAbsent(ruleId, rule.parentBusinessVersion(), rule.code(), now);
      final RuleExecRow row = dao.lockRuleExec(ruleId);
      dao.listBindings(ruleId).forEach(binding -> existing.put(key(binding), binding));
      final List<DqTestSpec> specs = effective ? rule.specs() : List.of();
      final List<ColumnRow> columns = columnsOf(specs);
      final Map<String, SpecExecRow> specRows = new HashMap<>();
      dao.listSpecs(ruleId).forEach(spec -> specRows.put(spec.specKey(), spec));
      specs.forEach(spec -> applySpec(spec, columns, specRows.get(spec.getKey())));
      retireMissing(specs, specRows);
      syncPipeline(row);
      return errors;
    }

    private List<ColumnRow> columnsOf(List<DqTestSpec> specs) {
      return effective && rule.cdeTermId() != null && !specs.isEmpty()
          ? dao.listAvailableColumnsByCde(rule.cdeTermId())
          : List.of();
    }

    private void applySpec(DqTestSpec spec, List<ColumnRow> columns, SpecExecRow specRow) {
      final String hash = specHash(spec);
      final boolean changed = specRow == null || !hash.equals(specRow.appliedSpecHash());
      columns.forEach(column -> desired.add(spec.getKey() + "|" + column.columnKey()));
      try {
        final TestDefinition definition = DqTestCaseGateway.definitionOf(rule, spec);
        saveSpecRow(spec, definition, hash, specRow);
        for (ColumnRow column : columns) {
          applyBinding(spec, definition, column, changed);
        }
      } catch (RuntimeException exception) {
        LOG.warn("Declaration {} of rule {} failed", spec.getKey(), rule.code(), exception);
        columns.forEach(column -> failBinding(spec, column, exception));
      }
    }

    private void saveSpecRow(
        DqTestSpec spec, TestDefinition definition, String hash, SpecExecRow specRow) {
      final String managedId =
          spec.getKind() == org.openmetadata.schema.type.DqTestSpecKind.SQL
              ? definition.getId().toString()
              : null;
      if (specRow == null) {
        dao.insertSpec(
            ruleId,
            spec.getKey(),
            spec.getName(),
            spec.getKind().value(),
            spec.getTestDefinitionFqn(),
            managedId,
            hash,
            ACTIVE,
            now);
      } else {
        dao.updateSpec(
            ruleId,
            spec.getKey(),
            spec.getName(),
            spec.getKind().value(),
            spec.getTestDefinitionFqn(),
            managedId,
            hash,
            ACTIVE,
            null,
            now);
      }
    }

    private void applyBinding(
        DqTestSpec spec, TestDefinition definition, ColumnRow column, boolean specChanged) {
      final BindingRow current = existing.get(spec.getKey() + "|" + column.columnKey());
      try {
        if (DqTestCaseGateway.isApplicable(definition, column)) {
          activate(spec, definition, column, current, specChanged);
        } else {
          markNotApplicable(spec, column, current);
        }
      } catch (RuntimeException exception) {
        LOG.warn("Testcase {} on {} failed", spec.getKey(), column.columnFqn(), exception);
        failBinding(spec, column, exception);
      }
    }

    private void activate(
        DqTestSpec spec,
        TestDefinition definition,
        ColumnRow column,
        BindingRow current,
        boolean specChanged) {
      final boolean renamed = current != null && !column.columnFqn().equals(current.columnFqn());
      if (renamed) {
        DqTestCaseGateway.retire(current.testCaseId());
      }
      final boolean upToDate =
          current != null
              && ACTIVE.equals(current.state())
              && !specChanged
              && !renamed
              && exists(current.testCaseId());
      if (upToDate) {
        return;
      }
      final TestCase testCase = DqTestCaseGateway.upsert(rule, spec, definition, column);
      touched.add(testCase.getId());
      store(spec, column, current, ACTIVE, null, testCase, null);
    }

    private void markNotApplicable(DqTestSpec spec, ColumnRow column, BindingRow current) {
      if (current != null && current.testCaseId() != null) {
        DqTestCaseGateway.retire(current.testCaseId());
      }
      store(spec, column, current, NOT_APPLICABLE, "DATA_TYPE", null, null);
    }

    private void failBinding(DqTestSpec spec, ColumnRow column, RuntimeException exception) {
      final BindingRow current = existing.get(spec.getKey() + "|" + column.columnKey());
      errors++;
      store(spec, column, current, ERROR, "RECONCILE_FAILED", null, errorText(exception));
    }

    private void store(
        DqTestSpec spec,
        ColumnRow column,
        BindingRow current,
        String state,
        String reason,
        TestCase testCase,
        String lastError) {
      final String testCaseId = testCase != null ? testCase.getId().toString() : keepId(current);
      final String testCaseFqn =
          testCase != null ? testCase.getFullyQualifiedName() : keepFqn(current);
      final Long activatedAt = activatedAt(current, state);
      final int attempts = ERROR.equals(state) && current != null ? current.attempts() + 1 : 0;
      if (current == null) {
        dao.insertBinding(
            UUID.randomUUID().toString(),
            ruleId,
            spec.getKey(),
            column.columnKey(),
            column.columnFqn(),
            rule.cdeTermId(),
            testCaseId,
            testCaseFqn,
            state,
            reason,
            lastError,
            attempts,
            activatedAt,
            null,
            now);
      } else {
        dao.updateBinding(
            current.id(),
            column.columnFqn(),
            rule.cdeTermId(),
            testCaseId,
            testCaseFqn,
            state,
            reason,
            lastError,
            attempts,
            activatedAt,
            null,
            now);
      }
    }

    private void retireMissing(List<DqTestSpec> specs, Map<String, SpecExecRow> specRows) {
      for (BindingRow binding : existing.values()) {
        if (!desired.contains(key(binding)) && !RETIRED.equals(binding.state())) {
          retire(binding, reasonFor(binding, specs));
        }
      }
      final Set<String> keys = new HashSet<>();
      specs.forEach(spec -> keys.add(spec.getKey()));
      specRows.values().stream()
          .filter(row -> !keys.contains(row.specKey()) && !RETIRED.equals(row.state()))
          .forEach(row -> retireSpec(row));
    }

    private void retire(BindingRow binding, String reason) {
      try {
        DqTestCaseGateway.retire(binding.testCaseId());
        dao.updateBinding(
            binding.id(),
            binding.columnFqn(),
            binding.cdeTermId(),
            binding.testCaseId(),
            binding.testCaseFqn(),
            RETIRED,
            reason,
            null,
            0,
            binding.activatedAt(),
            now,
            now);
      } catch (RuntimeException exception) {
        LOG.warn("Retiring testcase {} failed", binding.testCaseId(), exception);
        errors++;
        dao.updateBinding(
            binding.id(),
            binding.columnFqn(),
            binding.cdeTermId(),
            binding.testCaseId(),
            binding.testCaseFqn(),
            ERROR,
            "RETIRE_FAILED",
            errorText(exception),
            binding.attempts() + 1,
            binding.activatedAt(),
            null,
            now);
      }
    }

    private void retireSpec(SpecExecRow row) {
      dao.updateSpec(
          ruleId,
          row.specKey(),
          row.name(),
          row.kind(),
          row.testDefinitionFqn(),
          row.managedTestDefinitionId(),
          row.appliedSpecHash(),
          RETIRED,
          now,
          now);
    }

    private String reasonFor(BindingRow binding, List<DqTestSpec> specs) {
      final boolean specStillDeclared =
          specs.stream().anyMatch(spec -> spec.getKey().equals(binding.specKey()));
      return !effective ? "RULE_INACTIVE" : specStillDeclared ? "COLUMN_REMOVED" : "SPEC_REMOVED";
    }

    /**
     * A failure here must not undo the bindings written above, so it is counted and left to the
     * retry of the outbox entry.
     */
    private void syncPipeline(RuleExecRow row) {
      String suiteId = row.testSuiteId();
      String pipelineId = row.pipelineId();
      try {
        if (hasLiveTestCase()) {
          final TestSuite suite = DqPipelineGateway.ensureSuite(rule);
          suiteId = suite.getId().toString();
          DqPipelineGateway.addTestCases(suite, touched);
          final IngestionPipeline pipeline =
              DqPipelineGateway.ensurePipeline(suite, row.scheduleCron());
          pipelineId = pipeline.getId().toString();
          DqPipelineGateway.setEnabled(pipeline, true);
        } else {
          disablePipeline(row);
        }
      } catch (RuntimeException exception) {
        LOG.warn("Pipeline of rule {} could not be synchronized", rule.code(), exception);
        errors++;
      }
      dao.updateRuleApplied(
          ruleId,
          rule.businessVersion(),
          appliedHash(),
          rule.cdeTermId(),
          suiteId,
          pipelineId,
          now);
    }

    private void disablePipeline(RuleExecRow row) {
      final IngestionPipeline pipeline =
          row.pipelineId() == null ? null : DqPipelineGateway.find(row.pipelineId());
      if (pipeline != null) {
        DqPipelineGateway.setEnabled(pipeline, false);
      }
    }

    private boolean hasLiveTestCase() {
      return dao.listBindingsByState(ruleId, ACTIVE).size() > 0;
    }

    private String appliedHash() {
      final StringBuilder text = new StringBuilder(String.valueOf(effective));
      rule.specs().forEach(spec -> text.append('|').append(specHash(spec)));
      return DqHash.sha256(text.toString());
    }

    private String specHash(DqTestSpec spec) {
      return DqHash.sha256(
          DqTestCaseGateway.json(spec)
              + "|"
              + rule.code()
              + "|"
              + rule.displayName()
              + "|"
              + rule.description());
    }

    private Long activatedAt(BindingRow current, String state) {
      Long activatedAt = current == null ? null : current.activatedAt();
      if (ACTIVE.equals(state) && activatedAt == null) {
        activatedAt = now;
      }
      return activatedAt;
    }

    private static String keepId(BindingRow current) {
      return current == null ? null : current.testCaseId();
    }

    private static String keepFqn(BindingRow current) {
      return current == null ? null : current.testCaseFqn();
    }

    private static String key(BindingRow binding) {
      return binding.specKey() + "|" + binding.columnKey();
    }

    private static boolean exists(String testCaseId) {
      boolean exists = false;
      if (!nullOrEmpty(testCaseId)) {
        try {
          exists = !Boolean.TRUE.equals(DqTestCaseGateway.find(testCaseId).getDeleted());
        } catch (EntityNotFoundException ignored) {
          exists = false;
        }
      }
      return exists;
    }

    private static String errorText(RuntimeException exception) {
      final String message =
          exception.getMessage() == null
              ? exception.getClass().getSimpleName()
              : exception.getMessage();
      return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
    }
  }
}
