/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TechnicalStatsTest {
  private static Map<String, Object> row(String service, String columnFqn, boolean mapped) {
    return mapped
        ? Map.of(
            "extension",
            Map.of(
                TechnicalDictionaryProfile.SOURCE_SERVICE, service,
                TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, columnFqn),
            "relatedTerms",
            List.of(Map.of("term", Map.of("id", UUID.randomUUID().toString()))))
        : Map.of(
            "extension",
            Map.of(
                TechnicalDictionaryProfile.SOURCE_SERVICE, service,
                TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, columnFqn));
  }

  @Test
  void countsColumnsDistinctTablesMappedAndSources() {
    Map<String, Long> stats =
        TechnicalStats.of(
            List.of(
                row("ipcas", "ipcas.core.dbo.customer.name", true),
                row("ipcas", "ipcas.core.dbo.customer.id", false),
                row("crm", "crm.core.dbo.contact.name", true)));

    assertEquals(3L, stats.get("totalColumns"));
    assertEquals(2L, stats.get("totalTables"));
    assertEquals(2L, stats.get("mappedCde"));
    assertEquals(2L, stats.get("totalSources"));
  }

  @Test
  void emptyScopeYieldsZeros() {
    assertEquals(0L, TechnicalStats.of(List.of()).get("totalColumns"));
  }
}
