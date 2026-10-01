/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Validates and normalizes the editable values of a Technical Dictionary record. */
public final class TechnicalRecordValidator {
  private final ReferenceLookup lookup;

  public TechnicalRecordValidator() {
    this(new EntityReferenceLookup());
  }

  public TechnicalRecordValidator(ReferenceLookup lookup) {
    this.lookup = lookup;
  }

  /**
   * Returns the values with blank tags removed after checking rank, tags and the system owner. The
   * CDE is checked against the bound Data Dictionary version by the caller.
   */
  public TechnicalRecordValues validate(TechnicalRecordValues values) {
    requireRank(values.rank());
    requireRankMatchesCde(values.cde() != null, values.rank() != null);
    final TechnicalRecordValues normalized =
        new TechnicalRecordValues(
            values.cde(),
            values.rank(),
            requireTag(
                TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION, values.elementType()),
            requireTag(
                TechnicalDictionaryProfile.GENERATION_TYPE_CLASSIFICATION, values.generationType()),
            requireTag(
                TechnicalDictionaryProfile.CREATION_METHOD_CLASSIFICATION, values.creationMethod()),
            requireTag(TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION, values.timeliness()),
            values.systemOwnerId());
    requireTeam(values.systemOwnerId());
    return normalized;
  }

  private static void requireRank(Integer rank) {
    if (rank != null
        && (rank < TechnicalDictionaryProfile.MIN_RANK
            || rank > TechnicalDictionaryProfile.MAX_RANK)) {
      throw invalid(
          String.format(
              "%s must be an integer between %d and %d",
              TechnicalDictionaryProfile.SURVIVORSHIP_RANK,
              TechnicalDictionaryProfile.MIN_RANK,
              TechnicalDictionaryProfile.MAX_RANK));
    }
  }

  private static void requireRankMatchesCde(boolean hasCde, boolean hasRank) {
    if (hasCde && !hasRank) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.RANK_REQUIRED, "A rank is required when a CDE is referenced");
    }
    if (!hasCde && hasRank) {
      throw invalid("A rank must be empty when no CDE is referenced");
    }
  }

  private String requireTag(String classification, String tagFqn) {
    final String value = tagFqn == null || tagFqn.isBlank() ? null : tagFqn.trim();
    if (value != null && !(value.startsWith(classification + ".") && lookup.tagExists(value))) {
      throw invalid(
          String.format("Tag '%s' does not exist in classification %s", value, classification));
    }
    return value;
  }

  private void requireTeam(UUID teamId) {
    if (teamId != null && !lookup.teamExists(teamId)) {
      throw invalid(TechnicalDictionaryProfile.SYSTEM_OWNER + " must reference an existing team");
    }
  }

  private static RuntimeException invalid(String message) {
    return TechnicalDictionaryErrors.badRequest(TechnicalDictionaryErrors.INVALID_FIELD, message);
  }

  /** Existence checks for the references carried by the values. */
  public interface ReferenceLookup {
    boolean tagExists(String tagFqn);

    boolean teamExists(UUID teamId);
  }

  static final class EntityReferenceLookup implements ReferenceLookup {
    @Override
    public boolean tagExists(String tagFqn) {
      boolean exists = true;
      try {
        Entity.getEntityReferenceByName(Entity.TAG, tagFqn, Include.NON_DELETED);
      } catch (EntityNotFoundException exception) {
        exists = false;
      }
      return exists;
    }

    @Override
    public boolean teamExists(UUID teamId) {
      boolean exists = true;
      try {
        Entity.getEntityReferenceById(Entity.TEAM, teamId, Include.NON_DELETED);
      } catch (EntityNotFoundException exception) {
        exists = false;
      }
      return exists;
    }
  }
}
