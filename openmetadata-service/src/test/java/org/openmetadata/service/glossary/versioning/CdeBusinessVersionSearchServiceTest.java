/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.versioning.CdeBusinessVersionSearchService.Criteria;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

class CdeBusinessVersionSearchServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void validatesAndNormalizesVietnameseLiteralQuery() {
    Criteria validated =
        CdeBusinessVersionSearchService.validate(
            criteria("  Dữ liệu * ?  ", List.of("Draft", "Approved")), false);

    assertEquals("Dữ liệu * ?", validated.q());
    assertEquals(List.of("Draft", "Approved"), validated.statuses());
    String query = CdeBusinessVersionSearchService.buildLiteralTextQuery(validated.q());
    assertTrue(query.contains("Dữ liệu * ?"));
    assertFalse(query.contains("wildcard"));
  }

  @Test
  void consumerCanNeverWidenApprovedProjectionWithStatuses() {
    Criteria validated =
        CdeBusinessVersionSearchService.validate(
            criteria("cde", List.of("Draft", "Approved")), true);

    assertEquals(List.of("Approved"), validated.statuses());
    String filter = CdeBusinessVersionSearchService.buildFilter(validated, true);
    assertTrue(filter.contains("Approved"));
    assertFalse(filter.contains("Draft"));
    assertTrue(filter.contains("active"));
  }

  @Test
  void consumerArchivedScopeIsRestrictedToArchivedProjection() {
    Criteria validated =
        CdeBusinessVersionSearchService.validate(
            criteria("cde", List.of("Draft", "Approved")), true, true);

    assertEquals(List.of("Archived"), validated.statuses());
    String filter = CdeBusinessVersionSearchService.buildFilter(validated, true, true);
    assertTrue(filter.contains("Archived"));
    assertTrue(filter.contains("archived"));
    assertFalse(filter.contains("Draft"));
  }

  @Test
  void rejectsNonCanonicalAndMalformedCriteria() {
    assertThrows(
        BadRequestException.class,
        () ->
            CdeBusinessVersionSearchService.validate(
                new Criteria(
                    GLOSSARY_ID,
                    "01",
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    null,
                    null,
                    10,
                    0),
                false));
    assertThrows(
        BadRequestException.class,
        () ->
            CdeBusinessVersionSearchService.validate(
                criteria(null, List.of("Draft", "Draft")), false));
    assertThrows(
        BadRequestException.class,
        () ->
            CdeBusinessVersionSearchService.validate(
                new Criteria(
                    GLOSSARY_ID,
                    "1",
                    null,
                    List.of(),
                    List.of("not-a-uuid"),
                    List.of(),
                    List.of(),
                    List.of(),
                    null,
                    null,
                    10,
                    0),
                false));
  }

  @Test
  void documentIdentityIncludesEveryBusinessVersionSegment() {
    UUID termId = UUID.randomUUID();
    PublishedSnapshotRecord v10 = snapshot(termId, "1.0");
    PublishedSnapshotRecord v11 = snapshot(termId, "1.1");

    var first = CdeBusinessVersionIndexDocument.published(v10);
    var repeated = CdeBusinessVersionIndexDocument.published(v10);
    var next = CdeBusinessVersionIndexDocument.published(v11);

    assertEquals(first.id(), repeated.id());
    assertNotEquals(first.id(), next.id());
    assertEquals("1.0", first.source().get("businessVersion"));
    assertEquals(termId.toString(), first.source().get("termId"));
  }

  @Test
  void archivedDocumentHasArchivedScopeAndPresentationStatus() {
    PublishedSnapshotRecord archived = archivedSnapshot(UUID.randomUUID(), "1.0");

    var document = CdeBusinessVersionIndexDocument.published(archived).source();

    assertEquals("archived", document.get("scopeType"));
    assertEquals("archived", document.get("recordType"));
    assertEquals("Archived", document.get("entityStatus"));
  }

  @Test
  void numericVersionSortKeySortsSegmentsNumerically() {
    assertTrue(
        CdeBusinessVersionIndexDocument.businessVersionSortKey("1.11")
                .compareTo(CdeBusinessVersionIndexDocument.businessVersionSortKey("1.9"))
            > 0);
    assertTrue(
        CdeBusinessVersionIndexDocument.businessVersionSortKey("1.10")
                .compareTo(CdeBusinessVersionIndexDocument.businessVersionSortKey("1.2"))
            > 0);
  }

  @Test
  void missingCustomSortUsesDefaultWithoutLookingUpANullMapKey() {
    assertEquals(
        "cdeSort.normalizedName", CdeBusinessVersionSearchService.resolveSortField(null));
    assertEquals(
        "cdeSort.businessVersion",
        CdeBusinessVersionSearchService.resolveSortField("businessVersion"));
  }

  private static Criteria criteria(String q, List<String> statuses) {
    return new Criteria(
        GLOSSARY_ID,
        "1",
        q,
        statuses,
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        null,
        null,
        10,
        0);
  }

  private static PublishedSnapshotRecord snapshot(UUID termId, String version) {
    return snapshot(termId, version, null);
  }

  private static PublishedSnapshotRecord archivedSnapshot(UUID termId, String version) {
    return snapshot(termId, version, 2L);
  }

  private static PublishedSnapshotRecord snapshot(UUID termId, String version, Long archivedAt) {
    String payload =
        JsonUtils.pojoToJson(
            Map.of(
                "id", termId,
                "name", "CDE1",
                "displayName", "Dữ liệu 1",
                "entityStatus", "Approved"));
    return new PublishedSnapshotRecord(
        UUID.randomUUID(),
        "glossaryTerm",
        termId,
        GLOSSARY_ID,
        "1",
        version,
        1.0,
        1,
        payload,
        "hash",
        1,
        "admin",
        archivedAt,
        archivedAt == null ? null : "admin");
  }
}
