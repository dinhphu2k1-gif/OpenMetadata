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
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.util.jdbi.BindUUID;

/** Read and lock queries over Technical Dictionary published heads. */
public interface TechnicalRecordQueryDAO {

  /** Serializes survivorship decisions of one CDE identity within a transaction. */
  @SqlQuery("SELECT id FROM glossary_term_entity WHERE id = :termId FOR UPDATE")
  String lockTermIdentity(@BindUUID("termId") UUID termId);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT s.entityId AS termId, "
              + "JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.name')) AS columnKey, "
              + "JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.extension.sourceColumnFqn')) AS columnFqn, "
              + "JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.relatedTerms[0].term.id')) AS cdeId, "
              + "JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.extension.survivorshipRank')) AS survivorshipRank "
              + "FROM glossary_published_head h "
              + "JOIN glossary_business_snapshot s ON s.snapshotId = h.snapshotId "
              + "WHERE h.entityType = 'glossaryTerm' AND s.glossaryId = :glossaryId "
              + "AND s.parentBusinessVersion = :pbv AND s.archivedAt IS NULL "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(s.payload, '$.relatedTerms[0].term.id')) IN (<cdeIds>)",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT s.entityId AS termId, s.payload->>'name' AS columnKey, "
              + "s.payload->'extension'->>'sourceColumnFqn' AS columnFqn, "
              + "s.payload->'relatedTerms'->0->'term'->>'id' AS cdeId, "
              + "s.payload->'extension'->>'survivorshipRank' AS survivorshipRank "
              + "FROM glossary_published_head h "
              + "JOIN glossary_business_snapshot s ON s.snapshotId = h.snapshotId "
              + "WHERE h.entityType = 'glossaryTerm' AND s.glossaryId = :glossaryId "
              + "AND s.parentBusinessVersion = :pbv AND s.archivedAt IS NULL "
              + "AND s.payload->'relatedTerms'->0->'term'->>'id' IN (<cdeIds>)",
      connectionType = POSTGRES)
  @RegisterRowMapper(RankedRecordMapper.class)
  List<RankedRecord> listApprovedByCde(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("pbv") String parentBusinessVersion,
      @BindList("cdeIds") List<String> cdeIds);

  record RankedRecord(
      UUID termId, String columnKey, String columnFqn, String cdeId, Integer survivorshipRank) {}

  class RankedRecordMapper implements RowMapper<RankedRecord> {
    @Override
    public RankedRecord map(ResultSet rs, StatementContext context) throws SQLException {
      final String rank = rs.getString("survivorshipRank");
      return new RankedRecord(
          UUID.fromString(rs.getString("termId")),
          rs.getString("columnKey"),
          rs.getString("columnFqn"),
          rs.getString("cdeId"),
          rank == null ? null : Integer.valueOf(rank));
    }
  }
}
