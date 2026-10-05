/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import jakarta.ws.rs.BadRequestException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.glossary.technical.TechnicalRowMatcher;

/** Validates raw Technical Dictionary list parameters and turns them into index criteria. */
public final class TechnicalSearchParameters {
  public static final String Q = "q";
  private static final int MAX_QUERY_LENGTH = 200;
  private static final Set<Integer> PAGE_SIZES = Set.of(10, 15, 25, 50);

  /** Request parameter names of the Technical Dictionary specific filters. */
  public static final List<String> FILTER_NAMES =
      List.of(
          TechnicalRowMatcher.SOURCE_SERVICES,
          TechnicalRowMatcher.CDE_MAPPING,
          TechnicalRowMatcher.CDE_TERM_IDS,
          TechnicalRowMatcher.SYSTEM_OWNER_IDS,
          TechnicalRowMatcher.SOURCE_STATUSES,
          TechnicalRowMatcher.STATUSES,
          TechnicalRowMatcher.ELEMENT_TYPES,
          TechnicalRowMatcher.GENERATION_TYPES,
          TechnicalRowMatcher.CREATION_METHODS,
          TechnicalRowMatcher.TIMELINESS);

  private TechnicalSearchParameters() {}

  /** {@code parameters} holds {@link #Q} and the {@link #FILTER_NAMES}. */
  public static TechnicalSearchCriteria criteria(
      String dataDictionaryVersion, Map<String, String> parameters, int limit, int offset) {
    requirePage(limit, offset);
    return new TechnicalSearchCriteria(
        dataDictionaryVersion, text(parameters.get(Q)), indexFilters(parameters), limit, offset);
  }

  /** Same filters without a page, for exports and full scans. */
  public static TechnicalSearchCriteria scanCriteria(
      String dataDictionaryVersion, Map<String, String> parameters) {
    return new TechnicalSearchCriteria(
        dataDictionaryVersion, text(parameters.get(Q)), indexFilters(parameters), 0, 0);
  }

  private static void requirePage(int limit, int offset) {
    if (!PAGE_SIZES.contains(limit)) {
      throw new BadRequestException("limit must be one of 10, 15, 25, or 50");
    }
    if (offset < 0) {
      throw new BadRequestException("offset must be greater than or equal to 0");
    }
  }

  private static String text(String raw) {
    final String value = raw == null || raw.isBlank() ? null : raw.trim();
    if (value != null && value.codePointCount(0, value.length()) > MAX_QUERY_LENGTH) {
      throw new BadRequestException("q must not exceed 200 characters");
    }
    return value;
  }

  static Map<String, List<String>> indexFilters(Map<String, String> raw) {
    final Map<String, String> known = new LinkedHashMap<>();
    FILTER_NAMES.forEach(name -> known.put(name, raw.get(name)));
    return TechnicalRowMatcher.validate(known);
  }

  /** Raw request parameters: text, then the filters in {@link #FILTER_NAMES} order. */
  public static Map<String, String> parameters(String q, String... filters) {
    final Map<String, String> parameters = new LinkedHashMap<>();
    parameters.put(Q, q);
    for (int index = 0; index < FILTER_NAMES.size(); index++) {
      parameters.put(FILTER_NAMES.get(index), index < filters.length ? filters[index] : null);
    }
    return parameters;
  }
}
