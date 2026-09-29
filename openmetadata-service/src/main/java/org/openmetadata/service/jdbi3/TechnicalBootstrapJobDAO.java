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

/** Persistence boundary for Technical Dictionary bootstrap jobs and batched Column sources. */
public interface TechnicalBootstrapJobDAO {

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_bootstrap_job (jobId, technicalGlossaryId, parentBusinessVersion, "
              + "status, columnScopeSnapshot, createdAt, createdBy, updatedAt, updatedBy) "
              + "VALUES (:jobId, :glossaryId, :parentBusinessVersion, :status, :scope, :now, "
              + ":actor, :now, :actor)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_bootstrap_job (jobId, technicalGlossaryId, parentBusinessVersion, "
              + "status, columnScopeSnapshot, createdAt, createdBy, updatedAt, updatedBy) "
              + "VALUES (:jobId, :glossaryId, :parentBusinessVersion, :status, (:scope :: jsonb), "
              + ":now, :actor, :now, :actor)",
      connectionType = POSTGRES)
  void insertJob(
      @BindUUID("jobId") UUID jobId,
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("status") String status,
      @Bind("scope") String columnScopeSnapshot,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlQuery("SELECT * FROM technical_bootstrap_job WHERE jobId = :jobId")
  @RegisterRowMapper(JobMapper.class)
  JobRecord findJob(@BindUUID("jobId") UUID jobId);

  @SqlQuery(
      "SELECT * FROM technical_bootstrap_job WHERE technicalGlossaryId = :glossaryId "
          + "AND parentBusinessVersion = :parentBusinessVersion")
  @RegisterRowMapper(JobMapper.class)
  JobRecord findJobForScope(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT * FROM technical_bootstrap_job WHERE technicalGlossaryId = :glossaryId "
          + "ORDER BY createdAt DESC")
  @RegisterRowMapper(JobMapper.class)
  List<JobRecord> listJobs(@BindUUID("glossaryId") UUID glossaryId);

  @SqlQuery("SELECT * FROM technical_bootstrap_job WHERE jobId = :jobId FOR UPDATE")
  @RegisterRowMapper(JobMapper.class)
  JobRecord lockJob(@BindUUID("jobId") UUID jobId);

  @SqlUpdate(
      "UPDATE technical_bootstrap_job SET status = :status, updatedAt = :now, updatedBy = :actor "
          + "WHERE jobId = :jobId AND status = :expectedStatus")
  int transitionJob(
      @BindUUID("jobId") UUID jobId,
      @Bind("expectedStatus") String expectedStatus,
      @Bind("status") String status,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "UPDATE technical_bootstrap_job SET status = :status, total = 0, processed = 0, created = 0, "
          + "skipped = 0, failed = 0, checkpoint = NULL, errorSummary = NULL, updatedAt = :now, "
          + "updatedBy = :actor WHERE jobId = :jobId AND status = :expectedStatus")
  int resetJob(
      @BindUUID("jobId") UUID jobId,
      @Bind("expectedStatus") String expectedStatus,
      @Bind("status") String status,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlUpdate(
      "UPDATE technical_bootstrap_job SET total = :total, processed = :processed, "
          + "created = :created, skipped = :skipped, failed = :failed, checkpoint = :checkpoint, "
          + "updatedAt = :now WHERE jobId = :jobId")
  int updateProgress(
      @BindUUID("jobId") UUID jobId,
      @Bind("total") long total,
      @Bind("processed") long processed,
      @Bind("created") long created,
      @Bind("skipped") long skipped,
      @Bind("failed") long failed,
      @Bind("checkpoint") String checkpoint,
      @Bind("now") long now);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE technical_bootstrap_job SET status = :status, errorSummary = :errors, "
              + "updatedAt = :now, updatedBy = :actor WHERE jobId = :jobId",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE technical_bootstrap_job SET status = :status, errorSummary = (:errors :: jsonb), "
              + "updatedAt = :now, updatedBy = :actor WHERE jobId = :jobId",
      connectionType = POSTGRES)
  int finishJob(
      @BindUUID("jobId") UUID jobId,
      @Bind("status") String status,
      @Bind("errors") String errorSummary,
      @Bind("now") long now,
      @Bind("actor") String actor);

  @SqlQuery(
      "SELECT id, json FROM table_entity WHERE deleted IS NOT TRUE AND id > :after "
          + "ORDER BY id LIMIT :limit")
  @RegisterRowMapper(TableSourceMapper.class)
  List<TableSourceRecord> listTablesAfter(@Bind("after") String after, @Bind("limit") int limit);

  record JobRecord(
      UUID jobId,
      UUID technicalGlossaryId,
      String parentBusinessVersion,
      String status,
      String columnScopeSnapshot,
      long total,
      long processed,
      long created,
      long skipped,
      long failed,
      String checkpoint,
      String errorSummary,
      long createdAt,
      String createdBy,
      long updatedAt,
      String updatedBy) {}

  record TableSourceRecord(String id, String json) {}

  class JobMapper implements RowMapper<JobRecord> {
    @Override
    public JobRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new JobRecord(
          UUID.fromString(rs.getString("jobId")),
          UUID.fromString(rs.getString("technicalGlossaryId")),
          rs.getString("parentBusinessVersion"),
          rs.getString("status"),
          rs.getString("columnScopeSnapshot"),
          rs.getLong("total"),
          rs.getLong("processed"),
          rs.getLong("created"),
          rs.getLong("skipped"),
          rs.getLong("failed"),
          rs.getString("checkpoint"),
          rs.getString("errorSummary"),
          rs.getLong("createdAt"),
          rs.getString("createdBy"),
          rs.getLong("updatedAt"),
          rs.getString("updatedBy"));
    }
  }

  class TableSourceMapper implements RowMapper<TableSourceRecord> {
    @Override
    public TableSourceRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new TableSourceRecord(rs.getString("id"), rs.getString("json"));
    }
  }
}
