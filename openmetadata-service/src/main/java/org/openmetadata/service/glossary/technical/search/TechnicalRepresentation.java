/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/** One stored representation of a record (working, Approved or Archived) as indexed. */
public record TechnicalRepresentation(
    String recordType,
    String entityStatus,
    String businessVersion,
    Long workingRevision,
    String snapshotId,
    GlossaryTerm payload,
    Long updatedAt,
    String updatedBy) {

  public static TechnicalRepresentation working(WorkingVersionRecord working) {
    return new TechnicalRepresentation(
        TechnicalIndexFields.RECORD_WORKING,
        working.entityStatus(),
        working.businessVersion(),
        working.revision(),
        null,
        JsonUtils.readValue(working.payload(), GlossaryTerm.class),
        working.updatedAt(),
        working.updatedBy());
  }

  public static TechnicalRepresentation published(PublishedSnapshotRecord snapshot) {
    return snapshotView(
        TechnicalIndexFields.RECORD_PUBLISHED, EntityStatus.APPROVED, snapshot, snapshot.publishedAt());
  }

  public static TechnicalRepresentation archived(PublishedSnapshotRecord snapshot) {
    final long archivedAt =
        snapshot.archivedAt() == null ? snapshot.publishedAt() : snapshot.archivedAt();
    return snapshotView(
        TechnicalIndexFields.RECORD_ARCHIVED, EntityStatus.ARCHIVED, snapshot, archivedAt);
  }

  private static TechnicalRepresentation snapshotView(
      String recordType, EntityStatus status, PublishedSnapshotRecord snapshot, long updatedAt) {
    return new TechnicalRepresentation(
        recordType,
        status.value(),
        snapshot.businessVersion(),
        null,
        snapshot.snapshotId().toString(),
        JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class),
        updatedAt,
        snapshot.publishedBy());
  }
}
