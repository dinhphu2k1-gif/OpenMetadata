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

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityStatus;
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

    when(dao.findLatestPublishedByParent(
            GlossaryVersioningService.GLOSSARY_TERM, entityId, "1"))
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
}
