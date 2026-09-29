/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Validates and normalizes Technical Dictionary working payloads written by users. */
public final class TechnicalRecordValidator {
  private static final String TEAM = "team";
  private static final String ID = "id";
  private static final String TYPE = "type";

  private final ReferenceLookup lookup;

  public TechnicalRecordValidator() {
    this(new EntityReferenceLookup());
  }

  public TechnicalRecordValidator(ReferenceLookup lookup) {
    this.lookup = lookup;
  }

  /**
   * Builds the payload persisted by Save Draft: only editable fields come from the request, while
   * server-owned source fields, description and display name are kept from the current working.
   */
  public GlossaryTerm prepareDraft(GlossaryTerm requested, GlossaryTerm current) {
    final Map<String, Object> requestedExtension = extension(requested.getExtension());
    rejectServerOwnedKeys(requestedExtension);
    requireManagedTags(requested.getTags());
    final Map<String, Object> merged = serverOwned(extension(current.getExtension()));
    merged.putAll(editable(requestedExtension));
    return requested
        .withDisplayName(current.getDisplayName())
        .withDescription(current.getDescription())
        .withOwners(List.of())
        .withDomains(List.of())
        .withExtension(merged);
  }

  /** Checks invariants that must hold before a record enters or leaves review. */
  public void requireWorkflowReady(GlossaryTerm payload) {
    final Map<String, Object> values = extension(payload.getExtension());
    if (isSourceUnavailable(values)) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.SOURCE_UNAVAILABLE,
          String.format(
              "Source column '%s' no longer exists",
              values.get(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN)));
    }
    requireRankMatchesCde(!nullOrEmpty(payload.getRelatedTerms()), values);
  }

  public static Map<String, Object> extension(Object raw) {
    final Map<String, Object> result = new LinkedHashMap<>();
    if (raw != null) {
      final Map<?, ?> values = JsonUtils.readValue(JsonUtils.pojoToJson(raw), Map.class);
      values.forEach((key, value) -> result.put(String.valueOf(key), value));
    }
    return result;
  }

  public static Integer rank(Map<String, Object> values) {
    final Object raw = values.get(TechnicalDictionaryProfile.SURVIVORSHIP_RANK);
    return raw instanceof Number number ? number.intValue() : null;
  }

  public static boolean isSourceUnavailable(Map<String, Object> values) {
    final Object status = values.get(TechnicalDictionaryProfile.SOURCE_STATUS);
    return status instanceof List<?> list
        && list.contains(TechnicalDictionaryProfile.SOURCE_UNAVAILABLE);
  }

  private static void rejectServerOwnedKeys(Map<String, Object> requested) {
    final Set<String> unexpected = new HashSet<>(requested.keySet());
    unexpected.removeAll(TechnicalDictionaryProfile.EDITABLE_EXTENSION_KEYS);
    if (!unexpected.isEmpty()) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.SERVER_OWNED_FIELD,
          "Extension keys are server-owned or unsupported: " + String.join(", ", unexpected));
    }
  }

  private Map<String, Object> editable(Map<String, Object> requested) {
    final Map<String, Object> result = new LinkedHashMap<>();
    final Object rank = requested.get(TechnicalDictionaryProfile.SURVIVORSHIP_RANK);
    if (rank != null) {
      result.put(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, requireRank(rank));
    }
    final Object systemOwner = requested.get(TechnicalDictionaryProfile.SYSTEM_OWNER);
    if (systemOwner != null) {
      result.put(TechnicalDictionaryProfile.SYSTEM_OWNER, requireTeam(systemOwner));
    }
    return result;
  }

  private static int requireRank(Object raw) {
    final boolean valid =
        raw instanceof Number number
            && number.doubleValue() == Math.rint(number.doubleValue())
            && number.intValue() >= TechnicalDictionaryProfile.MIN_RANK
            && number.intValue() <= TechnicalDictionaryProfile.MAX_RANK;
    if (!valid) {
      throw invalid(
          String.format(
              "%s must be an integer between %d and %d",
              TechnicalDictionaryProfile.SURVIVORSHIP_RANK,
              TechnicalDictionaryProfile.MIN_RANK,
              TechnicalDictionaryProfile.MAX_RANK));
    }
    return ((Number) raw).intValue();
  }

  private Object requireTeam(Object raw) {
    final Map<String, Object> reference = extension(raw);
    final UUID teamId = parseUuid(reference.get(ID));
    final boolean valid =
        TEAM.equals(reference.get(TYPE)) && teamId != null && lookup.teamExists(teamId);
    if (!valid) {
      throw invalid(TechnicalDictionaryProfile.SYSTEM_OWNER + " must reference an existing team");
    }
    return reference;
  }

  private static UUID parseUuid(Object raw) {
    UUID result = null;
    try {
      result = raw == null ? null : UUID.fromString(String.valueOf(raw));
    } catch (IllegalArgumentException exception) {
      result = null;
    }
    return result;
  }

  private void requireManagedTags(List<TagLabel> tags) {
    final Set<String> classifications = new HashSet<>();
    for (TagLabel tag : listOrEmpty(tags)) {
      final String classification = classificationOf(tag.getTagFQN());
      if (!classifications.add(classification) || !lookup.tagExists(tag.getTagFQN())) {
        throw invalid(
            String.format(
                "Tag '%s' is duplicated for its classification or does not exist",
                tag.getTagFQN()));
      }
    }
  }

  private static String classificationOf(String tagFqn) {
    if (!TechnicalDictionaryProfile.isManagedClassification(tagFqn)) {
      throw invalid(String.format("Tag '%s' is not managed by the Technical Dictionary", tagFqn));
    }
    return tagFqn.substring(0, tagFqn.indexOf('.'));
  }

  private static Map<String, Object> serverOwned(Map<String, Object> current) {
    final Map<String, Object> result = new LinkedHashMap<>();
    current.forEach(
        (key, value) -> {
          if (TechnicalDictionaryProfile.SERVER_OWNED_EXTENSION_KEYS.contains(key)) {
            result.put(key, value);
          }
        });
    return result;
  }

  private static void requireRankMatchesCde(boolean hasCde, Map<String, Object> values) {
    final boolean hasRank = rank(values) != null;
    if (hasCde && !hasRank) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.RANK_REQUIRED, "A rank is required when a CDE is referenced");
    }
    if (!hasCde && hasRank) {
      throw invalid("A rank must be empty when no CDE is referenced");
    }
  }

  private static RuntimeException invalid(String message) {
    return TechnicalDictionaryErrors.badRequest(TechnicalDictionaryErrors.INVALID_FIELD, message);
  }

  /** Existence checks for references carried by a Technical Dictionary payload. */
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
