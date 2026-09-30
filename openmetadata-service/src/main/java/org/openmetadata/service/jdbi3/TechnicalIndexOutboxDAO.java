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
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

/**
 * Technical Dictionary records whose search document could not be written after a committed
 * database change. The document is always rebuilt from the database, so one row per record is
 * enough and re-enqueueing only moves its timestamp.
 */
public interface TechnicalIndexOutboxDAO {

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_index_outbox (termId, enqueuedAt, attempts) "
              + "VALUES (:termId, :now, 0) ON DUPLICATE KEY UPDATE enqueuedAt = VALUES(enqueuedAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_index_outbox (termId, enqueuedAt, attempts) "
              + "VALUES (:termId, :now, 0) ON CONFLICT (termId) "
              + "DO UPDATE SET enqueuedAt = EXCLUDED.enqueuedAt",
      connectionType = POSTGRES)
  void enqueue(@Bind("termId") String termId, @Bind("now") long now);

  @SqlQuery(
      "SELECT termId, enqueuedAt, attempts, lastError FROM technical_index_outbox "
          + "ORDER BY enqueuedAt, termId LIMIT :limit")
  @RegisterRowMapper(OutboxEntryMapper.class)
  List<OutboxEntry> listPending(@Bind("limit") int limit);

  @SqlQuery("SELECT COUNT(*) FROM technical_index_outbox")
  long countPending();

  /** Removes processed rows unless they were enqueued again after the batch was read. */
  @SqlUpdate(
      "DELETE FROM technical_index_outbox WHERE termId IN (<termIds>) AND enqueuedAt <= :cutoff")
  int deleteProcessed(@BindList("termIds") List<String> termIds, @Bind("cutoff") long cutoff);

  @SqlUpdate(
      "UPDATE technical_index_outbox SET attempts = attempts + 1, lastError = :lastError "
          + "WHERE termId IN (<termIds>)")
  int markFailed(@BindList("termIds") List<String> termIds, @Bind("lastError") String lastError);

  record OutboxEntry(UUID termId, long enqueuedAt, int attempts, String lastError) {}

  class OutboxEntryMapper implements RowMapper<OutboxEntry> {
    @Override
    public OutboxEntry map(ResultSet rs, StatementContext context) throws SQLException {
      return new OutboxEntry(
          UUID.fromString(rs.getString("termId")),
          rs.getLong("enqueuedAt"),
          rs.getInt("attempts"),
          rs.getString("lastError"));
    }
  }
}
