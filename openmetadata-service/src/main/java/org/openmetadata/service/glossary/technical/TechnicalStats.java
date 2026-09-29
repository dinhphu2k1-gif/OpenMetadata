/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.openmetadata.service.util.FullyQualifiedName;

/** Header statistics of one Technical Dictionary catalog version over its visible latest rows. */
public final class TechnicalStats {
  private TechnicalStats() {}

  public static Map<String, Long> of(List<Map<String, Object>> latestRows) {
    final Map<String, Long> stats = new LinkedHashMap<>();
    stats.put("totalColumns", (long) latestRows.size());
    stats.put("totalTables", distinctCount(latestRows, TechnicalStats::tableOf));
    stats.put(
        "mappedCde",
        latestRows.stream().filter(row -> TechnicalRowFields.cdeId(row) != null).count());
    stats.put(
        "totalSources",
        distinctCount(
            latestRows,
            row ->
                TechnicalRowFields.extensionText(row, TechnicalDictionaryProfile.SOURCE_SERVICE)));
    return stats;
  }

  private static String tableOf(Map<String, Object> row) {
    final String columnFqn =
        TechnicalRowFields.extensionText(row, TechnicalDictionaryProfile.SOURCE_COLUMN_FQN);
    return columnFqn.isEmpty() ? "" : FullyQualifiedName.getParentFQN(columnFqn);
  }

  private static long distinctCount(
      List<Map<String, Object>> rows, Function<Map<String, Object>, String> key) {
    return rows.stream()
        .map(key)
        .filter(Objects::nonNull)
        .filter(value -> !value.isEmpty())
        .distinct()
        .count();
  }
}
