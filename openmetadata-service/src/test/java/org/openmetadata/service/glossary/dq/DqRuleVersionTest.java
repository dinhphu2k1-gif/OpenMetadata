/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

class DqRuleVersionTest {
  private static final UUID RULE_ID = UUID.randomUUID();

  private static PublishedSnapshotRecord snapshot(
      String businessVersion, long sequence, long publishedAt, Long archivedAt) {
    return new PublishedSnapshotRecord(
        UUID.randomUUID(),
        "glossaryTerm",
        RULE_ID,
        UUID.randomUUID(),
        "1",
        businessVersion,
        null,
        sequence,
        "{\"name\":\"DQ4.3\"}",
        "hash",
        publishedAt,
        "user",
        archivedAt,
        null,
        null);
  }

  @Test
  void replacedVersionEndsWhenTheNextVersionIsPublished() {
    final PublishedSnapshotRecord first = snapshot("1.0", 1, 100L, null);
    final PublishedSnapshotRecord second = snapshot("1.1", 2, 500L, null);

    final DqRuleVersion version =
        DqRuleVersion.replaced(first, List.of(first, second)).orElseThrow();

    assertEquals("1.0", version.context().businessVersion());
    assertEquals(100L, version.appliedFrom());
    assertEquals(500L, version.appliedUntil());
  }

  @Test
  void archivedVersionEndsWhenItWasArchived() {
    final PublishedSnapshotRecord archived = snapshot("1.0", 1, 100L, 300L);

    final DqRuleVersion version = DqRuleVersion.replaced(archived, List.of(archived)).orElseThrow();

    assertEquals(300L, version.appliedUntil());
  }

  @Test
  void appliedVersionIsNotReplaced() {
    final PublishedSnapshotRecord first = snapshot("1.0", 1, 100L, null);
    final PublishedSnapshotRecord latest = snapshot("1.1", 2, 500L, null);

    assertTrue(DqRuleVersion.replaced(latest, List.of(first, latest)).isEmpty());
  }

  @Test
  void bindingCountsWhenItWasActiveDuringThePeriod() {
    final DqRuleVersion version =
        DqRuleVersion.replaced(
                snapshot("1.0", 1, 100L, null),
                List.of(snapshot("1.0", 1, 100L, null), snapshot("1.1", 2, 500L, null)))
            .orElseThrow();

    assertTrue(version.coversBinding(100L, 500L));
    assertTrue(version.coversBinding(50L, null));
    assertFalse(version.coversBinding(600L, null));
    assertFalse(version.coversBinding(10L, 90L));
  }
}
