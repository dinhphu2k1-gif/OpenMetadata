/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;

/**
 * The user-editable values of one record. Tag values are classification tag FQNs; {@code null}
 * means the value is not set.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TechnicalRecordValues(
    UUID cde,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    List<TechnicalOwnerRef> systemOwners) {

  public TechnicalRecordValues {
    systemOwners = TechnicalOwners.normalize(systemOwners);
  }

  /** Reads stored proposals, including those written with the single {@code systemOwnerId}. */
  @JsonCreator
  static TechnicalRecordValues fromJson(
      @JsonProperty("cde") UUID cde,
      @JsonProperty("rank") Integer rank,
      @JsonProperty("elementType") String elementType,
      @JsonProperty("generationType") String generationType,
      @JsonProperty("creationMethod") String creationMethod,
      @JsonProperty("timeliness") String timeliness,
      @JsonProperty("systemOwners") List<TechnicalOwnerRef> systemOwners,
      @JsonProperty("systemOwnerId") UUID legacyTeamId) {
    return new TechnicalRecordValues(
        cde,
        rank,
        elementType,
        generationType,
        creationMethod,
        timeliness,
        systemOwners == null && legacyTeamId != null
            ? List.of(new TechnicalOwnerRef(legacyTeamId, TechnicalOwnerRef.TEAM))
            : systemOwners);
  }

  public static final TechnicalRecordValues EMPTY =
      new TechnicalRecordValues(null, null, null, null, null, null, List.of());

  public static TechnicalRecordValues of(TechnicalRecord record) {
    return new TechnicalRecordValues(
        record.cdeTermId() == null ? null : UUID.fromString(record.cdeTermId()),
        record.rank(),
        record.elementType(),
        record.generationType(),
        record.creationMethod(),
        record.timeliness(),
        TechnicalOwners.parse(record.systemOwnerId()));
  }
}
