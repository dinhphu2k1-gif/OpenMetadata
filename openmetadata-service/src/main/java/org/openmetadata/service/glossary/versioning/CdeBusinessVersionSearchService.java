/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import java.math.BigInteger;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Search and filter boundary over the authoritative database-backed CDE flat read model. */
public class CdeBusinessVersionSearchService {
  private static final Set<Integer> PAGE_SIZES = Set.of(10, 15, 25, 50);
  private static final Set<String> STATUSES =
      Set.of("Draft", "In Review", "Rejected", "Approved", "Archived");
  private static final Set<String> SORT_FIELDS =
      Set.of("name", "displayName", "businessVersion", "entityStatus");
  private static final int MAX_QUERY_LENGTH = 200;
  private static final int MAX_FILTER_VALUES = 50;

  public Map<String, Object> search(
      Criteria criteria,
      List<Map<String, Object>> authorizedDatabaseRows,
      boolean consumerOnly,
      boolean archivedScope) {
    Criteria validated = validate(criteria, consumerOnly, archivedScope);
    List<Map<String, Object>> filtered =
        authorizedDatabaseRows.stream()
            .filter(row -> matches(row, validated))
            .sorted(comparator(validated))
            .toList();
    int total = filtered.size();
    int from = Math.min(validated.offset(), total);
    int to = Math.min(from + validated.limit(), total);
    return Map.of(
        "data",
        new ArrayList<>(filtered.subList(from, to)),
        "paging",
        Map.of("total", total, "limit", validated.limit(), "offset", validated.offset()));
  }

  public static Criteria validate(Criteria criteria, boolean consumerOnly) {
    return validate(criteria, consumerOnly, false);
  }

  public static Criteria validate(
      Criteria criteria, boolean consumerOnly, boolean archivedScope) {
    if (criteria == null) {
      throw new BadRequestException("Search criteria are required");
    }
    if (criteria.glossaryId() == null) {
      throw new BadRequestException("glossary is required");
    }
    String parentVersion;
    try {
      parentVersion =
          org.openmetadata.service.util.GlossaryBusinessVersion.requireCanonicalDictionary(
              criteria.parentBusinessVersion());
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    if (!PAGE_SIZES.contains(criteria.limit())) {
      throw new BadRequestException("limit must be one of 10, 15, 25, or 50");
    }
    if (criteria.offset() < 0) {
      throw new BadRequestException("offset must be greater than or equal to 0");
    }
    String q = normalizeOptional(criteria.q());
    if (q != null && q.codePointCount(0, q.length()) > MAX_QUERY_LENGTH) {
      throw new BadRequestException("q must not exceed 200 characters");
    }
    List<String> statuses = parseValues(criteria.statuses(), "statuses");
    if (!STATUSES.containsAll(statuses)) {
      throw new BadRequestException("statuses contains an unsupported value");
    }
    if (consumerOnly) {
      statuses = List.of(archivedScope ? "Archived" : "Approved");
    }
    List<String> domainIds = parseUuids(criteria.domainIds(), "domainIds");
    List<String> ownerIds = parseUuids(criteria.ownerIds(), "ownerIds");
    List<String> dataSourceTags = parseFqns(criteria.dataSourceTags(), "dataSourceTags");
    List<String> classificationTags =
        parseFqns(criteria.classificationTags(), "classificationTags");
    String sortField = normalizeOptional(criteria.sortField());
    String sortOrder = normalizeOptional(criteria.sortOrder());
    if (sortField != null && !SORT_FIELDS.contains(sortField)) {
      throw new BadRequestException("sortField contains an unsupported value");
    }
    if (sortOrder != null && !Set.of("asc", "desc").contains(sortOrder)) {
      throw new BadRequestException("sortOrder must be asc or desc");
    }
    if (sortOrder != null && sortField == null) {
      throw new BadRequestException("sortField is required when sortOrder is present");
    }
    return new Criteria(
        criteria.glossaryId(),
        parentVersion,
        q,
        statuses,
        domainIds,
        ownerIds,
        dataSourceTags,
        classificationTags,
        sortField,
        sortOrder,
        criteria.limit(),
        criteria.offset());
  }

  private static boolean matches(Map<String, Object> row, Criteria criteria) {
    if (!criteria.statuses().isEmpty()
        && !criteria.statuses().contains(String.valueOf(row.get("entityStatus")))) {
      return false;
    }
    if (criteria.q() != null) {
      String needle = searchable(criteria.q());
      if (!searchable(row.get("name")).contains(needle)
          && !searchable(row.get("displayName")).contains(needle)) {
        return false;
      }
    }
    return matchesReferences(row.get("domains"), criteria.domainIds(), "id")
        && matchesReferences(row.get("owners"), criteria.ownerIds(), "id")
        && matchesReferences(row.get("tags"), criteria.dataSourceTags(), "tagFQN")
        && matchesReferences(row.get("tags"), criteria.classificationTags(), "tagFQN");
  }

  private static boolean matchesReferences(Object raw, List<String> requested, String key) {
    if (requested.isEmpty()) {
      return true;
    }
    if (!(raw instanceof List<?> values)) {
      return false;
    }
    Set<String> actual = new LinkedHashSet<>();
    for (Object value : values) {
      if (value instanceof Map<?, ?> reference && reference.get(key) != null) {
        actual.add(String.valueOf(reference.get(key)));
      }
    }
    return requested.stream().anyMatch(actual::contains);
  }

  private static Comparator<Map<String, Object>> comparator(Criteria criteria) {
    Comparator<Map<String, Object>> primary =
        switch (criteria.sortField() == null ? "name" : criteria.sortField()) {
          case "displayName" -> Comparator.comparing(row -> searchable(row.get("displayName")));
          case "entityStatus" -> Comparator.comparing(row -> searchable(row.get("entityStatus")));
          case "businessVersion" ->
              (left, right) ->
                  compareNumericVersion(
                      String.valueOf(left.get("businessVersion")),
                      String.valueOf(right.get("businessVersion")));
          default -> Comparator.comparing(row -> searchable(row.get("name")));
        };
    if (criteria.sortField() == null) {
      primary =
          primary.thenComparing(
              (left, right) ->
                  compareNumericVersion(
                      String.valueOf(right.get("businessVersion")),
                      String.valueOf(left.get("businessVersion"))));
    } else if ("desc".equals(criteria.sortOrder())) {
      primary = primary.reversed();
    }
    return primary
        .thenComparing(row -> String.valueOf(row.get("termId")))
        .thenComparing(row -> String.valueOf(row.get("recordType")));
  }

  private static int compareNumericVersion(String left, String right) {
    String[] leftParts = left.split("\\.");
    String[] rightParts = right.split("\\.");
    int length = Math.max(leftParts.length, rightParts.length);
    for (int index = 0; index < length; index++) {
      BigInteger leftPart =
          index < leftParts.length ? new BigInteger(leftParts[index]) : BigInteger.ZERO;
      BigInteger rightPart =
          index < rightParts.length ? new BigInteger(rightParts[index]) : BigInteger.ZERO;
      int compared = leftPart.compareTo(rightPart);
      if (compared != 0) {
        return compared;
      }
    }
    return 0;
  }

  public static List<String> splitCsvParameter(String value) {
    if (value == null || value.trim().isEmpty()) {
      return List.of();
    }
    return List.of(value.split(",", -1));
  }

  private static List<String> parseUuids(List<String> values, String field) {
    List<String> parsed = parseValues(values, field);
    for (String value : parsed) {
      try {
        UUID.fromString(value);
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException(field + " contains an invalid UUID");
      }
    }
    return parsed;
  }

  private static List<String> parseFqns(List<String> values, String field) {
    List<String> parsed = parseValues(values, field);
    if (parsed.stream().anyMatch(value -> value.startsWith(".") || value.endsWith("."))) {
      throw new BadRequestException(field + " contains an invalid FQN");
    }
    return parsed;
  }

  private static List<String> parseValues(List<String> values, String field) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    if (values.size() > MAX_FILTER_VALUES) {
      throw new BadRequestException(field + " has too many values");
    }
    LinkedHashSet<String> unique = new LinkedHashSet<>();
    for (String raw : values) {
      String value = normalizeOptional(raw);
      if (value == null) {
        throw new BadRequestException(field + " contains an empty value");
      }
      if (!unique.add(value)) {
        throw new BadRequestException(field + " contains a duplicate value");
      }
    }
    return List.copyOf(unique);
  }

  private static String normalizeOptional(String value) {
    if (value == null || value.trim().isEmpty()) {
      return null;
    }
    return Normalizer.normalize(value.trim(), Normalizer.Form.NFC);
  }

  private static String searchable(Object value) {
    return Normalizer.normalize(
            value == null ? "" : String.valueOf(value), Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT);
  }

  public record Criteria(
      UUID glossaryId,
      String parentBusinessVersion,
      String q,
      List<String> statuses,
      List<String> domainIds,
      List<String> ownerIds,
      List<String> dataSourceTags,
      List<String> classificationTags,
      String sortField,
      String sortOrder,
      int limit,
      int offset) {}
}
