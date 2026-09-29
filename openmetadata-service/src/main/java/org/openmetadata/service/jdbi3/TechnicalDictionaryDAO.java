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
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/** Persistence boundary for Technical Dictionary scopes, Column identities and projections. */
public interface TechnicalDictionaryDAO {

  @SqlUpdate(
      "INSERT INTO technical_dictionary_scope "
          + "(scopeId, technicalGlossaryId, technicalVersionId, technicalBusinessVersion, "
          + "dataDictionaryGlossaryId, dataDictionaryVersionId, dataDictionaryBusinessVersion, "
          + "scopeStatus, revision, createdAt, createdBy, updatedAt, updatedBy) "
          + "VALUES (:scopeId, :technicalGlossaryId, :technicalVersionId, :technicalBusinessVersion, "
          + ":dataDictionaryGlossaryId, :dataDictionaryVersionId, :dataDictionaryBusinessVersion, "
          + "'Building', 1, :now, :actor, :now, :actor)")
  void insertScope(
      @BindUUID("scopeId") UUID scopeId,
      @BindUUID("technicalGlossaryId") UUID technicalGlossaryId,
      @BindUUID("technicalVersionId") UUID technicalVersionId,
      @Bind("technicalBusinessVersion") String technicalBusinessVersion,
      @BindUUID("dataDictionaryGlossaryId") UUID dataDictionaryGlossaryId,
      @BindUUID("dataDictionaryVersionId") UUID dataDictionaryVersionId,
      @Bind("dataDictionaryBusinessVersion") String dataDictionaryBusinessVersion,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlQuery(
      "SELECT * FROM technical_dictionary_scope WHERE scopeId = :scopeId")
  @RegisterRowMapper(ScopeMapper.class)
  ScopeRecord findScope(@BindUUID("scopeId") UUID scopeId);

  @SqlQuery(
      "SELECT * FROM technical_dictionary_scope WHERE technicalGlossaryId = :glossaryId "
          + "ORDER BY createdAt DESC")
  @RegisterRowMapper(ScopeMapper.class)
  List<ScopeRecord> listScopes(@BindUUID("glossaryId") UUID glossaryId);

  @SqlQuery(
      "SELECT * FROM technical_dictionary_scope WHERE scopeId = :scopeId FOR UPDATE")
  @RegisterRowMapper(ScopeMapper.class)
  ScopeRecord lockScope(@BindUUID("scopeId") UUID scopeId);

  @SqlUpdate(
      "UPDATE technical_dictionary_scope SET totalColumns = :total, processedColumns = :processed, "
          + "failedColumns = :failed, revision = revision + 1, updatedAt = :now, updatedBy = :actor "
          + "WHERE scopeId = :scopeId AND scopeStatus = 'Building'")
  int updateBootstrapProgress(
      @BindUUID("scopeId") UUID scopeId,
      @Bind("total") long total,
      @Bind("processed") long processed,
      @Bind("failed") long failed,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "UPDATE technical_dictionary_scope SET scopeStatus = 'Active', revision = revision + 1, "
          + "updatedAt = :now, updatedBy = :actor WHERE scopeId = :scopeId "
          + "AND scopeStatus = 'Building' AND failedColumns = 0 AND processedColumns = totalColumns")
  int activateScope(
      @BindUUID("scopeId") UUID scopeId,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "UPDATE technical_dictionary_scope SET scopeStatus = 'Archived', revision = revision + 1, "
          + "archivedAt = :now, archivedBy = :actor, updatedAt = :now, updatedBy = :actor "
          + "WHERE scopeId = :scopeId AND scopeStatus <> 'Archived' AND revision = :expectedRevision")
  int archiveScope(
      @BindUUID("scopeId") UUID scopeId,
      @Bind("expectedRevision") long expectedRevision,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "INSERT INTO technical_record_column_binding "
          + "(scopeId, recordId, columnId, columnFqnSnapshot, sourceAvailable, createdAt, createdBy, updatedAt, updatedBy) "
          + "VALUES (:scopeId, :recordId, :columnId, :columnFqn, true, :now, :actor, :now, :actor)")
  void insertColumnBinding(
      @BindUUID("scopeId") UUID scopeId,
      @BindUUID("recordId") UUID recordId,
      @BindUUID("columnId") UUID columnId,
      @Bind("columnFqn") String columnFqn,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlQuery(
      "SELECT * FROM technical_record_column_binding WHERE scopeId = :scopeId AND columnId = :columnId")
  @RegisterRowMapper(ColumnBindingMapper.class)
  ColumnBindingRecord findColumnBinding(
      @BindUUID("scopeId") UUID scopeId, @BindUUID("columnId") UUID columnId);

  @SqlQuery(
      "SELECT * FROM technical_record_column_binding WHERE scopeId = :scopeId AND recordId = :recordId")
  @RegisterRowMapper(ColumnBindingMapper.class)
  ColumnBindingRecord findRecordBinding(
      @BindUUID("scopeId") UUID scopeId, @BindUUID("recordId") UUID recordId);

  @SqlQuery(
      "SELECT * FROM technical_record_column_binding WHERE scopeId = :scopeId ORDER BY columnFqnSnapshot")
  @RegisterRowMapper(ColumnBindingMapper.class)
  List<ColumnBindingRecord> listColumnBindings(@BindUUID("scopeId") UUID scopeId);

  @SqlUpdate(
      "UPDATE technical_record_column_binding SET columnFqnSnapshot = :columnFqn, sourceAvailable = true, "
          + "updatedAt = :now, updatedBy = :actor WHERE scopeId = :scopeId AND columnId = :columnId")
  int updateColumnBinding(
      @BindUUID("scopeId") UUID scopeId,
      @BindUUID("columnId") UUID columnId,
      @Bind("columnFqn") String columnFqn,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "UPDATE technical_record_column_binding SET sourceAvailable = false, updatedAt = :now, "
          + "updatedBy = :actor WHERE scopeId = :scopeId AND columnId = :columnId")
  int markColumnUnavailable(
      @BindUUID("scopeId") UUID scopeId,
      @BindUUID("columnId") UUID columnId,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlQuery("SELECT json FROM table_entity WHERE deleted IS NOT TRUE ORDER BY id")
  List<String> listTableJson();

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_projection_outbox "
              + "(eventId, snapshotId, scopeId, recordId, columnId, eventType, payload, createdAt) "
              + "VALUES (:eventId, :snapshotId, :scopeId, :recordId, :columnId, :eventType, :payload, :createdAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_projection_outbox "
              + "(eventId, snapshotId, scopeId, recordId, columnId, eventType, payload, createdAt) "
              + "VALUES (:eventId, :snapshotId, :scopeId, :recordId, :columnId, :eventType, (:payload :: jsonb), :createdAt)",
      connectionType = POSTGRES)
  void insertProjectionEvent(
      @BindUUID("eventId") UUID eventId,
      @BindUUID("snapshotId") UUID snapshotId,
      @BindUUID("scopeId") UUID scopeId,
      @BindUUID("recordId") UUID recordId,
      @BindUUID("columnId") UUID columnId,
      @Bind("eventType") String eventType,
      @Bind("payload") String payload,
      @Bind("createdAt") long createdAt);

  @SqlQuery(
      "SELECT * FROM technical_projection_outbox WHERE processedAt IS NULL "
          + "ORDER BY createdAt LIMIT :limit")
  @RegisterRowMapper(ProjectionEventMapper.class)
  List<ProjectionEventRecord> listPendingProjectionEvents(@Bind("limit") int limit);

  @SqlUpdate(
      "UPDATE technical_projection_outbox SET processedAt = :processedAt, attempts = attempts + 1, "
          + "lastError = NULL WHERE eventId = :eventId AND processedAt IS NULL")
  int markProjectionProcessed(
      @BindUUID("eventId") UUID eventId, @Bind("processedAt") long processedAt);

  @SqlUpdate(
      "UPDATE technical_projection_outbox SET attempts = attempts + 1, lastError = :error "
          + "WHERE eventId = :eventId AND processedAt IS NULL")
  int markProjectionFailed(@BindUUID("eventId") UUID eventId, @Bind("error") String error);

  record ScopeRecord(
      UUID scopeId,
      UUID technicalGlossaryId,
      UUID technicalVersionId,
      String technicalBusinessVersion,
      UUID dataDictionaryGlossaryId,
      UUID dataDictionaryVersionId,
      String dataDictionaryBusinessVersion,
      String scopeStatus,
      long revision,
      long totalColumns,
      long processedColumns,
      long failedColumns,
      long createdAt,
      String createdBy,
      long updatedAt,
      String updatedBy,
      Long archivedAt,
      String archivedBy) {}

  record ColumnBindingRecord(
      UUID scopeId,
      UUID recordId,
      UUID columnId,
      String columnFqnSnapshot,
      boolean sourceAvailable,
      long createdAt,
      String createdBy,
      long updatedAt,
      String updatedBy) {}

  record ProjectionEventRecord(
      UUID eventId,
      UUID snapshotId,
      UUID scopeId,
      UUID recordId,
      UUID columnId,
      String eventType,
      String payload,
      long createdAt,
      Long processedAt,
      int attempts,
      String lastError) {}

  class ScopeMapper implements RowMapper<ScopeRecord> {
    @Override
    public ScopeRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new ScopeRecord(
          UUID.fromString(rs.getString("scopeId")),
          UUID.fromString(rs.getString("technicalGlossaryId")),
          UUID.fromString(rs.getString("technicalVersionId")),
          rs.getString("technicalBusinessVersion"),
          UUID.fromString(rs.getString("dataDictionaryGlossaryId")),
          UUID.fromString(rs.getString("dataDictionaryVersionId")),
          rs.getString("dataDictionaryBusinessVersion"),
          rs.getString("scopeStatus"),
          rs.getLong("revision"),
          rs.getLong("totalColumns"),
          rs.getLong("processedColumns"),
          rs.getLong("failedColumns"),
          rs.getLong("createdAt"),
          rs.getString("createdBy"),
          rs.getLong("updatedAt"),
          rs.getString("updatedBy"),
          nullableLong(rs, "archivedAt"),
          rs.getString("archivedBy"));
    }
  }

  class ColumnBindingMapper implements RowMapper<ColumnBindingRecord> {
    @Override
    public ColumnBindingRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new ColumnBindingRecord(
          UUID.fromString(rs.getString("scopeId")),
          UUID.fromString(rs.getString("recordId")),
          UUID.fromString(rs.getString("columnId")),
          rs.getString("columnFqnSnapshot"),
          rs.getBoolean("sourceAvailable"),
          rs.getLong("createdAt"),
          rs.getString("createdBy"),
          rs.getLong("updatedAt"),
          rs.getString("updatedBy"));
    }
  }

  class ProjectionEventMapper implements RowMapper<ProjectionEventRecord> {
    @Override
    public ProjectionEventRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new ProjectionEventRecord(
          UUID.fromString(rs.getString("eventId")),
          UUID.fromString(rs.getString("snapshotId")),
          UUID.fromString(rs.getString("scopeId")),
          UUID.fromString(rs.getString("recordId")),
          UUID.fromString(rs.getString("columnId")),
          rs.getString("eventType"),
          rs.getString("payload"),
          rs.getLong("createdAt"),
          nullableLong(rs, "processedAt"),
          rs.getInt("attempts"),
          rs.getString("lastError"));
    }
  }

  private static Long nullableLong(ResultSet rs, String column) throws SQLException {
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }
}
