/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.FullyQualifiedName;

final class GlossaryVersionResponses {
  private GlossaryVersionResponses() {}

  static Map<String, Object> working(WorkingVersionRecord record) {
    Map<String, Object> payload = payload(record.payload());
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
    normalizeScopedTermFqn(payload, record.parentBusinessVersion());
    payload.put("businessVersion", record.businessVersion());
    putIfPresent(payload, "parentBusinessVersion", record.parentBusinessVersion());
    if (record.archivedAt() != null) {
      payload.put("entityStatus", "Archived");
      payload.put("archivedAt", record.archivedAt());
      payload.put("archivedBy", record.archivedBy());
    }
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
    if (!(name instanceof String termName)
        || !(glossary instanceof Map<?, ?> glossaryValues)) {
      return;
    }
    Object glossaryFqn = glossaryValues.get("fullyQualifiedName");
    if (!(glossaryFqn instanceof String parentFqn) || parentFqn.isBlank()) {
      return;
    }
    payload.put(
        "fullyQualifiedName",
        FullyQualifiedName.build(
            parentFqn, termName + "@v" + parentBusinessVersion));
  }
}
