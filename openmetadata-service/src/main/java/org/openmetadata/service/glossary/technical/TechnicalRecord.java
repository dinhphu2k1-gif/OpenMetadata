/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import lombok.Builder;

/**
 * One declared Column of the unversioned Technical Dictionary as stored in `technical_record`.
 * Identifiers are kept as strings because they are bound to varchar columns.
 */
@Builder(toBuilder = true)
public record TechnicalRecord(
    String id,
    String columnKey,
    String columnFqn,
    String sourceService,
    String sourceDatabase,
    String sourceSchema,
    String sourceTable,
    String sourceColumn,
    String dataType,
    Integer dataLength,
    Integer dataPrecision,
    Integer dataScale,
    String description,
    String sourceStatus,
    String cdeTermId,
    Long cdeAssignedAt,
    String cdeAssignedBy,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    String systemOwnerId,
    String status,
    Long submittedAt,
    String submittedBy,
    Long reviewedAt,
    String reviewedBy,
    String reviewComment,
    long revision,
    long createdAt,
    String createdBy,
    long updatedAt,
    String updatedBy) {

  public boolean isAvailable() {
    return TechnicalDictionaryProfile.SOURCE_AVAILABLE.equals(sourceStatus);
  }

  public boolean hasCde() {
    return cdeTermId != null;
  }

  public boolean isApproved() {
    return STATUS_APPROVED.equals(status);
  }

  public boolean isInReview() {
    return STATUS_IN_REVIEW.equals(status);
  }

  public boolean isRejected() {
    return STATUS_REJECTED.equals(status);
  }

  public static final String STATUS_IN_REVIEW = "In Review";
  public static final String STATUS_APPROVED = "Approved";
  public static final String STATUS_REJECTED = "Rejected";
}
