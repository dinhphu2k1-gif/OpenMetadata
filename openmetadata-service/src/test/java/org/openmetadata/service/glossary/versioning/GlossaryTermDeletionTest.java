/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
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
            dao, new GlossaryTermDeletion.DeletionRequest(entityId, "1", "maker", ignored -> {}));

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
  void approvingDataQualityDeletionArchivesScopeAndQueuesReconciliation() {
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
            null);
    when(otherScope.parentBusinessVersion()).thenReturn("1");
    when(dao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, ruleId))
        .thenReturn(List.of(current, otherScope));
    when(dao.archiveSnapshot(eq(snapshotId), anyLong(), eq("checker"))).thenReturn(1);
    when(dao.deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "2", 7L)).thenReturn(1);
    when(handle.attach(DqRuleTestDAO.class)).thenReturn(dqDao);

    GlossaryTermDeletion.apply(handle, dao, working, "checker");

    verify(dao).archiveSnapshot(eq(snapshotId), anyLong(), eq("checker"));
    verify(dao).deletePublishedHead(GlossaryVersioningService.GLOSSARY_TERM, ruleId, snapshotId);
    verify(dao)
        .insertOutbox(any(UUID.class), eq(snapshotId), eq("SNAPSHOT_ARCHIVE"), any(), anyLong());
    verify(dqDao).enqueue(eq("RECONCILE_RULE"), eq(ruleId.toString()), eq(null), anyLong());
    verify(dao).deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, ruleId, "2", 7L);
  }
}
