/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.ArchiveReason;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

class GlossaryTermDeletionTest {
  @Test
  void createsDeletionRequestAlreadySubmittedForReview() {
    GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    PublishedSnapshotRecord published = mock(PublishedSnapshotRecord.class);
    WorkingVersionRecord inReview = mock(WorkingVersionRecord.class);
    UUID entityId = UUID.randomUUID();
    UUID glossaryId = UUID.randomUUID();

    when(dao.findLatestPublishedByParent(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
        .thenReturn(published);
    when(dao.lockGlossaryIdentity(glossaryId)).thenReturn(glossaryId.toString());
    when(dao.lockLatestPublishedByParent(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
        .thenReturn(published);
    when(published.glossaryId()).thenReturn(glossaryId);
    when(published.businessVersion()).thenReturn("1.0");
    when(published.payload()).thenReturn("{}");
    when(published.archivedAt()).thenReturn(null);
    when(dao.transitionWorking(
            eq(GlossaryVersioningService.GLOSSARY_TERM),
            eq(entityId),
            eq("1"),
            eq(1L),
            eq(EntityStatus.DRAFT.value()),
            eq(EntityStatus.IN_REVIEW.value()),
            eq(EntityStatus.IN_REVIEW.value()),
            eq(EntityStatus.REJECTED.value()),
            anyLong(),
            eq("maker")))
        .thenReturn(1);
    when(dao.findWorking(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
        .thenReturn(null, inReview);

    WorkingVersionRecord result =
        GlossaryTermDeletion.createWorking(
            dao,
            new GlossaryTermDeletion.DeletionRequest(entityId, "1", null, "maker", ignored -> {}));

    assertSame(inReview, result);
    verify(dao)
        .insertWorking(
            any(UUID.class),
            eq(GlossaryVersioningService.GLOSSARY_TERM),
            eq(entityId),
            eq(glossaryId),
            eq("1"),
            eq("1.0"),
            eq(EntityStatus.DRAFT.value()),
            any(),
            any(String.class),
            anyLong(),
            eq("maker"));
  }

  @Test
  void deletingTheOnlyVersionDeletesTheRuleAndQueuesReconciliation() {
    final Handle handle = mock(Handle.class);
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final DqRuleTestDAO dqDao = mock(DqRuleTestDAO.class);
    final PublishedSnapshotRecord current;
    final PublishedSnapshotRecord otherScope = mock(PublishedSnapshotRecord.class);
    final WorkingVersionRecord working = mock(WorkingVersionRecord.class);
    final UUID ruleId = UUID.randomUUID();
    final UUID snapshotId = UUID.randomUUID();

    when(working.entityId()).thenReturn(ruleId);
    when(working.parentBusinessVersion()).thenReturn("2");
    when(working.businessVersion()).thenReturn("2.1");
    when(working.revision()).thenReturn(7L);
    current =
        new PublishedSnapshotRecord(
            snapshotId,
            GlossaryVersioningService.GLOSSARY_TERM,
            ruleId,
            UUID.randomUUID(),
            "2",
            "2.1",
            1.0,
            3L,
            "{\"glossary\":{\"name\":\"Data Quality\"},\"name\":\"DQ1\"}",
            "hash",
            1L,
            "publisher",
            null,
            null,
            null);
    when(otherScope.parentBusinessVersion()).thenReturn("1");
    when(dao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, ruleId))
        .thenReturn(List.of(current, otherScope));
    when(dao.archiveSnapshot(eq(snapshotId), anyLong(), eq("checker"), any())).thenReturn(1);
    when(dao.deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "2", 7L)).thenReturn(1);
    when(handle.attach(DqRuleTestDAO.class)).thenReturn(dqDao);

    GlossaryTermDeletion.apply(handle, dao, working, "checker");

    verify(dao)
        .archiveSnapshot(eq(snapshotId), anyLong(), eq("checker"), eq(ArchiveReason.DELETED));
    verify(dao).deletePublishedHead(GlossaryVersioningService.GLOSSARY_TERM, ruleId, snapshotId);
    verify(dao)
        .insertOutbox(
            any(UUID.class),
            eq(snapshotId),
            eq(GlossaryVersioningService.SNAPSHOT_ARCHIVE_EVENT),
            any(),
            anyLong());
    verify(dqDao).enqueue(eq("RECONCILE_RULE"), eq(ruleId.toString()), eq(null), anyLong());
    verify(dao).deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "2", 7L);
    verify(dao, never()).upsertPublishedHead(any(), any(), any(), any(), anyLong());
  }

  @Test
  void deletingTheEffectiveVersionMakesThePreviousOneEffectiveAgain() {
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final UUID ruleId = UUID.randomUUID();
    final PublishedSnapshotRecord previous = snapshot(ruleId, "1.0", 1L);
    final PublishedSnapshotRecord effective = snapshot(ruleId, "1.1", 2L);
    final WorkingVersionRecord working = deletionOf(ruleId, "1.1");
    when(dao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, ruleId))
        .thenReturn(List.of(effective, previous));
    when(dao.archiveSnapshot(eq(effective.snapshotId()), anyLong(), eq("checker"), any()))
        .thenReturn(1);
    when(dao.deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "1", 7L)).thenReturn(1);

    final PublishedSnapshotRecord deleted =
        GlossaryTermDeletion.apply(mock(Handle.class), dao, working, "checker");

    assertEquals("1.1", deleted.businessVersion());
    verify(dao, never()).archiveSnapshot(eq(previous.snapshotId()), anyLong(), any(), any());
    verify(dao)
        .upsertPublishedHead(
            GlossaryVersioningService.GLOSSARY_TERM, ruleId, "1", previous.snapshotId(), 1L);
    verify(dao)
        .requeueOutbox(
            eq(previous.snapshotId()),
            eq(GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT),
            eq(previous.payload()),
            anyLong());
  }

  @Test
  void restoredVersionReusesItsExistingOutboxRow() {
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final UUID ruleId = UUID.randomUUID();
    final PublishedSnapshotRecord previous = snapshot(ruleId, "1.0", 1L);
    final PublishedSnapshotRecord effective = snapshot(ruleId, "1.1", 2L);
    when(dao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, ruleId))
        .thenReturn(List.of(effective, previous));
    when(dao.archiveSnapshot(eq(effective.snapshotId()), anyLong(), eq("checker"), any()))
        .thenReturn(1);
    when(dao.deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "1", 7L)).thenReturn(1);
    when(dao.requeueOutbox(
            eq(previous.snapshotId()),
            eq(GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT),
            any(),
            anyLong()))
        .thenReturn(1);

    GlossaryTermDeletion.apply(mock(Handle.class), dao, deletionOf(ruleId, "1.1"), "checker");

    verify(dao, never())
        .insertOutbox(
            any(UUID.class),
            eq(previous.snapshotId()),
            eq(GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT),
            any(),
            anyLong());
  }

  @Test
  void deletingAnOlderVersionKeepsTheEffectiveOne() {
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final UUID ruleId = UUID.randomUUID();
    final PublishedSnapshotRecord older = snapshot(ruleId, "1.0", 1L);
    final PublishedSnapshotRecord effective = snapshot(ruleId, "1.1", 2L);
    final WorkingVersionRecord working = deletionOf(ruleId, "1.0");
    when(dao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, ruleId))
        .thenReturn(List.of(effective, older));
    when(dao.lockLatestPublishedByParent(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "1"))
        .thenReturn(effective);
    when(dao.archiveSnapshot(eq(older.snapshotId()), anyLong(), eq("checker"), any()))
        .thenReturn(1);
    when(dao.deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "1", 7L)).thenReturn(1);

    GlossaryTermDeletion.apply(mock(Handle.class), dao, working, "checker");

    verify(dao)
        .archiveSnapshot(
            eq(older.snapshotId()), anyLong(), eq("checker"), eq(ArchiveReason.DELETED));
    verify(dao, never()).archiveSnapshot(eq(effective.snapshotId()), anyLong(), any(), any());
    verify(dao, never()).upsertPublishedHead(any(), any(), any(), any(), anyLong());
  }

  @Test
  void requestForAChosenVersionTargetsThatVersion() {
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final UUID entityId = UUID.randomUUID();
    final PublishedSnapshotRecord older = snapshot(entityId, "1.0", 1L);
    final PublishedSnapshotRecord effective = snapshot(entityId, "1.1", 2L);
    allowScopeLock(dao, effective);
    when(dao.lockPublishedVersion(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1.0"))
        .thenReturn(older);
    when(dao.transitionWorking(
            any(), any(), any(), anyLong(), any(), any(), any(), any(), anyLong(), any()))
        .thenReturn(1);

    GlossaryTermDeletion.createWorking(
        dao,
        new GlossaryTermDeletion.DeletionRequest(entityId, "1", "1.0", "maker", ignored -> {}));

    verify(dao)
        .insertWorking(
            any(UUID.class),
            eq(GlossaryVersioningService.GLOSSARY_TERM),
            eq(entityId),
            eq(older.glossaryId()),
            eq("1"),
            eq("1.0"),
            eq(EntityStatus.DRAFT.value()),
            any(),
            any(String.class),
            anyLong(),
            eq("maker"));
  }

  @Test
  void requestForAVersionThatIsNotActiveIsRejected() {
    final GlossaryVersionDAO dao = mock(GlossaryVersionDAO.class);
    final UUID entityId = UUID.randomUUID();
    allowScopeLock(dao, snapshot(entityId, "1.1", 2L));
    final GlossaryTermDeletion.DeletionRequest request =
        new GlossaryTermDeletion.DeletionRequest(entityId, "1", "1.0", "maker", ignored -> {});

    final WebApplicationException rejected =
        assertThrows(
            WebApplicationException.class, () -> GlossaryTermDeletion.createWorking(dao, request));
    assertEquals(409, rejected.getResponse().getStatus());
    verify(dao, never())
        .insertWorking(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), anyLong(), any());
  }

  private static void allowScopeLock(GlossaryVersionDAO dao, PublishedSnapshotRecord effective) {
    final UUID entityId = effective.entityId();
    when(dao.findLatestPublishedByParent(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
        .thenReturn(effective);
    when(dao.lockGlossaryIdentity(effective.glossaryId()))
        .thenReturn(effective.glossaryId().toString());
    when(dao.lockLatestPublishedByParent(GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
        .thenReturn(effective);
  }

  private static PublishedSnapshotRecord snapshot(UUID termId, String version, long sequence) {
    return new PublishedSnapshotRecord(
        UUID.randomUUID(),
        GlossaryVersioningService.GLOSSARY_TERM,
        termId,
        UUID.randomUUID(),
        "1",
        version,
        1.0,
        sequence,
        "{\"name\":\"DQ1\",\"businessVersion\":\"" + version + "\"}",
        "hash",
        sequence,
        "publisher",
        null,
        null,
        null);
  }

  private static WorkingVersionRecord deletionOf(UUID termId, String version) {
    final WorkingVersionRecord working = mock(WorkingVersionRecord.class);
    when(working.entityId()).thenReturn(termId);
    when(working.parentBusinessVersion()).thenReturn("1");
    when(working.businessVersion()).thenReturn(version);
    when(working.revision()).thenReturn(7L);
    return working;
  }
}
