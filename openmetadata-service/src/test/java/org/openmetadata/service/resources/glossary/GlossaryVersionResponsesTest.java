/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.ArchiveReason;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

class GlossaryVersionResponsesTest {
  @Test
  void archivedSnapshotExposesWhyItWasArchivedWhileStayingArchived() {
    final Map<String, Object> payload =
        GlossaryVersionResponses.published(snapshot(2L, ArchiveReason.DELETED.name()));

    assertEquals("Archived", payload.get("entityStatus"));
    assertEquals("DELETED", payload.get("archiveReason"));
    assertEquals("admin", payload.get("archivedBy"));
  }

  @Test
  void publishedSnapshotCarriesNoArchiveFields() {
    final Map<String, Object> payload = GlossaryVersionResponses.published(snapshot(null, null));

    assertFalse(payload.containsKey("archiveReason"));
    assertFalse(payload.containsKey("archivedAt"));
  }

  private static PublishedSnapshotRecord snapshot(final Long archivedAt, final String reason) {
    return new PublishedSnapshotRecord(
        UUID.randomUUID(),
        "glossaryTerm",
        UUID.randomUUID(),
        UUID.randomUUID(),
        "1",
        "1.1",
        1.0,
        1L,
        "{\"name\":\"CDE001\",\"entityStatus\":\"Approved\"}",
        "hash",
        1L,
        "publisher",
        archivedAt,
        archivedAt == null ? null : "admin",
        reason);
  }
}
