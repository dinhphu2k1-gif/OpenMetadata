/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import java.util.UUID;

/** Creates or replaces the draft proposal associated with one Approved record. */
public record TechnicalChangeRequestCreate(
    Long expectedRevision,
    String operation,
    UUID cde,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    List<TechnicalOwnerRef> systemOwners) {

  public TechnicalRecordValues values() {
    return new TechnicalRecordValues(
        cde, rank, elementType, generationType, creationMethod, timeliness, systemOwners);
  }
}
