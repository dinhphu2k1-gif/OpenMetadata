/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tables named by an import sheet. The preview reads the declared records of these tables only,
 * instead of every record of the catalog version.
 */
public final class TechnicalImportTables {
  private static final String KEY_SEPARATOR = "|";

  private TechnicalImportTables() {}

  public record TableLocation(String database, String schema, String table) {}

  /** Distinct table locations in file order; rows without a complete location are skipped. */
  public static List<TableLocation> of(TechnicalImportSheet sheet) {
    final Map<String, TableLocation> locations = new LinkedHashMap<>();
    for (TechnicalImportSheet.Row row : sheet.rows()) {
      final TableLocation location = locationOf(row);
      if (isComplete(location)) {
        locations.putIfAbsent(keyOf(location), location);
      }
    }
    return List.copyOf(locations.values());
  }

  private static TableLocation locationOf(TechnicalImportSheet.Row row) {
    return new TableLocation(
        trimmed(row.value(TechnicalImportPlanner.DATABASE)),
        trimmed(row.value(TechnicalImportPlanner.SCHEMA)),
        trimmed(row.value(TechnicalImportPlanner.TABLE)));
  }

  private static boolean isComplete(TableLocation location) {
    return !location.database().isEmpty()
        && !location.schema().isEmpty()
        && !location.table().isEmpty();
  }

  private static String keyOf(TableLocation location) {
    return String.join(
        KEY_SEPARATOR,
        TechnicalImportPlanner.normalize(location.database()),
        TechnicalImportPlanner.normalize(location.schema()),
        TechnicalImportPlanner.normalize(location.table()));
  }

  private static String trimmed(String value) {
    return value == null ? "" : value.trim();
  }
}
