/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.GLOSSARY_TERM;
import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.SNAPSHOT_ARCHIVE_EVENT;
import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.dq.DqTestOutbox;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.ArchiveReason;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * Deletes one Approved version of a governed glossary term through the approval workflow.
 *
 * <p>A deletion working row is marked {@code pendingDeletion}, carries the businessVersion it
 * deletes (the newest Approved one when none is chosen) and is submitted for review immediately.
 * Until it is approved nothing changes. Approving it archives only that version: when it was the
 * effective one, the newest remaining Approved version of the scope becomes effective again; when
 * no Approved version remains, the term is deleted from the scope. The Approved history is kept.
 */
final class GlossaryTermDeletion {
  static final String PENDING_DELETION = "pendingDeletion";

  private GlossaryTermDeletion() {}

  /** {@code businessVersion} is the Approved version to delete; null means the effective one. */
  record DeletionRequest(
      UUID entityId,
      String parentBusinessVersion,
      String businessVersion,
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
    final PublishedSnapshotRecord target =
        targetSnapshot(
            dao, request, scope, requireDeletableSnapshot(dao, request.entityId(), scope));
    request.authorization().accept(target);
    if (dao.lockWorking(GLOSSARY_TERM, request.entityId(), scope) != null) {
      throw GlossaryVersioningService.conflict("A working version already exists");
    }
    final long now = System.currentTimeMillis();
    dao.insertWorking(
        UUID.randomUUID(),
        GLOSSARY_TERM,
        request.entityId(),
        target.glossaryId(),
        scope,
        target.businessVersion(),
        EntityStatus.DRAFT.value(),
        target.nativeVersion(),
        JsonUtils.pojoToJson(deletionDraftPayload(target, scope)),
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

  /** Archives the requested Approved version, restores the previous one and returns the deleted. */
  static PublishedSnapshotRecord apply(
      Handle handle, GlossaryVersionDAO dao, WorkingVersionRecord working, String actor) {
    final PublishedSnapshotRecord target = requireActiveTarget(dao, working);
    final long now = System.currentTimeMillis();
    archive(dao, target, now, actor);
    restorePreviousVersion(dao, target, now);
    // A Data Quality Rule now runs a previous version or becomes ineffective. Queue its
    // reconciliation in the same transaction as the archive so managed test cases and pipelines
    // can never be left out of date without a durable retry record.
    if (DqTestOutbox.isDataQualityRule(target)) {
      DqTestOutbox.enqueueRule(
          handle.attach(org.openmetadata.service.jdbi3.DqRuleTestDAO.class),
          target.entityId().toString());
    }
    GlossaryVersioningService.requireUpdated(
        dao.deleteWorking(
            GLOSSARY_TERM,
            working.entityId(),
            working.parentBusinessVersion(),
            working.revision()));
    return archived(target, now, actor);
  }

  /** True when deleting this version leaves the term without an Approved version in its scope. */
  static boolean removesTerm(GlossaryVersionDAO dao, UUID entityId, String scope) {
    return activeSnapshots(dao, entityId, scope).size() <= 1;
  }

  private static PublishedSnapshotRecord targetSnapshot(
      GlossaryVersionDAO dao,
      DeletionRequest request,
      String scope,
      PublishedSnapshotRecord effective) {
    PublishedSnapshotRecord target = effective;
    if (request.businessVersion() != null) {
      final String version =
          GlossaryBusinessVersion.requireCdeInScope(request.businessVersion(), scope);
      target = dao.lockPublishedVersion(GLOSSARY_TERM, request.entityId(), version);
      if (target == null
          || target.archivedAt() != null
          || !scope.equals(target.parentBusinessVersion())) {
        throw GlossaryVersioningService.conflict(
            String.format(
                "Governed glossary term has no active Approved version '%s' in scope '%s'",
                version, scope));
      }
    }
    return target;
  }

  private static PublishedSnapshotRecord requireActiveTarget(
      GlossaryVersionDAO dao, WorkingVersionRecord working) {
    return activeSnapshots(dao, working.entityId(), working.parentBusinessVersion()).stream()
        .filter(snapshot -> working.businessVersion().equals(snapshot.businessVersion()))
        .findFirst()
        .orElseThrow(
            () ->
                GlossaryVersioningService.conflict(
                    String.format(
                        "Approved version '%s' of the governed glossary term is no longer active"
                            + " in scope '%s'",
                        working.businessVersion(), working.parentBusinessVersion())));
  }

  /**
   * When the deleted version was the effective one, the newest remaining Approved version of the
   * scope becomes the published head again and is announced like a fresh publication.
   */
  private static void restorePreviousVersion(
      GlossaryVersionDAO dao, PublishedSnapshotRecord deleted, long now) {
    final String scope = deleted.parentBusinessVersion();
    final boolean keepsEffectiveVersion =
        dao.lockLatestPublishedByParent(GLOSSARY_TERM, deleted.entityId(), scope) != null;
    final List<PublishedSnapshotRecord> remaining =
        activeSnapshots(dao, deleted.entityId(), scope).stream()
            .filter(snapshot -> !snapshot.snapshotId().equals(deleted.snapshotId()))
            .toList();
    if (!keepsEffectiveVersion && !remaining.isEmpty()) {
      final PublishedSnapshotRecord previous = remaining.getFirst();
      dao.upsertPublishedHead(
          GLOSSARY_TERM,
          previous.entityId(),
          scope,
          previous.snapshotId(),
          previous.publicationSequence());
      requeueEvent(dao, previous, SNAPSHOT_UPSERT_EVENT, now);
    }
  }

  /** The outbox keeps one row per (snapshot, event type), so a repeated event reuses its row. */
  private static void requeueEvent(
      GlossaryVersionDAO dao, PublishedSnapshotRecord snapshot, String eventType, long now) {
    if (dao.requeueOutbox(snapshot.snapshotId(), eventType, snapshot.payload(), now) == 0) {
      dao.insertOutbox(
          UUID.randomUUID(), snapshot.snapshotId(), eventType, snapshot.payload(), now);
    }
  }

  private static PublishedSnapshotRecord requireDeletableSnapshot(
      GlossaryVersionDAO dao, UUID entityId, String scope) {
    final PublishedSnapshotRecord latest =
        dao.lockLatestPublishedByParent(GLOSSARY_TERM, entityId, scope);
    if (latest == null || latest.archivedAt() != null) {
      throw GlossaryVersioningService.conflict(
          String.format(
              "Governed glossary term has no active Approved version in scope '%s' to delete",
              scope));
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
        dao.archiveSnapshot(snapshot.snapshotId(), now, actor, ArchiveReason.DELETED));
    dao.deletePublishedHead(GLOSSARY_TERM, snapshot.entityId(), snapshot.snapshotId());
    requeueEvent(dao, snapshot, SNAPSHOT_ARCHIVE_EVENT, now);
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
        archivedBy,
        ArchiveReason.DELETED.name());
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
