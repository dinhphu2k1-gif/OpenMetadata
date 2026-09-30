/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.SourceStateRecord;

/** Operational state of source Columns per Technical Dictionary scope. */
public final class TechnicalSourceStates {

  private TechnicalSourceStates() {}

  public static String statusOf(UUID glossaryId, String parentBusinessVersion, String columnKey) {
    final SourceStateRecord state = dao().findState(glossaryId, parentBusinessVersion, columnKey);
    return state == null ? TechnicalDictionaryProfile.SOURCE_AVAILABLE : state.status();
  }

  /** Column key to status for every Column that is not Available in the scope. */
  public static Map<String, String> statusesOf(UUID glossaryId, String parentBusinessVersion) {
    return dao().listStates(glossaryId, parentBusinessVersion).stream()
        .collect(
            Collectors.toUnmodifiableMap(SourceStateRecord::columnKey, SourceStateRecord::status));
  }

  public static void mark(
      UUID glossaryId,
      String parentBusinessVersion,
      String columnKey,
      String columnFqn,
      String status) {
    dao()
        .upsertState(
            glossaryId,
            parentBusinessVersion,
            columnKey,
            status,
            columnFqn,
            System.currentTimeMillis());
  }

  public static void clear(UUID glossaryId, String parentBusinessVersion, String columnKey) {
    dao().deleteState(glossaryId, parentBusinessVersion, columnKey);
  }

  private static TechnicalSourceStateDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }
}
