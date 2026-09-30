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
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/**
 * Operational source-Column state and record lookups for the Technical Dictionary. Only Columns
 * that are Unavailable or Changed have a state row; published snapshots are never rewritten.
 */
public interface TechnicalSourceStateDAO {

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_source_state (technicalGlossaryId, parentBusinessVersion, "
              + "columnKey, status, columnFqn, detectedAt) VALUES (:glossaryId, :pbv, :columnKey, "
              + ":status, :columnFqn, :now) ON DUPLICATE KEY UPDATE status = VALUES(status), "
              + "columnFqn = VALUES(columnFqn), detectedAt = VALUES(detectedAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_source_state (technicalGlossaryId, parentBusinessVersion, "
              + "columnKey, status, columnFqn, detectedAt) VALUES (:glossaryId, :pbv, :columnKey, "
              + ":status, :columnFqn, :now) ON CONFLICT (technicalGlossaryId, "
              + "parentBusinessVersion, columnKey) DO UPDATE SET status = EXCLUDED.status, "
              + "columnFqn = EXCLUDED.columnFqn, detectedAt = EXCLUDED.detectedAt",
      connectionType = POSTGRES)
  void upsertState(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("pbv") String parentBusinessVersion,
      @Bind("columnKey") String columnKey,
      @Bind("status") String status,
      @Bind("columnFqn") String columnFqn,
      @Bind("now") long now);

  @SqlUpdate(
      "DELETE FROM technical_source_state WHERE technicalGlossaryId = :glossaryId "
          + "AND parentBusinessVersion = :pbv AND columnKey = :columnKey")
  int deleteState(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("pbv") String parentBusinessVersion,
      @Bind("columnKey") String columnKey);

  @SqlQuery(
      "SELECT * FROM technical_source_state WHERE technicalGlossaryId = :glossaryId "
          + "AND parentBusinessVersion = :pbv")
  @RegisterRowMapper(StateMapper.class)
  List<SourceStateRecord> listStates(
      @BindUUID("glossaryId") UUID glossaryId, @Bind("pbv") String parentBusinessVersion);

  @SqlQuery(
      "SELECT * FROM technical_source_state WHERE technicalGlossaryId = :glossaryId "
          + "AND parentBusinessVersion = :pbv AND columnKey = :columnKey")
  @RegisterRowMapper(StateMapper.class)
  SourceStateRecord findState(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("pbv") String parentBusinessVersion,
      @Bind("columnKey") String columnKey);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT name FROM glossary_term_entity WHERE fqnHash LIKE :prefix "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) = :pbv",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT name FROM glossary_term_entity WHERE fqnHash LIKE :prefix "
              + "AND json->>'parentBusinessVersion' = :pbv",
      connectionType = POSTGRES)
  List<String> listRecordNames(
      @Bind("prefix") String glossaryHashPrefix, @Bind("pbv") String parentBusinessVersion);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) AS pbv "
              + "FROM glossary_term_entity WHERE fqnHash LIKE :prefix AND name IN (<names>)",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, json->>'parentBusinessVersion' AS pbv FROM glossary_term_entity "
              + "WHERE fqnHash LIKE :prefix AND name IN (<names>)",
      connectionType = POSTGRES)
  @RegisterRowMapper(RecordIdentityMapper.class)
  List<RecordIdentity> listRecordsByNames(
      @Bind("prefix") String glossaryHashPrefix, @BindList("names") List<String> names);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) AS pbv "
              + "FROM glossary_term_entity WHERE fqnHash LIKE :prefix AND id IN (<ids>)",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, json->>'parentBusinessVersion' AS pbv FROM glossary_term_entity "
              + "WHERE fqnHash LIKE :prefix AND id IN (<ids>)",
      connectionType = POSTGRES)
  @RegisterRowMapper(RecordIdentityMapper.class)
  List<RecordIdentity> listRecordsByIds(
      @Bind("prefix") String glossaryHashPrefix, @BindList("ids") List<String> termIds);

  /** Keyset page of every record identity, ordered by id. */
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) AS pbv "
              + "FROM glossary_term_entity WHERE fqnHash LIKE :prefix AND id > :after "
              + "ORDER BY id LIMIT :limit",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, json->>'parentBusinessVersion' AS pbv FROM glossary_term_entity "
              + "WHERE fqnHash LIKE :prefix AND id > :after ORDER BY id LIMIT :limit",
      connectionType = POSTGRES)
  @RegisterRowMapper(RecordIdentityMapper.class)
  List<RecordIdentity> listRecordsAfter(
      @Bind("prefix") String glossaryHashPrefix,
      @Bind("after") String afterTermId,
      @Bind("limit") int limit);

  /** Keyset page of the record identities of one catalog version, ordered by id. */
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) AS pbv "
              + "FROM glossary_term_entity WHERE fqnHash LIKE :prefix "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.parentBusinessVersion')) = :pbv "
              + "AND id > :after ORDER BY id LIMIT :limit",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, name, json->>'parentBusinessVersion' AS pbv FROM glossary_term_entity "
              + "WHERE fqnHash LIKE :prefix AND json->>'parentBusinessVersion' = :pbv "
              + "AND id > :after ORDER BY id LIMIT :limit",
      connectionType = POSTGRES)
  @RegisterRowMapper(RecordIdentityMapper.class)
  List<RecordIdentity> listRecordsInScopeAfter(
      @Bind("prefix") String glossaryHashPrefix,
      @Bind("pbv") String parentBusinessVersion,
      @Bind("after") String afterTermId,
      @Bind("limit") int limit);

  record SourceStateRecord(
      UUID technicalGlossaryId,
      String parentBusinessVersion,
      String columnKey,
      String status,
      String columnFqn,
      long detectedAt) {}

  record RecordIdentity(UUID termId, String columnKey, String parentBusinessVersion) {}

  class StateMapper implements RowMapper<SourceStateRecord> {
    @Override
    public SourceStateRecord map(ResultSet rs, StatementContext context) throws SQLException {
      return new SourceStateRecord(
          UUID.fromString(rs.getString("technicalGlossaryId")),
          rs.getString("parentBusinessVersion"),
          rs.getString("columnKey"),
          rs.getString("status"),
          rs.getString("columnFqn"),
          rs.getLong("detectedAt"));
    }
  }

  class RecordIdentityMapper implements RowMapper<RecordIdentity> {
    @Override
    public RecordIdentity map(ResultSet rs, StatementContext context) throws SQLException {
      return new RecordIdentity(
          UUID.fromString(rs.getString("id")), rs.getString("name"), rs.getString("pbv"));
    }
  }
}
