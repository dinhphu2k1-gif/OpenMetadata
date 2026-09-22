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

final class GlossaryVersionResponses {
  private GlossaryVersionResponses() {}

  static Map<String, Object> working(WorkingVersionRecord record) {
    Map<String, Object> payload = payload(record.payload());
    payload.put("businessVersion", record.businessVersion());
    payload.put("workingRevision", record.revision());
    payload.put("entityStatus", record.entityStatus());
    payload.put("updatedAt", record.updatedAt());
    payload.put("updatedBy", record.updatedBy());
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
    payload.put("businessVersion", record.businessVersion());
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
}
