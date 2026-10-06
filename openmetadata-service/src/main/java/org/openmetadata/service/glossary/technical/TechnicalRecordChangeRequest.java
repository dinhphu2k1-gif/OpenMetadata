/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import lombok.Builder;

/** A proposed update or deletion of an Approved Technical Dictionary record. */
@Builder(toBuilder = true)
public record TechnicalRecordChangeRequest(
    String id,
    String recordId,
    String operation,
    long baseRevision,
    String proposedValues,
    String status,
    long revision,
    long createdAt,
    String createdBy,
    long updatedAt,
    String updatedBy,
    Long submittedAt,
    String submittedBy,
    Long reviewedAt,
    String reviewedBy,
    String reviewComment) {

  public static final String OPERATION_UPDATE = "UPDATE";
  public static final String OPERATION_DELETE = "DELETE";
  public static final String STATUS_DRAFT = "Draft";
  public static final String STATUS_IN_REVIEW = "InReview";
  public static final String STATUS_REJECTED = "Rejected";

  public boolean isUpdate() {
    return OPERATION_UPDATE.equals(operation);
  }

  public boolean isDelete() {
    return OPERATION_DELETE.equals(operation);
  }

  public boolean isDraft() {
    return STATUS_DRAFT.equals(status);
  }

  public boolean isInReview() {
    return STATUS_IN_REVIEW.equals(status);
  }

  public boolean isRejected() {
    return STATUS_REJECTED.equals(status);
  }
}
