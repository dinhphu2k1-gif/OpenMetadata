/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;

/**
 * Body of `PATCH /v1/glossaryTerms/technical/records/{id}`: the complete set of editable values.
 * A missing value clears the stored one, so a client always sends what it read and changed.
 */
public record TechnicalRecordUpdate(
    Long expectedRevision,
    UUID cde,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    UUID systemOwnerId) {

  public TechnicalRecordValues values() {
    return new TechnicalRecordValues(
        cde, rank, elementType, generationType, creationMethod, timeliness, systemOwnerId);
  }
}
