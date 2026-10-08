/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.config.RegisterConstructorMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/** Persistence boundary for governed glossary search synchronization. */
public interface GovernedGlossarySearchDAO {
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO governed_glossary_search_outbox (glossaryId, parentBusinessVersion, enqueuedAt) "
              + "VALUES (:glossaryId, :parentBusinessVersion, :enqueuedAt) "
              + "ON DUPLICATE KEY UPDATE enqueuedAt = GREATEST(VALUES(enqueuedAt), enqueuedAt + 1), "
              + "attempts = 0, lastError = NULL",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO governed_glossary_search_outbox (glossaryId, parentBusinessVersion, enqueuedAt) "
              + "VALUES (:glossaryId, :parentBusinessVersion, :enqueuedAt) "
              + "ON CONFLICT (glossaryId, parentBusinessVersion) DO UPDATE SET "
              + "enqueuedAt = GREATEST(EXCLUDED.enqueuedAt, governed_glossary_search_outbox.enqueuedAt + 1), "
              + "attempts = 0, lastError = NULL",
      connectionType = POSTGRES)
  void enqueue(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("enqueuedAt") long enqueuedAt);

  /**
   * Every pending entry, failed ones last. A re-enqueue always moves {@code enqueuedAt} forward, so
   * {@link #deleteProcessed} never drops an entry written while it was being processed.
   */
  @SqlQuery(
      "SELECT glossaryId, parentBusinessVersion, enqueuedAt, attempts, lastError "
          + "FROM governed_glossary_search_outbox "
          + "ORDER BY attempts, enqueuedAt, glossaryId, parentBusinessVersion LIMIT :limit")
  @RegisterConstructorMapper(ScopeEvent.class)
  List<ScopeEvent> listPending(@Bind("limit") int limit);

  /** Entries that have not failed yet; failed ones wait for the worker. */
  @SqlQuery(
      "SELECT glossaryId, parentBusinessVersion, enqueuedAt, attempts, lastError "
          + "FROM governed_glossary_search_outbox WHERE attempts = 0 "
          + "ORDER BY enqueuedAt, glossaryId, parentBusinessVersion LIMIT :limit")
  @RegisterConstructorMapper(ScopeEvent.class)
  List<ScopeEvent> listFresh(@Bind("limit") int limit);

  @SqlUpdate(
      "DELETE FROM governed_glossary_search_outbox WHERE glossaryId = :glossaryId "
          + "AND parentBusinessVersion = :parentBusinessVersion AND enqueuedAt = :enqueuedAt")
  int deleteProcessed(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("enqueuedAt") long enqueuedAt);

  @SqlUpdate(
      "UPDATE governed_glossary_search_outbox SET attempts = attempts + 1, lastError = :lastError "
          + "WHERE glossaryId = :glossaryId AND parentBusinessVersion = :parentBusinessVersion")
  int markFailed(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("lastError") String lastError);

  @SqlQuery("SELECT COUNT(*) FROM governed_glossary_search_outbox")
  long countPending();

  @SqlQuery("SELECT COALESCE(MIN(enqueuedAt), 0) FROM governed_glossary_search_outbox")
  long oldestPendingAt();

  @SqlQuery("SELECT COALESCE(SUM(attempts), 0) FROM governed_glossary_search_outbox")
  long retryCount();

  @SqlQuery(
      "SELECT DISTINCT glossaryId, parentBusinessVersion FROM ("
          + "SELECT glossaryId, parentBusinessVersion FROM glossary_business_working "
          + "WHERE entityType = 'glossaryTerm' AND parentBusinessVersion IS NOT NULL "
          + "UNION SELECT glossaryId, parentBusinessVersion FROM glossary_business_snapshot "
          + "WHERE entityType = 'glossaryTerm' AND parentBusinessVersion IS NOT NULL"
          + ") scopes ORDER BY glossaryId, parentBusinessVersion")
  @RegisterConstructorMapper(ScopeKey.class)
  List<ScopeKey> listScopes();

  record ScopeKey(UUID glossaryId, String parentBusinessVersion) {}

  record ScopeEvent(
      UUID glossaryId,
      String parentBusinessVersion,
      long enqueuedAt,
      int attempts,
      String lastError) {}
}
