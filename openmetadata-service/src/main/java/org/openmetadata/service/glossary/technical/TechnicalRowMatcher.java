/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Validates the Technical Dictionary list filters sent as request parameters. */
public final class TechnicalRowMatcher {
  public static final String SOURCE_SERVICES = "sourceServices";
  public static final String CDE_MAPPING = "cdeMapping";
  public static final String CDE_TERM_IDS = "cdeTermIds";
  public static final String SYSTEM_OWNER_IDS = "systemOwnerIds";
  public static final String SOURCE_STATUSES = "sourceStatuses";
  public static final String ELEMENT_TYPES = "elementTypes";
  public static final String GENERATION_TYPES = "generationTypes";
  public static final String CREATION_METHODS = "creationMethods";
  public static final String TIMELINESS = "timeliness";

  public static final String MAPPED = "MAPPED";
  public static final String UNMAPPED = "UNMAPPED";

  private static final Set<String> MAPPING_VALUES = Set.of(MAPPED, UNMAPPED);
  private static final Set<String> SOURCE_STATUS_VALUES =
      Set.of(
          TechnicalDictionaryProfile.SOURCE_AVAILABLE,
          TechnicalDictionaryProfile.SOURCE_UNAVAILABLE,
          TechnicalDictionaryProfile.SOURCE_CHANGED);
  private static final int MAX_VALUES = 50;
  private static final Map<String, String> TAG_FILTERS = tagFilters();

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
    TAG_FILTERS.forEach(
        (param, classification) ->
            put(filters, param, tagFqns(param, classification, csv(raw.get(param)))));
    return filters;
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

  private static Map<String, String> tagFilters() {
    final Map<String, String> filters = new LinkedHashMap<>();
    filters.put(ELEMENT_TYPES, TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION);
    filters.put(GENERATION_TYPES, TechnicalDictionaryProfile.GENERATION_TYPE_CLASSIFICATION);
    filters.put(CREATION_METHODS, TechnicalDictionaryProfile.CREATION_METHOD_CLASSIFICATION);
    filters.put(TIMELINESS, TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION);
    return filters;
  }

  private static List<String> tagFqns(String name, String classification, List<String> values) {
    if (values.stream().anyMatch(value -> !value.startsWith(classification + "."))) {
      throw new BadRequestException(name + " must contain " + classification + " tags");
    }
    return values;
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
}
