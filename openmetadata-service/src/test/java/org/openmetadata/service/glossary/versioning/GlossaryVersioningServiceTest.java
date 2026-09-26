/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

class GlossaryVersioningServiceTest {

  @Test
  void repairArchivesPredecessorAndRebuildsActiveMembershipFromItsOwnScope() {
    GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    UUID glossaryId = UUID.randomUUID();
    PublishedSnapshotRecord active = snapshot("glossary", glossaryId, null, "2");
    PublishedSnapshotRecord predecessor = snapshot("glossary", glossaryId, null, "1");
    PublishedSnapshotRecord v1Term = snapshot("glossaryTerm", UUID.randomUUID(), "1", "1.0");
    PublishedSnapshotRecord v2Term = snapshot("glossaryTerm", UUID.randomUUID(), "2", "2.0");

    when(dao.lockLatestPublished("glossary", glossaryId)).thenReturn(active);
    when(dao.listPublished("glossary", glossaryId)).thenReturn(List.of(active, predecessor));
    when(dao.listActiveLatestTermsForGlossaryAndParent(glossaryId, "2"))
        .thenReturn(List.of(v2Term));
    when(dao.listActiveLatestTermsForGlossaryAndParent(glossaryId, "1"))
        .thenReturn(List.of(v1Term));
    when(dao.listUnarchivedTermSnapshotsForGlossaryAndParent(glossaryId, "1"))
        .thenReturn(List.of(v1Term));
    when(dao.archiveSnapshot(eq(v1Term.snapshotId()), anyLong(), anyString())).thenReturn(1);
    when(dao.archiveSnapshot(eq(predecessor.snapshotId()), anyLong(), anyString())).thenReturn(1);
    when(dao.deletePublishedHead("glossaryTerm", v1Term.entityId(), v1Term.snapshotId()))
        .thenReturn(1);
    when(dao.deletePublishedHead("glossary", glossaryId, predecessor.snapshotId())).thenReturn(1);
    when(dao.updateSnapshotPayload(eq(active.snapshotId()), anyString(), anyString())).thenReturn(1);

    assertTrue(
        GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));

    verify(dao).insertSnapshotTerm(predecessor.snapshotId(), v1Term.snapshotId(), 0);
    verify(dao).insertSnapshotTerm(active.snapshotId(), v2Term.snapshotId(), 0);
    verify(dao).deleteWorkingByGlossaryAndParent("glossaryTerm", glossaryId, "1");
  }

  @Test
  void repairIsNoOpWhenThereIsNoUnarchivedPredecessor() {
    GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    UUID glossaryId = UUID.randomUUID();
    PublishedSnapshotRecord active = snapshot("glossary", glossaryId, null, "2");

    when(dao.lockLatestPublished("glossary", glossaryId)).thenReturn(active);
    when(dao.listPublished("glossary", glossaryId)).thenReturn(List.of(active));

    assertFalse(
        GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));
    verify(dao, never()).deleteSnapshotTerms(active.snapshotId());
  }

  @Test
  void repairRebuildsAnEmptyArchivedManifestFromLatestApprovedSnapshots() {
    GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    UUID glossaryId = UUID.randomUUID();
    PublishedSnapshotRecord active = snapshot("glossary", glossaryId, null, "2");
    PublishedSnapshotRecord archivedV1 = archivedSnapshot("glossary", glossaryId, null, "1");
    UUID termId = UUID.randomUUID();
    PublishedSnapshotRecord older = archivedSnapshot("glossaryTerm", termId, "1", "1.0");
    PublishedSnapshotRecord latest = archivedSnapshot("glossaryTerm", termId, "1", "1.1");

    when(dao.lockLatestPublished("glossary", glossaryId)).thenReturn(active);
    when(dao.listPublished("glossary", glossaryId)).thenReturn(List.of(active, archivedV1));
    when(dao.listSnapshotTerms(archivedV1.snapshotId())).thenReturn(List.of());
    when(dao.listArchivedTermSnapshotsForGlossaryAndParent(glossaryId, "1"))
        .thenReturn(List.of(latest, older));
    when(dao.listActiveLatestTermsForGlossaryAndParent(glossaryId, "2"))
        .thenReturn(List.of());
    when(dao.updateSnapshotPayload(eq(archivedV1.snapshotId()), anyString(), anyString()))
        .thenReturn(1);
    when(dao.updateSnapshotPayload(eq(active.snapshotId()), anyString(), anyString())).thenReturn(1);

    assertTrue(
        GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));

    verify(dao).insertSnapshotTerm(archivedV1.snapshotId(), latest.snapshotId(), 0);
    verify(dao, never()).insertSnapshotTerm(archivedV1.snapshotId(), older.snapshotId(), 0);
  }

  private static PublishedSnapshotRecord snapshot(
      String entityType, UUID entityId, String parentBusinessVersion, String businessVersion) {
    return new PublishedSnapshotRecord(
        UUID.randomUUID(),
        entityType,
        entityId,
        "glossary".equals(entityType) ? null : UUID.randomUUID(),
        parentBusinessVersion,
        businessVersion,
        1.0,
        1,
        "{\"id\":\"" + entityId + "\",\"name\":\"term\",\"entityStatus\":\"Approved\"}",
        "hash",
        1,
        "admin",
        null,
        null);
  }

  private static PublishedSnapshotRecord archivedSnapshot(
      String entityType, UUID entityId, String parentBusinessVersion, String businessVersion) {
    PublishedSnapshotRecord snapshot =
        snapshot(entityType, entityId, parentBusinessVersion, businessVersion);
    return new PublishedSnapshotRecord(
        snapshot.snapshotId(),
        snapshot.entityType(),
        snapshot.entityId(),
        snapshot.glossaryId(),
        snapshot.parentBusinessVersion(),
        snapshot.businessVersion(),
        snapshot.nativeVersion(),
        snapshot.publicationSequence(),
        snapshot.payload(),
        snapshot.contentHash(),
        snapshot.publishedAt(),
        snapshot.publishedBy(),
        2L,
        "admin");
  }
}
