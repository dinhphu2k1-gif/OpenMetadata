/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.versioning.CdeReleaseVersionType;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.SnapshotHistoryRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.FullyQualifiedName;

final class GlossaryVersionResponses {
  private GlossaryVersionResponses() {}

  static Map<String, Object> working(WorkingVersionRecord record) {
    Map<String, Object> payload = payload(record.payload());
    projectLatestScopedCde(payload, record.entityType(), record.parentBusinessVersion());
    projectCdeReleaseVersionType(payload, record.entityType(), record.businessVersion());
    normalizeScopedTermFqn(payload, record.parentBusinessVersion());
    payload.put("businessVersion", record.businessVersion());
    putIfPresent(payload, "parentBusinessVersion", record.parentBusinessVersion());
    payload.put("workingRevision", record.revision());
    payload.put("entityStatus", record.entityStatus());
    payload.put("updatedAt", record.updatedAt());
    payload.put("updatedBy", record.updatedBy());
    payload.put("createdAt", record.createdAt());
    payload.put("createdBy", record.createdBy());
    putIfPresent(payload, "submittedAt", record.submittedAt());
    putIfPresent(payload, "submittedBy", record.submittedBy());
    putIfPresent(payload, "rejectedAt", record.rejectedAt());
    putIfPresent(payload, "rejectedBy", record.rejectedBy());
    return payload;
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }

  static Map<String, Object> published(PublishedSnapshotRecord record) {
    Map<String, Object> payload = payload(record.payload());
    projectLatestScopedCde(payload, record.entityType(), record.parentBusinessVersion());
    projectCdeReleaseVersionType(payload, record.entityType(), record.businessVersion());
    normalizeScopedTermFqn(payload, record.parentBusinessVersion());
    payload.put("businessVersion", record.businessVersion());
    putIfPresent(payload, "parentBusinessVersion", record.parentBusinessVersion());
    payload.put("snapshotId", record.snapshotId());
    payload.put("publicationSequence", record.publicationSequence());
    payload.put("publishedAt", record.publishedAt());
    payload.put("publishedBy", record.publishedBy());
    if (record.archivedAt() != null) {
      payload.put("entityStatus", "Archived");
      payload.put("archivedAt", record.archivedAt());
      payload.put("archivedBy", record.archivedBy());
    }
    return payload;
  }

  static Map<String, Object> history(SnapshotHistoryRecord record) {
    final Map<String, Object> payload = payload(record.payload());
    projectCdeReleaseVersionType(payload, record.entityType(), record.businessVersion());
    normalizeScopedTermFqn(payload, record.parentBusinessVersion());
    payload.put("historyId", record.historyId());
    payload.put("snapshotId", record.snapshotId());
    payload.put("businessVersion", record.businessVersion());
    putIfPresent(payload, "parentBusinessVersion", record.parentBusinessVersion());
    payload.put("contentHash", record.contentHash());
    payload.put("publishedAt", record.publishedAt());
    payload.put("publishedBy", record.publishedBy());
    payload.put("supersededAt", record.supersededAt());
    payload.put("supersededBy", record.supersededBy());
    return payload;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> payload(String json) {
    Object parsed = JsonUtils.readValue(json, Object.class);
    if (!(parsed instanceof Map<?, ?> values)) {
      throw new IllegalStateException("Glossary version payload is not a JSON object");
    }
    Map<String, Object> result = new LinkedHashMap<>();
    values.forEach((key, value) -> result.put(String.valueOf(key), value));
    return result;
  }

  private static void normalizeScopedTermFqn(
      Map<String, Object> payload, String parentBusinessVersion) {
    if (parentBusinessVersion == null || parentBusinessVersion.isBlank()) {
      return;
    }
    Object name = payload.get("name");
    Object glossary = payload.get("glossary");
    if (!(name instanceof String termName) || !(glossary instanceof Map<?, ?> glossaryValues)) {
      return;
    }
    Object glossaryFqn = glossaryValues.get("fullyQualifiedName");
    if (!(glossaryFqn instanceof String parentFqn) || parentFqn.isBlank()) {
      return;
    }
    payload.put(
        "fullyQualifiedName",
        FullyQualifiedName.build(parentFqn, termName + "@v" + parentBusinessVersion));
  }

  private static void projectCdeReleaseVersionType(
      Map<String, Object> payload, String entityType, String businessVersion) {
    if ("glossaryTerm".equals(entityType)) {
      CdeReleaseVersionType.project(payload, businessVersion);
    }
  }

  /** Resolve a DQ rule's stable CDE identity to the latest Approved version in the same scope. */
  @SuppressWarnings("unchecked")
  private static void projectLatestScopedCde(
      Map<String, Object> payload, String entityType, String parentBusinessVersion) {
    if (!"glossaryTerm".equals(entityType)
        || parentBusinessVersion == null
        || !hasGlossaryName(
            payload, GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY.glossaryName())) {
      return;
    }
    Object related = payload.get("relatedTerms");
    if (!(related instanceof List<?> relations)
        || relations.size() != 1
        || !(relations.get(0) instanceof Map<?, ?> rawRelation)
        || !(rawRelation.get("term") instanceof Map<?, ?> rawTerm)
        || rawTerm.get("id") == null) {
      return;
    }
    try {
      PublishedSnapshotRecord latest =
          new GlossaryVersioningService()
              .getLatestPublishedInScope(
                  GlossaryVersioningService.GLOSSARY_TERM,
                  UUID.fromString(String.valueOf(rawTerm.get("id"))),
                  parentBusinessVersion);
      Map<String, Object> latestPayload = payload(latest.payload());
      if (!hasGlossaryName(
          latestPayload, GovernedGlossaryProfileRegistry.Profile.DATA_DICTIONARY.glossaryName())) {
        return;
      }

      Map<String, Object> relation = (Map<String, Object>) rawRelation;
      Map<String, Object> term = new LinkedHashMap<>();
      for (String field :
          List.of("id", "name", "displayName", "fullyQualifiedName", "description")) {
        Object value = latestPayload.get(field);
        if (value != null) {
          term.put(field, value);
        }
      }
      term.put("type", "glossaryTerm");
      relation.put("term", term);
      relation.put(
          "versionContext",
          Map.of(
              "parentBusinessVersion", parentBusinessVersion,
              "businessVersion", latest.businessVersion(),
              "snapshotId", latest.snapshotId()));
    } catch (RuntimeException ignored) {
      // Keep the stored audit representation for an unresolved legacy/orphan relation. Strict
      // authoring validation will reject it until it can be resolved.
    }
  }

  private static boolean hasGlossaryName(Map<String, Object> payload, String expectedName) {
    if (!(payload.get("glossary") instanceof Map<?, ?> glossary)) {
      return false;
    }
    return expectedName.equals(glossary.get("name"))
        || expectedName.equals(glossary.get("fullyQualifiedName"));
  }
}
