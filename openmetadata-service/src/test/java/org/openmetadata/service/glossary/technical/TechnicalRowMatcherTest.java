/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TechnicalRowMatcherTest {
  private static final String CDE = "8c7d1a52-9f0e-4b6c-8a0e-8d5a7a3f9d11";

  private static Map<String, List<String>> filters(String key, String value) {
    Map<String, String> raw = new HashMap<>();
    raw.put(key, value);
    return TechnicalRowMatcher.validate(raw);
  }

  @Test
  void emptyRequestHasNoFiltersAndNoVersionView() {
    Map<String, List<String>> filters = TechnicalRowMatcher.validate(Map.of());
    assertEquals(Map.of(), filters);
    assertFalse(filters.containsKey("versionView"));
  }

  @Test
  void servicesAreLowercasedAndUuidsNormalized() {
    assertEquals(
        List.of("ipcas", "crm"),
        filters(TechnicalRowMatcher.SOURCE_SERVICES, "IPCAS,Crm").get("sourceServices"));
    assertEquals(
        List.of(CDE),
        filters(TechnicalRowMatcher.CDE_TERM_IDS, CDE.toUpperCase()).get("cdeTermIds"));
  }

  @Test
  void tagFiltersMustBelongToTheirClassification() {
    assertEquals(
        List.of("DataTimeliness.T0"),
        filters(TechnicalRowMatcher.TIMELINESS, "DataTimeliness.T0").get("timeliness"));
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.TIMELINESS, "PII.Sensitive"));
  }

  @Test
  void rejectsMalformedValues() {
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.CDE_TERM_IDS, "not-a-uuid"));
    assertThrows(BadRequestException.class, () -> filters(TechnicalRowMatcher.CDE_MAPPING, "SOME"));
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.SOURCE_SERVICES, "a,,b"));
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.SOURCE_SERVICES, "a,a"));
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.SOURCE_STATUSES, "Gone"));
  }
}
