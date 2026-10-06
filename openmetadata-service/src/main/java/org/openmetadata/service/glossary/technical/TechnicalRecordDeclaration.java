/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import java.util.UUID;

/**
 * Body of `POST /v1/glossaryTerms/technical/records`: the Column to declare and its initial
 * editable values. Every value except {@code columnFqn} is optional; tag values are classification
 * tag FQNs.
 */
public record TechnicalRecordDeclaration(
    String columnFqn,
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
