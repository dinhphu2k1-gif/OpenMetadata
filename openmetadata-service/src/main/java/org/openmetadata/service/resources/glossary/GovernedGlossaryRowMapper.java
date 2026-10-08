/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import java.math.BigInteger;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.service.glossary.search.GovernedGlossaryText;
import org.openmetadata.service.glossary.versioning.CdeReleaseVersionType;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/** Single projection from governed glossary records to API/index flat rows. */
public final class GovernedGlossaryRowMapper {
  public static final String ARCHIVED = "archived";
  public static final String DELETED = "deleted";
  public static final String PUBLISHED = "published";
  public static final String WORKING = "working";

  private GovernedGlossaryRowMapper() {}

  public static Map<String, Object> published(
      final PublishedSnapshotRecord record, final String parentVersion, final String recordType) {
    final Map<String, Object> row = new LinkedHashMap<>(GlossaryVersionResponses.published(record));
    normalize(row, record.entityId(), parentVersion, recordType);
    return row;
  }

  public static Map<String, Object> working(
      final WorkingVersionRecord record, final String parentVersion) {
    final Map<String, Object> row = new LinkedHashMap<>(GlossaryVersionResponses.working(record));
    normalize(row, record.entityId(), parentVersion, WORKING);
    return row;
  }

  public static void normalize(
      final Map<String, Object> row,
      final UUID termId,
      final String parentBusinessVersion,
      final String recordType) {
    row.put("termId", termId.toString());
    row.put("id", termId.toString());
    row.put("parentBusinessVersion", parentBusinessVersion);
    row.put("recordType", recordType);
    row.putIfAbsent("displayName", null);
    row.putIfAbsent("description", null);
    row.putIfAbsent("owners", List.of());
    row.putIfAbsent("reviewers", List.of());
    row.putIfAbsent("domains", List.of());
    row.putIfAbsent("tags", List.of());
    row.putIfAbsent("extension", Map.of());
    projectReleaseType(row);
  }

  private static void projectReleaseType(final Map<String, Object> row) {
    final Object businessVersion = row.get("businessVersion");
    if (businessVersion != null) {
      CdeReleaseVersionType.project(row, String.valueOf(businessVersion));
    }
  }

  public static Comparator<Map<String, Object>> defaultComparator() {
    return Comparator.<Map<String, Object>, String>comparing(row -> searchable(row.get("name")))
        .thenComparing(
            (left, right) ->
                compareNumericVersion(
                    String.valueOf(right.get("businessVersion")),
                    String.valueOf(left.get("businessVersion"))))
        .thenComparing(row -> String.valueOf(row.get("termId")))
        .thenComparing(row -> String.valueOf(row.get("recordType")));
  }

  public static String searchable(final Object value) {
    return GovernedGlossaryText.normalize(value);
  }

  private static int compareNumericVersion(final String left, final String right) {
    final String[] leftParts = left.split("\\.");
    final String[] rightParts = right.split("\\.");
    final int length = Math.max(leftParts.length, rightParts.length);
    int result = 0;
    for (int index = 0; index < length && result == 0; index++) {
      final BigInteger leftPart = part(leftParts, index);
      final BigInteger rightPart = part(rightParts, index);
      result = leftPart.compareTo(rightPart);
    }
    return result;
  }

  private static BigInteger part(final String[] parts, final int index) {
    return index < parts.length ? new BigInteger(parts[index]) : BigInteger.ZERO;
  }
}
