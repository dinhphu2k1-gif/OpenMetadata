/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.GLOSSARY_TERM;
import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.SNAPSHOT_UPSERT_EVENT;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * Corrects an Approved glossary term business version in place.
 *
 * <p>A correction working row carries the same businessVersion as the Approved snapshot it
 * corrects. Approving it keeps the snapshot identity (snapshotId, publicationSequence, published
 * head and Data Dictionary manifest membership), copies the superseded content into the history
 * table and overwrites the snapshot content. Archived snapshots belong to a frozen Data Dictionary
 * and cannot be corrected.
 */
final class GlossaryVersionCorrection {

  private GlossaryVersionCorrection() {}

  record CorrectionRequest(
      UUID entityId,
      String businessVersion,
      String parentBusinessVersion,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {}

  static WorkingVersionRecord createWorking(GlossaryVersionDAO dao, CorrectionRequest request) {
    final String parentScope =
        GlossaryVersioningService.requireParentScope(request.parentBusinessVersion());
    final String businessVersion = requireCorrectableVersion(request, parentScope);
    GlossaryVersioningService.lockPublicationScope(
        dao, GLOSSARY_TERM, request.entityId(), parentScope);
    final PublishedSnapshotRecord snapshot =
        requireCorrectableSnapshot(dao, request.entityId(), businessVersion, parentScope);
    if (request.authorization() != null) {
      request.authorization().accept(snapshot);
    }
    if (dao.lockWorking(GLOSSARY_TERM, request.entityId(), parentScope) != null) {
      throw GlossaryVersioningService.conflict("A working version already exists");
    }
    dao.insertWorking(
        UUID.randomUUID(),
        GLOSSARY_TERM,
        request.entityId(),
        snapshot.glossaryId(),
        parentScope,
        businessVersion,
        EntityStatus.DRAFT.value(),
        snapshot.nativeVersion(),
        JsonUtils.pojoToJson(correctionDraftPayload(snapshot, parentScope)),
        System.currentTimeMillis(),
        request.actor());
    return dao.findWorking(GLOSSARY_TERM, request.entityId(), parentScope);
  }

  static PublishedSnapshotRecord apply(
      GlossaryVersionDAO dao,
      WorkingVersionRecord working,
      PublishedSnapshotRecord corrected,
      String actor) {
    requireCorrectableAtApproval(working, corrected);
    final long now = System.currentTimeMillis();
    final String approvedPayload =
        GlossaryVersioningService.withPublishedMetadata(
            GlossaryVersioningService.restoreMissingTermRelations(working.payload(), corrected),
            working,
            corrected.snapshotId(),
            corrected.publicationSequence(),
            now,
            actor);
    final String contentHash = GlossaryVersioningService.sha256(approvedPayload);
    GlossaryVersioningService.requireUpdated(
        dao.insertSnapshotHistory(UUID.randomUUID(), corrected.snapshotId(), now, actor));
    GlossaryVersioningService.requireUpdated(
        dao.correctSnapshot(
            corrected.snapshotId(),
            corrected.contentHash(),
            working.nativeVersion(),
            approvedPayload,
            contentHash,
            now,
            actor));
    requeueUpsertEvent(dao, corrected.snapshotId(), approvedPayload, now);
    return new PublishedSnapshotRecord(
        corrected.snapshotId(),
        corrected.entityType(),
        corrected.entityId(),
        corrected.glossaryId(),
        corrected.parentBusinessVersion(),
        corrected.businessVersion(),
        working.nativeVersion(),
        corrected.publicationSequence(),
        approvedPayload,
        contentHash,
        now,
        actor,
        null,
        null);
  }

  /** The outbox keeps one row per (snapshot, event type), so a corrected snapshot reuses its row. */
  private static void requeueUpsertEvent(
      GlossaryVersionDAO dao, UUID snapshotId, String payload, long now) {
    if (dao.requeueOutbox(snapshotId, SNAPSHOT_UPSERT_EVENT, payload, now) == 0) {
      dao.insertOutbox(UUID.randomUUID(), snapshotId, SNAPSHOT_UPSERT_EVENT, payload, now);
    }
  }

  private static String requireCorrectableVersion(CorrectionRequest request, String parentScope) {
    final String businessVersion;
    try {
      businessVersion = GlossaryBusinessVersion.requireCanonical(request.businessVersion());
      GlossaryBusinessVersion.requireCdeInScope(businessVersion, parentScope);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    return businessVersion;
  }

  private static PublishedSnapshotRecord requireCorrectableSnapshot(
      GlossaryVersionDAO dao, UUID entityId, String businessVersion, String parentScope) {
    final PublishedSnapshotRecord snapshot =
        dao.lockPublishedVersion(GLOSSARY_TERM, entityId, businessVersion);
    if (snapshot == null || !parentScope.equals(snapshot.parentBusinessVersion())) {
      throw new NotFoundException(
          String.format(
              "Approved business version '%s' was not found in scope '%s'",
              businessVersion, parentScope));
    }
    if (snapshot.archivedAt() != null) {
      throw GlossaryVersioningService.conflict(
          String.format(
              "Approved business version '%s' is archived and cannot be corrected",
              businessVersion));
    }
    return snapshot;
  }

  private static void requireCorrectableAtApproval(
      WorkingVersionRecord working, PublishedSnapshotRecord corrected) {
    final boolean sameScope =
        Objects.equals(working.parentBusinessVersion(), corrected.parentBusinessVersion());
    if (!GLOSSARY_TERM.equals(working.entityType()) || !sameScope) {
      throw GlossaryVersioningService.conflict(
          String.format(
              "businessVersion '%s' has already been published", working.businessVersion()));
    }
    if (corrected.archivedAt() != null) {
      throw GlossaryVersioningService.conflict(
          String.format(
              "Approved business version '%s' was archived before the correction was approved",
              working.businessVersion()));
    }
  }

  private static Object correctionDraftPayload(
      PublishedSnapshotRecord snapshot, String parentScope) {
    Object payload =
        GlossaryVersioningService.normalizeWorkingPayload(
            snapshot.payload(), snapshot.businessVersion(), EntityStatus.DRAFT.value());
    payload = CdeReleaseVersionType.apply(payload, snapshot.businessVersion());
    return GlossaryVersioningService.withParentBusinessVersion(payload, parentScope);
  }
}
