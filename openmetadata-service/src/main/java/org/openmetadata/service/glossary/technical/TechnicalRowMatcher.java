/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.BadRequestException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Validates and applies the Technical Dictionary specific list filters. */
public final class TechnicalRowMatcher {
  public static final String SOURCE_SERVICES = "sourceServices";
  public static final String CDE_MAPPING = "cdeMapping";
  public static final String CDE_TERM_IDS = "cdeTermIds";
  public static final String SYSTEM_OWNER_IDS = "systemOwnerIds";
  public static final String SOURCE_STATUSES = "sourceStatuses";
  public static final String VERSION_VIEW = "versionView";

  public static final String MAPPED = "MAPPED";
  public static final String UNMAPPED = "UNMAPPED";
  public static final String LATEST = "LATEST";
  public static final String ALL = "ALL";

  private static final Set<String> MAPPING_VALUES = Set.of(MAPPED, UNMAPPED);
  private static final Set<String> SOURCE_STATUS_VALUES =
      Set.of(
          TechnicalDictionaryProfile.SOURCE_AVAILABLE,
          TechnicalDictionaryProfile.SOURCE_UNAVAILABLE,
          TechnicalDictionaryProfile.SOURCE_CHANGED);
  private static final int MAX_VALUES = 50;

  private TechnicalRowMatcher() {}

  /** Parses raw CSV request parameters; unknown or malformed values are a client error. */
  public static Map<String, List<String>> validate(Map<String, String> raw) {
    final Map<String, List<String>> filters = new LinkedHashMap<>();
    put(
        filters,
        SOURCE_SERVICES,
        csv(raw.get(SOURCE_SERVICES)).stream()
            .map(value -> value.toLowerCase(Locale.ROOT))
            .toList());
    put(filters, CDE_MAPPING, allowed(CDE_MAPPING, csv(raw.get(CDE_MAPPING)), MAPPING_VALUES));
    put(filters, CDE_TERM_IDS, uuids(CDE_TERM_IDS, csv(raw.get(CDE_TERM_IDS))));
    put(filters, SYSTEM_OWNER_IDS, uuids(SYSTEM_OWNER_IDS, csv(raw.get(SYSTEM_OWNER_IDS))));
    put(
        filters,
        SOURCE_STATUSES,
        allowed(SOURCE_STATUSES, csv(raw.get(SOURCE_STATUSES)), SOURCE_STATUS_VALUES));
    filters.put(VERSION_VIEW, List.of(versionView(raw.get(VERSION_VIEW))));
    return filters;
  }

  public static boolean matches(Map<String, Object> row, Map<String, List<String>> filters) {
    return anyOf(
            filters,
            SOURCE_SERVICES,
            lower(TechnicalRowFields.extensionText(row, TechnicalDictionaryProfile.SOURCE_SERVICE)))
        && anyOf(filters, CDE_MAPPING, TechnicalRowFields.cdeId(row) == null ? UNMAPPED : MAPPED)
        && anyOf(filters, CDE_TERM_IDS, TechnicalRowFields.cdeId(row))
        && anyOf(filters, SYSTEM_OWNER_IDS, TechnicalRowFields.systemOwnerId(row))
        && anyOf(
            filters,
            SOURCE_STATUSES,
            TechnicalRowFields.text(row, TechnicalRowFields.SOURCE_STATUS));
  }

  public static boolean matchesText(Map<String, Object> row, String normalizedNeedle) {
    return TechnicalRowFields.text(row, TechnicalRowFields.SEARCH_TEXT).contains(normalizedNeedle);
  }

  /** Keeps, per record identity, the newest representation (a working row wins a version tie). */
  public static List<Map<String, Object>> keepLatest(List<Map<String, Object>> rows) {
    final Map<String, Map<String, Object>> latest = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      latest.merge(String.valueOf(row.get("termId")), row, TechnicalRowMatcher::newer);
    }
    return new ArrayList<>(latest.values());
  }

  public static boolean wantsLatest(Map<String, List<String>> filters) {
    final List<String> view = filters.get(VERSION_VIEW);
    return view == null || view.isEmpty() || LATEST.equals(view.getFirst());
  }

  private static Map<String, Object> newer(Map<String, Object> left, Map<String, Object> right) {
    final int comparison = compareVersions(version(left), version(right));
    final boolean rightWins =
        comparison < 0 || (comparison == 0 && "working".equals(right.get("recordType")));
    return rightWins ? right : left;
  }

  private static String version(Map<String, Object> row) {
    return String.valueOf(row.get("businessVersion"));
  }

  static int compareVersions(String left, String right) {
    final String[] leftParts = left.split("\\.");
    final String[] rightParts = right.split("\\.");
    int result = 0;
    for (int index = 0;
        result == 0 && index < Math.max(leftParts.length, rightParts.length);
        index++) {
      result = part(leftParts, index).compareTo(part(rightParts, index));
    }
    return result;
  }

  private static BigInteger part(String[] parts, int index) {
    return index < parts.length ? new BigInteger(parts[index]) : BigInteger.ZERO;
  }

  private static boolean anyOf(Map<String, List<String>> filters, String key, String actual) {
    final List<String> wanted = filters.get(key);
    return wanted == null || wanted.isEmpty() || (actual != null && wanted.contains(actual));
  }

  private static void put(Map<String, List<String>> filters, String key, List<String> values) {
    if (!values.isEmpty()) {
      filters.put(key, values);
    }
  }

  private static List<String> csv(String value) {
    final List<String> result = new ArrayList<>();
    if (value != null && !value.isBlank()) {
      for (String item : value.split(",", -1)) {
        final String trimmed = item.trim();
        if (trimmed.isEmpty() || result.contains(trimmed) || result.size() >= MAX_VALUES) {
          throw new BadRequestException(
              "Filter values must be unique, non-empty and at most " + MAX_VALUES);
        }
        result.add(trimmed);
      }
    }
    return result;
  }

  private static List<String> allowed(String name, List<String> values, Set<String> allowlist) {
    if (!allowlist.containsAll(values)) {
      throw new BadRequestException(name + " contains an unsupported value");
    }
    return values;
  }

  private static List<String> uuids(String name, List<String> values) {
    for (String value : values) {
      try {
        UUID.fromString(value);
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException(name + " contains an invalid UUID");
      }
    }
    return values.stream().map(value -> value.toLowerCase(Locale.ROOT)).toList();
  }

  private static String versionView(String value) {
    final String normalized = value == null || value.isBlank() ? LATEST : value.trim();
    if (!LATEST.equals(normalized) && !ALL.equals(normalized)) {
      throw new BadRequestException("versionView must be LATEST or ALL");
    }
    return normalized;
  }

  private static String lower(String value) {
    return value.toLowerCase(Locale.ROOT);
  }
}
