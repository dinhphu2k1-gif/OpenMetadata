/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

class GlossaryVersioningServiceTest {

  @Test
  void latestApprovedRelationStaysInScopeAndUsesNumericVersionOrder() {
    UUID entityId = UUID.randomUUID();
    PublishedSnapshotRecord otherScope = snapshot("glossaryTerm", entityId, "3", "3.9");
    PublishedSnapshotRecord v29 = snapshot("glossaryTerm", entityId, "2", "2.9");
    PublishedSnapshotRecord v210 = snapshot("glossaryTerm", entityId, "2", "2.10");

    PublishedSnapshotRecord selected =
        GlossaryVersioningService.selectLatestPublishedInScope(List.of(otherScope, v29, v210), "2");

    assertEquals(v210.snapshotId(), selected.snapshotId());
  }

  @Test
  void latestApprovedRelationNeverFallsBackToAnotherScope() {
    UUID entityId = UUID.randomUUID();
    PublishedSnapshotRecord otherScope = snapshot("glossaryTerm", entityId, "3", "3.0");

    assertThrows(
        NotFoundException.class,
        () -> GlossaryVersioningService.selectLatestPublishedInScope(List.of(otherScope), "2"));
  }

  @Test
  void latestApprovedRelationPrefersActivePredecessorOverRevokedSnapshot() {
    UUID entityId = UUID.randomUUID();
    PublishedSnapshotRecord active = snapshot("glossaryTerm", entityId, "2", "2.1");
    PublishedSnapshotRecord revoked = archivedSnapshot("glossaryTerm", entityId, "2", "2.2");

    PublishedSnapshotRecord selected =
        GlossaryVersioningService.selectLatestPublishedInScope(List.of(active, revoked), "2");

    assertEquals(active.snapshotId(), selected.snapshotId());
  }

  @Test
  void latestApprovedRelationUsesNewestArchivedSnapshotForFrozenScope() {
    UUID entityId = UUID.randomUUID();
    PublishedSnapshotRecord v20 = archivedSnapshot("glossaryTerm", entityId, "2", "2.0");
    PublishedSnapshotRecord v21 = archivedSnapshot("glossaryTerm", entityId, "2", "2.1");

    PublishedSnapshotRecord selected =
        GlossaryVersioningService.selectLatestPublishedInScope(List.of(v20, v21), "2");

    assertEquals(v21.snapshotId(), selected.snapshotId());
  }

  @Test
  void catalogApprovalPublishesEveryWorkingRecordRegardlessOfRecordStatus() {
    GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    UUID glossaryId = UUID.randomUUID();
    WorkingVersionRecord draft = working(glossaryId, "2", "2.0", "Draft");
    WorkingVersionRecord rejected = working(glossaryId, "2", "2.1", "Rejected");

    when(dao.listWorkingByGlossaryAndParent("glossaryTerm", glossaryId, "2"))
        .thenReturn(List.of(draft, rejected));
    when(dao.nextPublicationSequence(eq("glossaryTerm"), any(UUID.class))).thenReturn(1L);
    when(dao.deleteWorking(eq("glossaryTerm"), any(UUID.class), eq("2"), anyLong())).thenReturn(1);

    List<PublishedSnapshotRecord> published =
        GlossaryVersioningService.publishWorkingTerms(dao, glossaryId, "2", "reviewer");

    assertEquals(2, published.size());
    assertTrue(
        published.stream()
            .allMatch(row -> row.payload().contains("\"entityStatus\":\"Approved\"")));
    verify(dao, times(2))
        .insertSnapshot(
            any(UUID.class),
            eq("glossaryTerm"),
            any(UUID.class),
            eq(glossaryId),
            eq("2"),
            anyString(),
            eq(1.0),
            eq(1L),
            anyString(),
            anyString(),
            anyLong(),
            eq("reviewer"));
    verify(dao).deleteWorking("glossaryTerm", draft.entityId(), "2", draft.revision());
    verify(dao).deleteWorking("glossaryTerm", rejected.entityId(), "2", rejected.revision());
    verify(dao, times(2))
        .upsertPublishedHead(eq("glossaryTerm"), any(UUID.class), eq("2"), any(UUID.class), eq(1L));
    verify(dao, times(2))
        .insertOutbox(
            any(UUID.class),
            any(UUID.class),
            eq(GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT),
            anyString(),
            anyLong());
  }

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
    when(dao.updateSnapshotPayload(eq(active.snapshotId()), anyString(), anyString()))
        .thenReturn(1);

    assertTrue(GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));

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

    assertFalse(GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));
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
    when(dao.listActiveLatestTermsForGlossaryAndParent(glossaryId, "2")).thenReturn(List.of());
    when(dao.updateSnapshotPayload(eq(archivedV1.snapshotId()), anyString(), anyString()))
        .thenReturn(1);
    when(dao.updateSnapshotPayload(eq(active.snapshotId()), anyString(), anyString()))
        .thenReturn(1);

    assertTrue(GlossaryVersioningService.repairDataDictionaryCutover(dao, glossaryId, "admin"));

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

  private static WorkingVersionRecord working(
      UUID glossaryId, String parentBusinessVersion, String businessVersion, String status) {
    UUID entityId = UUID.randomUUID();
    return new WorkingVersionRecord(
        UUID.randomUUID(),
        "glossaryTerm",
        entityId,
        glossaryId,
        parentBusinessVersion,
        businessVersion,
        status,
        3,
        1.0,
        "{\"id\":\"" + entityId + "\",\"name\":\"term\",\"entityStatus\":\"" + status + "\"}",
        1,
        "author",
        1,
        "author",
        null,
        null,
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
