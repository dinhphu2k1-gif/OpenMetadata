/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TechnicalRowMatcherTest {
  private static final String CDE = UUID.randomUUID().toString();

  private static Map<String, Object> row(String termId, String version, String recordType) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("termId", termId);
    row.put("businessVersion", version);
    row.put("recordType", recordType);
    row.put(TechnicalRowFields.SOURCE_STATUS, "Available");
    row.put("extension", Map.of(TechnicalDictionaryProfile.SOURCE_SERVICE, "IPCAS"));
    return row;
  }

  private static Map<String, Object> mapped(Map<String, Object> row, String cdeId) {
    row.put("relatedTerms", List.of(Map.of("term", Map.of("id", cdeId))));
    return row;
  }

  private static Map<String, List<String>> filters(String key, String value) {
    Map<String, String> raw = new HashMap<>();
    raw.put(key, value);
    return TechnicalRowMatcher.validate(raw);
  }

  @Test
  void defaultsToLatestView() {
    assertTrue(TechnicalRowMatcher.wantsLatest(TechnicalRowMatcher.validate(Map.of())));
    assertFalse(TechnicalRowMatcher.wantsLatest(filters(TechnicalRowMatcher.VERSION_VIEW, "ALL")));
    assertThrows(
        BadRequestException.class, () -> filters(TechnicalRowMatcher.VERSION_VIEW, "NEWEST"));
  }

  @Test
  void filtersBySourceServiceCaseInsensitively() {
    Map<String, Object> ipcas = row("a", "1.0", "published");
    assertTrue(
        TechnicalRowMatcher.matches(
            ipcas, filters(TechnicalRowMatcher.SOURCE_SERVICES, "ipcas,crm")));
    assertFalse(
        TechnicalRowMatcher.matches(ipcas, filters(TechnicalRowMatcher.SOURCE_SERVICES, "crm")));
  }

  @Test
  void filtersByCdeMappingAndCdeId() {
    Map<String, Object> mappedRow = mapped(row("a", "1.0", "published"), CDE);
    Map<String, Object> unmappedRow = row("b", "1.0", "published");
    Map<String, List<String>> mapping = filters(TechnicalRowMatcher.CDE_MAPPING, "UNMAPPED");
    assertFalse(TechnicalRowMatcher.matches(mappedRow, mapping));
    assertTrue(TechnicalRowMatcher.matches(unmappedRow, mapping));
    assertTrue(
        TechnicalRowMatcher.matches(mappedRow, filters(TechnicalRowMatcher.CDE_TERM_IDS, CDE)));
    assertFalse(
        TechnicalRowMatcher.matches(unmappedRow, filters(TechnicalRowMatcher.CDE_TERM_IDS, CDE)));
  }

  @Test
  void filtersBySourceStatus() {
    Map<String, Object> unavailable = row("a", "1.0", "published");
    unavailable.put(TechnicalRowFields.SOURCE_STATUS, "Unavailable");
    Map<String, List<String>> wanted = filters(TechnicalRowMatcher.SOURCE_STATUSES, "Unavailable");
    assertTrue(TechnicalRowMatcher.matches(unavailable, wanted));
    assertFalse(TechnicalRowMatcher.matches(row("b", "1.0", "published"), wanted));
  }

  @Test
  void tagGroupsAreOrWithinAGroupAndAndAcrossGroups() {
    Map<String, Object> row = row("a", "1.0", "published");
    row.put(
        "tags",
        List.of(
            Map.of("tagFQN", "DataTimeliness.T1"),
            Map.of("tagFQN", "DataElementType.AtomicDataElement")));
    Map<String, String> raw = new HashMap<>();
    raw.put(TechnicalRowMatcher.TIMELINESS, "DataTimeliness.T0,DataTimeliness.T1");
    raw.put(TechnicalRowMatcher.ELEMENT_TYPES, "DataElementType.AtomicDataElement");
    assertTrue(TechnicalRowMatcher.matches(row, TechnicalRowMatcher.validate(raw)));

    raw.put(TechnicalRowMatcher.ELEMENT_TYPES, "DataElementType.TransformedDataElement");
    assertFalse(TechnicalRowMatcher.matches(row, TechnicalRowMatcher.validate(raw)));
  }

  @Test
  void tagFiltersMustBelongToTheirClassification() {
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

  @Test
  void keepLatestPicksNewestVersionAndPrefersWorkingOnTies() {
    Map<String, Object> older = row("a", "2.9", "published");
    Map<String, Object> newer = row("a", "2.10", "published");
    Map<String, Object> publishedTie = row("b", "1.0", "published");
    Map<String, Object> workingTie = row("b", "1.0", "working");

    List<Map<String, Object>> latest =
        TechnicalRowMatcher.keepLatest(List.of(older, newer, publishedTie, workingTie));

    assertEquals(2, latest.size());
    assertEquals("2.10", latest.get(0).get("businessVersion"));
    assertEquals("working", latest.get(1).get("recordType"));
  }

  @Test
  void textSearchUsesNormalizedSearchText() {
    Map<String, Object> row = row("a", "1.0", "published");
    row.put(TechnicalRowFields.SEARCH_TEXT, "ipcas customer tên khách hàng");
    assertTrue(TechnicalRowMatcher.matchesText(row, "khách hàng"));
    assertFalse(TechnicalRowMatcher.matchesText(row, "loan"));
  }
}
