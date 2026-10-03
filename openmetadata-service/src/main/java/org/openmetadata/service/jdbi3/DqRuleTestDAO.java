/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

/** Persistence of Data Quality Rule test execution: Rule state, declarations, bindings, outbox. */
public interface DqRuleTestDAO {
  String RULE_COLUMNS =
      "ruleTermId, parentBusinessVersion, ruleCode, appliedBusinessVersion, appliedSpecsHash, "
          + "cdeTermId, testSuiteId, pipelineId, scheduleCron, scheduleTimezone, "
          + "scheduleUpdatedBy, scheduleUpdatedAt, revision, updatedAt";
  String SPEC_COLUMNS =
      "ruleTermId, specKey, name, kind, testDefinitionFqn, managedTestDefinitionId, "
          + "appliedSpecHash, state, retiredAt, updatedAt";
  String BINDING_COLUMNS =
      "id, ruleTermId, specKey, columnKey, columnFqn, cdeTermId, testCaseId, testCaseFqn, state, "
          + "stateReason, lastError, attempts, activatedAt, retiredAt, createdAt, updatedAt";

  // ---- rule execution state ------------------------------------------------------------------

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT IGNORE INTO dq_rule_exec (ruleTermId, parentBusinessVersion, ruleCode, updatedAt) "
              + "VALUES (:ruleTermId, :parentBusinessVersion, :ruleCode, :now)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO dq_rule_exec (ruleTermId, parentBusinessVersion, ruleCode, updatedAt) "
              + "VALUES (:ruleTermId, :parentBusinessVersion, :ruleCode, :now) "
              + "ON CONFLICT (ruleTermId) DO NOTHING",
      connectionType = POSTGRES)
  void insertRuleExecIfAbsent(
      @Bind("ruleTermId") String ruleTermId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("ruleCode") String ruleCode,
      @Bind("now") long now);

  @SqlQuery(
      "SELECT " + RULE_COLUMNS + " FROM dq_rule_exec WHERE ruleTermId = :ruleTermId FOR UPDATE")
  @RegisterRowMapper(RuleMapper.class)
  RuleExecRow lockRuleExec(@Bind("ruleTermId") String ruleTermId);

  @SqlQuery("SELECT " + RULE_COLUMNS + " FROM dq_rule_exec WHERE ruleTermId = :ruleTermId")
  @RegisterRowMapper(RuleMapper.class)
  RuleExecRow findRuleExec(@Bind("ruleTermId") String ruleTermId);

  @SqlQuery("SELECT " + RULE_COLUMNS + " FROM dq_rule_exec ORDER BY ruleTermId")
  @RegisterRowMapper(RuleMapper.class)
  List<RuleExecRow> listRuleExec();

  @SqlQuery("SELECT " + RULE_COLUMNS + " FROM dq_rule_exec WHERE cdeTermId = :cdeTermId")
  @RegisterRowMapper(RuleMapper.class)
  List<RuleExecRow> listRuleExecByCde(@Bind("cdeTermId") String cdeTermId);

  @SqlUpdate(
      "UPDATE dq_rule_exec SET appliedBusinessVersion = :appliedBusinessVersion, "
          + "appliedSpecsHash = :appliedSpecsHash, cdeTermId = :cdeTermId, "
          + "testSuiteId = :testSuiteId, pipelineId = :pipelineId, "
          + "revision = revision + 1, updatedAt = :now WHERE ruleTermId = :ruleTermId")
  int updateRuleApplied(
      @Bind("ruleTermId") String ruleTermId,
      @Bind("appliedBusinessVersion") String appliedBusinessVersion,
      @Bind("appliedSpecsHash") String appliedSpecsHash,
      @Bind("cdeTermId") String cdeTermId,
      @Bind("testSuiteId") String testSuiteId,
      @Bind("pipelineId") String pipelineId,
      @Bind("now") long now);

  @SqlUpdate(
      "UPDATE dq_rule_exec SET scheduleCron = :cron, scheduleTimezone = :timezone, "
          + "scheduleUpdatedBy = :by, scheduleUpdatedAt = :now, revision = revision + 1, "
          + "updatedAt = :now WHERE ruleTermId = :ruleTermId")
  int updateSchedule(
      @Bind("ruleTermId") String ruleTermId,
      @Bind("cron") String cron,
      @Bind("timezone") String timezone,
      @Bind("by") String by,
      @Bind("now") long now);

  // ---- declarations --------------------------------------------------------------------------

  @SqlQuery(
      "SELECT "
          + SPEC_COLUMNS
          + " FROM dq_rule_test_spec_exec WHERE ruleTermId = :ruleTermId ORDER BY specKey")
  @RegisterRowMapper(SpecMapper.class)
  List<SpecExecRow> listSpecs(@Bind("ruleTermId") String ruleTermId);

  @SqlUpdate(
      "INSERT INTO dq_rule_test_spec_exec (ruleTermId, specKey, name, kind, testDefinitionFqn, "
          + "managedTestDefinitionId, appliedSpecHash, state, retiredAt, updatedAt) VALUES "
          + "(:ruleTermId, :specKey, :name, :kind, :testDefinitionFqn, :managedTestDefinitionId, "
          + ":appliedSpecHash, :state, NULL, :now)")
  void insertSpec(
      @Bind("ruleTermId") String ruleTermId,
      @Bind("specKey") String specKey,
      @Bind("name") String name,
      @Bind("kind") String kind,
      @Bind("testDefinitionFqn") String testDefinitionFqn,
      @Bind("managedTestDefinitionId") String managedTestDefinitionId,
      @Bind("appliedSpecHash") String appliedSpecHash,
      @Bind("state") String state,
      @Bind("now") long now);

  @SqlUpdate(
      "UPDATE dq_rule_test_spec_exec SET name = :name, kind = :kind, "
          + "testDefinitionFqn = :testDefinitionFqn, managedTestDefinitionId = :managedTestDefinitionId, "
          + "appliedSpecHash = :appliedSpecHash, state = :state, retiredAt = :retiredAt, "
          + "updatedAt = :now WHERE ruleTermId = :ruleTermId AND specKey = :specKey")
  int updateSpec(
      @Bind("ruleTermId") String ruleTermId,
      @Bind("specKey") String specKey,
      @Bind("name") String name,
      @Bind("kind") String kind,
      @Bind("testDefinitionFqn") String testDefinitionFqn,
      @Bind("managedTestDefinitionId") String managedTestDefinitionId,
      @Bind("appliedSpecHash") String appliedSpecHash,
      @Bind("state") String state,
      @Bind("retiredAt") Long retiredAt,
      @Bind("now") long now);

  // ---- bindings ------------------------------------------------------------------------------

  @SqlQuery(
      "SELECT " + BINDING_COLUMNS + " FROM dq_rule_test_binding WHERE ruleTermId = :ruleTermId")
  @RegisterRowMapper(BindingMapper.class)
  List<BindingRow> listBindings(@Bind("ruleTermId") String ruleTermId);

  @SqlQuery(
      "SELECT "
          + BINDING_COLUMNS
          + " FROM dq_rule_test_binding WHERE ruleTermId = :ruleTermId AND state = :state")
  @RegisterRowMapper(BindingMapper.class)
  List<BindingRow> listBindingsByState(
      @Bind("ruleTermId") String ruleTermId, @Bind("state") String state);

  @SqlQuery("SELECT " + BINDING_COLUMNS + " FROM dq_rule_test_binding WHERE columnKey = :columnKey")
  @RegisterRowMapper(BindingMapper.class)
  List<BindingRow> listBindingsByColumn(@Bind("columnKey") String columnKey);

  @SqlQuery(
      "SELECT "
          + BINDING_COLUMNS
          + " FROM dq_rule_test_binding WHERE cdeTermId = :cdeTermId AND state = 'ACTIVE'")
  @RegisterRowMapper(BindingMapper.class)
  List<BindingRow> listActiveBindingsByCde(@Bind("cdeTermId") String cdeTermId);

  @SqlQuery(
      "SELECT " + BINDING_COLUMNS + " FROM dq_rule_test_binding WHERE testCaseId = :testCaseId")
  @RegisterRowMapper(BindingMapper.class)
  BindingRow findBindingByTestCase(@Bind("testCaseId") String testCaseId);

  @SqlQuery(
      "SELECT " + BINDING_COLUMNS + " FROM dq_rule_test_binding WHERE testCaseFqn = :testCaseFqn")
  @RegisterRowMapper(BindingMapper.class)
  BindingRow findBindingByTestCaseFqn(@Bind("testCaseFqn") String testCaseFqn);

  @SqlQuery("SELECT " + BINDING_COLUMNS + " FROM dq_rule_test_binding WHERE state = :state")
  @RegisterRowMapper(BindingMapper.class)
  List<BindingRow> listBindingsInState(@Bind("state") String state);

  @SqlQuery("SELECT COUNT(*) FROM dq_rule_test_binding WHERE state = :state")
  long countBindingsInState(@Bind("state") String state);

  @SqlUpdate(
      "INSERT INTO dq_rule_test_binding (id, ruleTermId, specKey, columnKey, columnFqn, "
          + "cdeTermId, testCaseId, testCaseFqn, state, stateReason, lastError, attempts, "
          + "activatedAt, retiredAt, createdAt, updatedAt) VALUES (:id, :ruleTermId, :specKey, "
          + ":columnKey, :columnFqn, :cdeTermId, :testCaseId, :testCaseFqn, :state, :stateReason, "
          + ":lastError, :attempts, :activatedAt, :retiredAt, :now, :now)")
  void insertBinding(
      @Bind("id") String id,
      @Bind("ruleTermId") String ruleTermId,
      @Bind("specKey") String specKey,
      @Bind("columnKey") String columnKey,
      @Bind("columnFqn") String columnFqn,
      @Bind("cdeTermId") String cdeTermId,
      @Bind("testCaseId") String testCaseId,
      @Bind("testCaseFqn") String testCaseFqn,
      @Bind("state") String state,
      @Bind("stateReason") String stateReason,
      @Bind("lastError") String lastError,
      @Bind("attempts") int attempts,
      @Bind("activatedAt") Long activatedAt,
      @Bind("retiredAt") Long retiredAt,
      @Bind("now") long now);

  @SqlUpdate(
      "UPDATE dq_rule_test_binding SET columnFqn = :columnFqn, cdeTermId = :cdeTermId, "
          + "testCaseId = :testCaseId, testCaseFqn = :testCaseFqn, state = :state, "
          + "stateReason = :stateReason, lastError = :lastError, attempts = :attempts, "
          + "activatedAt = :activatedAt, retiredAt = :retiredAt, updatedAt = :now WHERE id = :id")
  int updateBinding(
      @Bind("id") String id,
      @Bind("columnFqn") String columnFqn,
      @Bind("cdeTermId") String cdeTermId,
      @Bind("testCaseId") String testCaseId,
      @Bind("testCaseFqn") String testCaseFqn,
      @Bind("state") String state,
      @Bind("stateReason") String stateReason,
      @Bind("lastError") String lastError,
      @Bind("attempts") int attempts,
      @Bind("activatedAt") Long activatedAt,
      @Bind("retiredAt") Long retiredAt,
      @Bind("now") long now);

  @SqlQuery(
      "SELECT DISTINCT ruleTermId FROM dq_rule_test_binding WHERE state IN ('ACTIVE', 'ERROR', "
          + "'NOT_APPLICABLE')")
  List<String> listRulesWithLiveBindings();

  // ---- Technical Dictionary reads ------------------------------------------------------------

  @SqlQuery(
      "SELECT columnKey, columnFqn, dataType, cdeTermId FROM technical_record "
          + "WHERE cdeTermId = :cdeTermId AND sourceStatus = 'Available' ORDER BY columnFqn")
  @RegisterRowMapper(ColumnMapper.class)
  List<ColumnRow> listAvailableColumnsByCde(@Bind("cdeTermId") String cdeTermId);

  @SqlQuery(
      "SELECT columnKey, columnFqn, dataType, cdeTermId FROM technical_record "
          + "WHERE columnKey IN (<keys>)")
  @RegisterRowMapper(ColumnMapper.class)
  List<ColumnRow> listColumnsByKeys(@BindList("keys") List<String> columnKeys);

  // ---- outbox --------------------------------------------------------------------------------

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO dq_test_outbox (kind, subjectKey, payload, enqueuedAt, attempts) "
              + "VALUES (:kind, :subjectKey, :payload, :now, 0) ON DUPLICATE KEY UPDATE "
              + "payload = VALUES(payload), enqueuedAt = VALUES(enqueuedAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO dq_test_outbox (kind, subjectKey, payload, enqueuedAt, attempts) "
              + "VALUES (:kind, :subjectKey, :payload, :now, 0) ON CONFLICT (kind, subjectKey) "
              + "DO UPDATE SET payload = EXCLUDED.payload, enqueuedAt = EXCLUDED.enqueuedAt",
      connectionType = POSTGRES)
  void enqueue(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("payload") String payload,
      @Bind("now") long now);

  @SqlQuery(
      "SELECT kind, subjectKey, payload, enqueuedAt, attempts, lastError FROM dq_test_outbox "
          + "ORDER BY attempts, enqueuedAt, subjectKey LIMIT :limit")
  @RegisterRowMapper(OutboxMapper.class)
  List<OutboxEntry> listPending(@Bind("limit") int limit);

  @SqlQuery("SELECT COUNT(*) FROM dq_test_outbox")
  long countPending();

  @SqlQuery("SELECT MIN(enqueuedAt) FROM dq_test_outbox")
  Long oldestPendingAt();

  @SqlUpdate(
      "DELETE FROM dq_test_outbox WHERE kind = :kind AND subjectKey = :subjectKey "
          + "AND enqueuedAt <= :cutoff")
  int deleteProcessed(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("cutoff") long cutoff);

  @SqlUpdate(
      "UPDATE dq_test_outbox SET attempts = attempts + 1, lastError = :lastError "
          + "WHERE kind = :kind AND subjectKey = :subjectKey")
  int markFailed(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("lastError") String lastError);

  // ---- rows ----------------------------------------------------------------------------------

  record RuleExecRow(
      String ruleTermId,
      String parentBusinessVersion,
      String ruleCode,
      String appliedBusinessVersion,
      String appliedSpecsHash,
      String cdeTermId,
      String testSuiteId,
      String pipelineId,
      String scheduleCron,
      String scheduleTimezone,
      String scheduleUpdatedBy,
      Long scheduleUpdatedAt,
      long revision,
      long updatedAt) {}

  record SpecExecRow(
      String ruleTermId,
      String specKey,
      String name,
      String kind,
      String testDefinitionFqn,
      String managedTestDefinitionId,
      String appliedSpecHash,
      String state,
      Long retiredAt,
      long updatedAt) {}

  record BindingRow(
      String id,
      String ruleTermId,
      String specKey,
      String columnKey,
      String columnFqn,
      String cdeTermId,
      String testCaseId,
      String testCaseFqn,
      String state,
      String stateReason,
      String lastError,
      int attempts,
      Long activatedAt,
      Long retiredAt,
      long createdAt,
      long updatedAt) {}

  record ColumnRow(String columnKey, String columnFqn, String dataType, String cdeTermId) {}

  record OutboxEntry(
      String kind,
      String subjectKey,
      String payload,
      long enqueuedAt,
      int attempts,
      String lastError) {}

  class RuleMapper implements RowMapper<RuleExecRow> {
    @Override
    public RuleExecRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new RuleExecRow(
          rs.getString("ruleTermId"),
          rs.getString("parentBusinessVersion"),
          rs.getString("ruleCode"),
          rs.getString("appliedBusinessVersion"),
          rs.getString("appliedSpecsHash"),
          rs.getString("cdeTermId"),
          rs.getString("testSuiteId"),
          rs.getString("pipelineId"),
          rs.getString("scheduleCron"),
          rs.getString("scheduleTimezone"),
          rs.getString("scheduleUpdatedBy"),
          nullableLong(rs, "scheduleUpdatedAt"),
          rs.getLong("revision"),
          rs.getLong("updatedAt"));
    }
  }

  class SpecMapper implements RowMapper<SpecExecRow> {
    @Override
    public SpecExecRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new SpecExecRow(
          rs.getString("ruleTermId"),
          rs.getString("specKey"),
          rs.getString("name"),
          rs.getString("kind"),
          rs.getString("testDefinitionFqn"),
          rs.getString("managedTestDefinitionId"),
          rs.getString("appliedSpecHash"),
          rs.getString("state"),
          nullableLong(rs, "retiredAt"),
          rs.getLong("updatedAt"));
    }
  }

  class BindingMapper implements RowMapper<BindingRow> {
    @Override
    public BindingRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new BindingRow(
          rs.getString("id"),
          rs.getString("ruleTermId"),
          rs.getString("specKey"),
          rs.getString("columnKey"),
          rs.getString("columnFqn"),
          rs.getString("cdeTermId"),
          rs.getString("testCaseId"),
          rs.getString("testCaseFqn"),
          rs.getString("state"),
          rs.getString("stateReason"),
          rs.getString("lastError"),
          rs.getInt("attempts"),
          nullableLong(rs, "activatedAt"),
          nullableLong(rs, "retiredAt"),
          rs.getLong("createdAt"),
          rs.getLong("updatedAt"));
    }
  }

  class ColumnMapper implements RowMapper<ColumnRow> {
    @Override
    public ColumnRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new ColumnRow(
          rs.getString("columnKey"),
          rs.getString("columnFqn"),
          rs.getString("dataType"),
          rs.getString("cdeTermId"));
    }
  }

  class OutboxMapper implements RowMapper<OutboxEntry> {
    @Override
    public OutboxEntry map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new OutboxEntry(
          rs.getString("kind"),
          rs.getString("subjectKey"),
          rs.getString("payload"),
          rs.getLong("enqueuedAt"),
          rs.getInt("attempts"),
          rs.getString("lastError"));
    }
  }

  private static Long nullableLong(ResultSet rs, String column) throws SQLException {
    final long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }
}
