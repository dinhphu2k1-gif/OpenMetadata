/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;

/**
 * The user-editable values of one record. Tag values are classification tag FQNs; {@code null}
 * means the value is not set.
 */
public record TechnicalRecordValues(
    UUID cde,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    UUID systemOwnerId) {

  public static final TechnicalRecordValues EMPTY =
      new TechnicalRecordValues(null, null, null, null, null, null, null);

  public static TechnicalRecordValues of(TechnicalRecord record) {
    return new TechnicalRecordValues(
        record.cdeTermId() == null ? null : UUID.fromString(record.cdeTermId()),
        record.rank(),
        record.elementType(),
        record.generationType(),
        record.creationMethod(),
        record.timeliness(),
        record.systemOwnerId() == null ? null : UUID.fromString(record.systemOwnerId()));
  }
}
