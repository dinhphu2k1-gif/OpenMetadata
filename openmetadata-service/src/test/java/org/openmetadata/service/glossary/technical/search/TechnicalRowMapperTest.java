/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TechnicalRowMapperTest {
  private static final String TERM_ID = "22222222-2222-2222-2222-222222222222";
  private static final String CDE_ID = "33333333-3333-3333-3333-333333333333";

  private static Map<String, Object> document() {
    final Map<String, Object> document = new LinkedHashMap<>();
    document.put("termId", TERM_ID);
    document.put("glossaryId", "g");
    document.put("parentBusinessVersion", "2");
    document.put("columnKey", "column-key");
    document.put("columnFqn", "MIS.MISDB.aml.TBMS_CTR.brcd");
    document.put("service", "MIS");
    document.put("database", "MISDB");
    document.put("schema", "aml");
    document.put("table", "TBMS_CTR");
    document.put("column", "brcd");
    document.put("dataType", "VARCHAR");
    document.put("dataLength", 20);
    document.put("displayName", "brcd");
    document.put("description", "Mã chi nhánh");
    document.put("sourceStatus", "Changed");
    document.put("hasPublished", true);
    document.put("current", currentView());
    document.put("published", Map.of("recordType", "published", "entityStatus", "Approved", "businessVersion", "2.0", "snapshotId", "snap-1"));
    return document;
  }

  private static Map<String, Object> currentView() {
    final Map<String, Object> view = new LinkedHashMap<>();
    view.put("recordType", "working");
    view.put("entityStatus", "Draft");
    view.put("businessVersion", "2.1");
    view.put("releaseVersionType", "Bản phụ");
    view.put("workingRevision", 4);
    view.put(
        "cde",
        Map.of(
            "id", CDE_ID,
            "code", "CDE_001",
            "name", "Mã chi nhánh",
            "businessVersion", "2.3",
            "snapshotId", "cde-snap",
            "parentBusinessVersion", "2"));
    view.put("dataOwners", List.of(Map.of("id", "owner-1", "type", "user", "name", "an")));
    view.put("rank", 1);
    view.put("elementType", Map.of("fqn", "DataElementType.Atomic", "label", "Thành tố gốc", "name", "Atomic"));
    view.put("systemOwner", Map.of("id", "team-1", "type", "team", "name", "it"));
    view.put("updatedAt", 1_700_000_000_000L);
    view.put("updatedBy", "admin");
    return view;
  }

  @Test
  @SuppressWarnings("unchecked")
  void currentViewKeepsTheFlatRowShapeOfThePage() {
    final Map<String, Object> row = TechnicalRowMapper.toRow(document(), TechnicalIndexFields.CURRENT);
    assertEquals(TERM_ID, row.get("termId"));
    assertEquals(TERM_ID, row.get("id"));
    assertEquals("column-key", row.get("name"));
    assertEquals("2.1", row.get("businessVersion"));
    assertEquals("2", row.get("parentBusinessVersion"));
    assertEquals("Draft", row.get("entityStatus"));
    assertEquals("working", row.get("recordType"));
    assertEquals(4, row.get("workingRevision"));
    assertEquals("Changed", row.get("sourceStatus"));
    assertEquals("CDE_001", row.get("cdeCode"));
    assertEquals("Mã chi nhánh", row.get("cdeName"));
    assertEquals(true, row.get("hasPublished"));
    final Map<String, Object> extension = (Map<String, Object>) row.get("extension");
    assertEquals("MIS.MISDB.aml.TBMS_CTR.brcd", extension.get("sourceColumnFqn"));
    assertEquals("MISDB", extension.get("sourceDatabase"));
    assertEquals(20, extension.get("sourceDataLength"));
    assertEquals(1, extension.get("survivorshipRank"));
    assertEquals("Bản phụ", extension.get("releaseVersionType"));
    assertEquals("team-1", ((Map<String, Object>) extension.get("systemOwner")).get("id"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void cdeBecomesAPinnedRelationAndClassificationsBecomeTags() {
    final Map<String, Object> row = TechnicalRowMapper.toRow(document(), TechnicalIndexFields.CURRENT);
    final Map<String, Object> relation = ((List<Map<String, Object>>) row.get("relatedTerms")).getFirst();
    final Map<String, Object> term = (Map<String, Object>) relation.get("term");
    final Map<String, Object> context = (Map<String, Object>) relation.get("versionContext");
    assertEquals(CDE_ID, term.get("id"));
    assertEquals("glossaryTerm", term.get("type"));
    assertEquals("2.3", context.get("businessVersion"));
    assertEquals("cde-snap", context.get("snapshotId"));
    final List<Map<String, Object>> tags = (List<Map<String, Object>>) row.get("tags");
    assertEquals(1, tags.size());
    assertEquals("DataElementType.Atomic", tags.getFirst().get("tagFQN"));
    assertEquals("Thành tố gốc", tags.getFirst().get("displayName"));
    assertEquals("Classification", tags.getFirst().get("source"));
    assertEquals(1, ((List<?>) row.get("dataOwners")).size());
  }

  @Test
  void publishedViewIsReadForConsumersWithoutWorkingData() {
    final Map<String, Object> row = TechnicalRowMapper.toRow(document(), TechnicalIndexFields.PUBLISHED);
    assertEquals("Approved", row.get("entityStatus"));
    assertEquals("published", row.get("recordType"));
    assertEquals("snap-1", row.get("snapshotId"));
    assertFalse(row.containsKey("workingRevision"));
    assertEquals("", row.get("cdeCode"));
    assertTrue(((List<?>) row.get("relatedTerms")).isEmpty());
  }

  @Test
  void fallsBackToTheCurrentViewWhenTheRecordWasNeverApproved() {
    final Map<String, Object> document = document();
    document.remove("published");
    document.put("hasPublished", false);
    final Map<String, Object> row = TechnicalRowMapper.toRow(document, TechnicalIndexFields.PUBLISHED);
    assertEquals("Draft", row.get("entityStatus"));
    assertEquals(false, row.get("hasPublished"));
  }
}
