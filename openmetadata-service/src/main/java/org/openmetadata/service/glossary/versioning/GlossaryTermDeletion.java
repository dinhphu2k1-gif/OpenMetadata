/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.GLOSSARY_TERM;
import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.SNAPSHOT_ARCHIVE_EVENT;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/**
 * Deletes an Approved Data Dictionary CDE through the approval workflow.
 *
 * <p>A deletion working row is marked {@code pendingDeletion}, carries the businessVersion of the
 * newest Approved snapshot of the CDE in its scope and is submitted for review immediately. Until
 * it is approved the Approved CDE stays effective. Approving it archives every Approved snapshot
 * of the CDE in the scope and drops its published head, the same state a Data Dictionary cutover
 * leaves behind: the CDE leaves the active list while its Approved history is kept.
 */
final class GlossaryTermDeletion {
  static final String PENDING_DELETION = "pendingDeletion";

  private GlossaryTermDeletion() {}

  record DeletionRequest(
      UUID entityId,
      String parentBusinessVersion,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {}

  static boolean isRequested(WorkingVersionRecord working) {
    return working != null
        && JsonUtils.readTree(working.payload()).path(PENDING_DELETION).asBoolean(false);
  }

  static WorkingVersionRecord createWorking(GlossaryVersionDAO dao, DeletionRequest request) {
    final String scope =
        GlossaryVersioningService.requireParentScope(request.parentBusinessVersion());
    GlossaryVersioningService.lockPublicationScope(dao, GLOSSARY_TERM, request.entityId(), scope);
    final PublishedSnapshotRecord latest = requireDeletableSnapshot(dao, request.entityId(), scope);
    request.authorization().accept(latest);
    if (dao.lockWorking(GLOSSARY_TERM, request.entityId(), scope) != null) {
      throw GlossaryVersioningService.conflict("A working version already exists");
    }
    final long now = System.currentTimeMillis();
    dao.insertWorking(
        UUID.randomUUID(),
        GLOSSARY_TERM,
        request.entityId(),
        latest.glossaryId(),
        scope,
        latest.businessVersion(),
        EntityStatus.DRAFT.value(),
        latest.nativeVersion(),
        JsonUtils.pojoToJson(deletionDraftPayload(latest, scope)),
        now,
        request.actor());
    GlossaryVersioningService.requireUpdated(
        dao.transitionWorking(
            GLOSSARY_TERM,
            request.entityId(),
            scope,
            1,
            EntityStatus.DRAFT.value(),
            EntityStatus.IN_REVIEW.value(),
            EntityStatus.IN_REVIEW.value(),
            EntityStatus.REJECTED.value(),
            now,
            request.actor()));
    return dao.findWorking(GLOSSARY_TERM, request.entityId(), scope);
  }

  /** Archives the Approved snapshots of the CDE in its scope and returns the newest one. */
  static PublishedSnapshotRecord apply(
      GlossaryVersionDAO dao, WorkingVersionRecord working, String actor) {
    final List<PublishedSnapshotRecord> approved =
        activeSnapshots(dao, working.entityId(), working.parentBusinessVersion());
    if (approved.isEmpty()) {
      throw GlossaryVersioningService.conflict(
          String.format(
              "CDE has no Approved version left to delete in scope '%s'",
              working.parentBusinessVersion()));
    }
    final long now = System.currentTimeMillis();
    approved.forEach(snapshot -> archive(dao, snapshot, now, actor));
    GlossaryVersioningService.requireUpdated(
        dao.deleteWorking(
            GLOSSARY_TERM,
            working.entityId(),
            working.parentBusinessVersion(),
            working.revision()));
    return archived(approved.getFirst(), now, actor);
  }

  private static PublishedSnapshotRecord requireDeletableSnapshot(
      GlossaryVersionDAO dao, UUID entityId, String scope) {
    final PublishedSnapshotRecord latest =
        dao.lockLatestPublishedByParent(GLOSSARY_TERM, entityId, scope);
    if (latest == null || latest.archivedAt() != null) {
      throw GlossaryVersioningService.conflict(
          String.format("CDE has no active Approved version in scope '%s' to delete", scope));
    }
    return latest;
  }

  /** Newest first, as the DAO orders snapshots by publicationSequence descending. */
  private static List<PublishedSnapshotRecord> activeSnapshots(
      GlossaryVersionDAO dao, UUID entityId, String scope) {
    return dao.listPublished(GLOSSARY_TERM, entityId).stream()
        .filter(snapshot -> scope.equals(snapshot.parentBusinessVersion()))
        .filter(snapshot -> snapshot.archivedAt() == null)
        .toList();
  }

  private static void archive(
      GlossaryVersionDAO dao, PublishedSnapshotRecord snapshot, long now, String actor) {
    GlossaryVersioningService.requireUpdated(
        dao.archiveSnapshot(snapshot.snapshotId(), now, actor));
    dao.deletePublishedHead(GLOSSARY_TERM, snapshot.entityId(), snapshot.snapshotId());
    dao.insertOutbox(
        UUID.randomUUID(), snapshot.snapshotId(), SNAPSHOT_ARCHIVE_EVENT, snapshot.payload(), now);
  }

  private static PublishedSnapshotRecord archived(
      PublishedSnapshotRecord snapshot, long archivedAt, String archivedBy) {
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
        archivedAt,
        archivedBy);
  }

  @SuppressWarnings("unchecked")
  private static Object deletionDraftPayload(PublishedSnapshotRecord snapshot, String scope) {
    Object payload =
        GlossaryVersioningService.normalizeWorkingPayload(
            snapshot.payload(), snapshot.businessVersion(), EntityStatus.DRAFT.value());
    payload = CdeReleaseVersionType.apply(payload, snapshot.businessVersion());
    final Map<String, Object> draft =
        (Map<String, Object>) GlossaryVersioningService.withParentBusinessVersion(payload, scope);
    draft.put(PENDING_DELETION, true);
    return draft;
  }
}
