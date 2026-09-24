/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/** Builds the immutable document identity and normalized filter fields for one F11 row. */
public final class CdeBusinessVersionIndexDocument {
  private CdeBusinessVersionIndexDocument() {}

  public static IndexedDocument published(PublishedSnapshotRecord record) {
    String recordType = record.archivedAt() == null ? "published" : "archived";
    Map<String, Object> document =
        base(
            record.entityId(),
            record.glossaryId(),
            record.parentBusinessVersion(),
            record.businessVersion(),
            record.payload(),
            recordType);
    document.put("scopeType", record.archivedAt() == null ? "active" : "archived");
    document.put("publishedAt", record.publishedAt());
    if (record.archivedAt() != null) {
      document.put("archivedAt", record.archivedAt());
    }
    return new IndexedDocument(documentId(rowKey(record)), document);
  }

  public static IndexedDocument working(WorkingVersionRecord record) {
    Map<String, Object> document =
        base(
            record.entityId(),
            record.glossaryId(),
            record.parentBusinessVersion(),
            record.businessVersion(),
            record.payload(),
            "working");
    document.put("scopeType", "working");
    document.put("entityStatus", record.entityStatus());
    document.put("workingRevision", record.revision());
    document.put("updatedAt", record.updatedAt());
    return new IndexedDocument(documentId(rowKey(record)), document);
  }

  private static Map<String, Object> base(
      UUID termId,
      UUID glossaryId,
      String parentBusinessVersion,
      String businessVersion,
      String payload,
      String recordType) {
    Map<String, Object> source =
        JsonUtils.readValue(payload, new com.fasterxml.jackson.core.type.TypeReference<>() {});
    Map<String, Object> document = new LinkedHashMap<>(source);
    String key = rowKey(termId, parentBusinessVersion, businessVersion);
    document.put("rowKey", key);
    document.put("termId", termId.toString());
    document.put("id", termId.toString());
    document.put("glossaryId", glossaryId.toString());
    document.put("parentBusinessVersion", parentBusinessVersion);
    document.put("businessVersion", businessVersion);
    document.put("businessVersionSortKey", businessVersionSortKey(businessVersion));
    document.put("recordType", recordType);
    document.put("normalizedName", normalize(String.valueOf(source.getOrDefault("name", ""))));
    document.put("domainIds", referenceIds(source.get("domains")));
    document.put("ownerIds", referenceIds(source.get("owners")));
    document.put("reviewerIds", referenceIds(source.get("reviewers")));
    document.put("dataSourceTags", tagFqns(source.get("tags"), "DataSource"));
    document.put("classificationTags", tagFqns(source.get("tags"), "DataClassification"));
    document.put(
        "cdeSort",
        Map.of(
            "normalizedName", document.get("normalizedName"),
            "displayName", normalize(String.valueOf(source.getOrDefault("displayName", ""))),
            "businessVersion", document.get("businessVersionSortKey"),
            "entityStatus", String.valueOf(source.getOrDefault("entityStatus", ""))));
    return document;
  }

  static String rowKey(PublishedSnapshotRecord record) {
    return rowKey(record.entityId(), record.parentBusinessVersion(), record.businessVersion());
  }

  static String rowKey(WorkingVersionRecord record) {
    return rowKey(record.entityId(), record.parentBusinessVersion(), record.businessVersion());
  }

  public static String rowKey(UUID termId, String parentVersion, String businessVersion) {
    return termId + "\u001f" + parentVersion + "\u001f" + businessVersion;
  }

  public static String documentId(String rowKey) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(rowKey.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required", exception);
    }
  }

  public static String businessVersionSortKey(String businessVersion) {
    String[] segments = businessVersion.split("\\.");
    List<String> normalized = new ArrayList<>(segments.length);
    for (String segment : segments) {
      String digits = new BigInteger(segment).toString();
      normalized.add(String.format(Locale.ROOT, "%04d:%s", digits.length(), digits));
    }
    return String.join(".", normalized);
  }

  private static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFKC).trim().toLowerCase(Locale.ROOT);
  }

  private static List<String> referenceIds(Object raw) {
    if (!(raw instanceof List<?> values)) {
      return List.of();
    }
    return values.stream()
        .filter(Map.class::isInstance)
        .map(Map.class::cast)
        .map(value -> value.get("id"))
        .filter(java.util.Objects::nonNull)
        .map(String::valueOf)
        .distinct()
        .toList();
  }

  private static List<String> tagFqns(Object raw, String classification) {
    if (!(raw instanceof List<?> values)) {
      return List.of();
    }
    String prefix = classification + ".";
    return values.stream()
        .filter(Map.class::isInstance)
        .map(Map.class::cast)
        .map(value -> value.get("tagFQN"))
        .filter(java.util.Objects::nonNull)
        .map(String::valueOf)
        .filter(value -> value.equals(classification) || value.startsWith(prefix))
        .distinct()
        .toList();
  }

  public record IndexedDocument(String id, Map<String, Object> source) {}
}
