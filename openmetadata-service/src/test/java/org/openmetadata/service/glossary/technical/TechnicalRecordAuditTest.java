/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TechnicalRecordAuditTest {
  private static TechnicalRecord record() {
    return TechnicalImportTestSupport.record("T", "NAME");
  }

  private static Map<String, Object> change(List<Map<String, Object>> changes, String field) {
    return changes.stream()
        .filter(entry -> field.equals(entry.get("field")))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void listsOnlyTheFieldsThatDiffer() {
    TechnicalRecord after =
        TechnicalImportTestSupport.withCde(record(), 2).toBuilder()
            .timeliness("DataTimeliness.T1")
            .build();

    List<Map<String, Object>> changes = TechnicalRecordAudit.changes(record(), after);

    assertEquals(3, changes.size());
    assertEquals(null, change(changes, "rank").get("oldValue"));
    assertEquals("2", change(changes, "rank").get("newValue"));
    assertEquals("DataTimeliness.T1", change(changes, "timeliness").get("newValue"));
    assertEquals(
        TechnicalImportTestSupport.CDE_ID.toString(), change(changes, "cde").get("newValue"));
  }

  @Test
  void aClearedValueHasNoNewValue() {
    TechnicalRecord before = TechnicalImportTestSupport.withCde(record(), 2);

    List<Map<String, Object>> changes = TechnicalRecordAudit.changes(before, record());

    assertEquals("2", change(changes, "rank").get("oldValue"));
    assertEquals(null, change(changes, "rank").get("newValue"));
  }

  @Test
  void approvalAndRejectionMetadataAreAudited() {
    TechnicalRecord reviewed =
        record().toBuilder()
            .status(TechnicalRecord.STATUS_REJECTED)
            .reviewedAt(123L)
            .reviewedBy("checker")
            .reviewComment("Missing evidence")
            .build();

    List<Map<String, Object>> changes = TechnicalRecordAudit.changes(record(), reviewed);

    assertEquals("Rejected", change(changes, "status").get("newValue"));
    assertEquals("checker", change(changes, "reviewedBy").get("newValue"));
    assertEquals("Missing evidence", change(changes, "reviewComment").get("newValue"));
  }

  @Test
  void aCreationListsEveryValueAndNoChangeListsNothing() {
    assertTrue(TechnicalRecordAudit.changes(record(), record()).isEmpty());
    assertEquals(
        "Available",
        change(TechnicalRecordAudit.changes(null, record()), "sourceStatus").get("newValue"));
  }
}
