/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/**
 * Persistence boundary for the read state of notifications. Both marks only ever move forward, so
 * a stale request can never turn a read notification back into an unread one.
 */
public interface NotificationReadDAO {
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO notification_read (userId, threadId, readAt) "
              + "VALUES (:userId, :threadId, :readAt) "
              + "ON DUPLICATE KEY UPDATE readAt = GREATEST(VALUES(readAt), readAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO notification_read (userId, threadId, readAt) "
              + "VALUES (:userId, :threadId, :readAt) "
              + "ON CONFLICT (userId, threadId) DO UPDATE SET "
              + "readAt = GREATEST(EXCLUDED.readAt, notification_read.readAt)",
      connectionType = POSTGRES)
  void markRead(
      @BindUUID("userId") UUID userId,
      @BindUUID("threadId") UUID threadId,
      @Bind("readAt") long readAt);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO notification_read_all (userId, readAllBefore) "
              + "VALUES (:userId, :readAllBefore) "
              + "ON DUPLICATE KEY UPDATE readAllBefore = GREATEST(VALUES(readAllBefore), readAllBefore)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO notification_read_all (userId, readAllBefore) "
              + "VALUES (:userId, :readAllBefore) "
              + "ON CONFLICT (userId) DO UPDATE SET "
              + "readAllBefore = GREATEST(EXCLUDED.readAllBefore, notification_read_all.readAllBefore)",
      connectionType = POSTGRES)
  void markAllReadBefore(
      @BindUUID("userId") UUID userId, @Bind("readAllBefore") long readAllBefore);

  /** Drops the single marks the user's read-all mark already covers. */
  @SqlUpdate(
      "DELETE FROM notification_read WHERE userId = :userId AND readAt <= "
          + "(SELECT readAllBefore FROM notification_read_all WHERE userId = :userId)")
  int deleteCoveredByReadAll(@BindUUID("userId") UUID userId);

  @SqlUpdate("DELETE FROM notification_read WHERE threadId IN (<threadIds>)")
  int deleteByThreads(@BindList("threadIds") List<String> threadIds);
}
