/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import jakarta.ws.rs.BadRequestException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.glossary.technical.TechnicalRowMatcher;
import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService;
import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService.Criteria;

/**
 * Validates raw Technical Dictionary list parameters with the rules the governed list already
 * uses (page sizes, text length, statuses, filter values) and turns them into index criteria.
 */
public final class TechnicalSearchParameters {
  public static final String Q = "q";
  public static final String STATUSES = "statuses";
  public static final int SCAN_PAGE_SIZE = 10;

  /** Request parameter names of the Technical Dictionary specific filters. */
  public static final List<String> FILTER_NAMES =
      List.of(
          TechnicalRowMatcher.SOURCE_SERVICES,
          TechnicalRowMatcher.CDE_MAPPING,
          TechnicalRowMatcher.CDE_TERM_IDS,
          TechnicalRowMatcher.SYSTEM_OWNER_IDS,
          TechnicalRowMatcher.SOURCE_STATUSES,
          TechnicalRowMatcher.ELEMENT_TYPES,
          TechnicalRowMatcher.GENERATION_TYPES,
          TechnicalRowMatcher.CREATION_METHODS,
          TechnicalRowMatcher.TIMELINESS);

  private TechnicalSearchParameters() {}

  /** The scope a caller reads, already authorized. */
  public record ReadScope(
      UUID glossaryId, String parentBusinessVersion, boolean consumerOnly, boolean archived) {}

  /** {@code parameters} holds {@link #Q}, {@link #STATUSES} and the {@link #FILTER_NAMES}. */
  public static TechnicalSearchCriteria criteria(
      ReadScope scope, Map<String, String> parameters, int limit, int offset) {
    final Criteria validated =
        GlossaryBusinessVersionSearchService.validate(
            new Criteria(
                scope.glossaryId(),
                scope.parentBusinessVersion(),
                parameters.get(Q),
                GlossaryBusinessVersionSearchService.splitCsvParameter(parameters.get(STATUSES)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                limit,
                offset),
            scope.consumerOnly(),
            scope.archived());
    requireArchivedStatusInArchivedScope(validated, scope.archived());
    return new TechnicalSearchCriteria(
        scope.glossaryId(),
        validated.parentBusinessVersion(),
        scope.consumerOnly(),
        validated.q(),
        validated.statuses(),
        indexFilters(parameters),
        limit,
        offset);
  }

  /** Criteria of a full scan (bulk selection, export): no page, same filters. */
  public static TechnicalSearchCriteria scanCriteria(ReadScope scope, Map<String, String> parameters) {
    return criteria(scope, parameters, SCAN_PAGE_SIZE, 0);
  }

  private static void requireArchivedStatusInArchivedScope(Criteria criteria, boolean archived) {
    if (!archived && criteria.statuses().contains(EntityStatus.ARCHIVED.value())) {
      throw new BadRequestException("Archived status is only valid for an archived scope");
    }
  }

  /** Validated filters; there is no version view (TDX-12). */
  static Map<String, List<String>> indexFilters(Map<String, String> raw) {
    final Map<String, String> known = new LinkedHashMap<>();
    FILTER_NAMES.forEach(name -> known.put(name, raw.get(name)));
    return TechnicalRowMatcher.validate(known);
  }

  /** Raw request parameters: text, statuses, then the filters in {@link #FILTER_NAMES} order. */
  public static Map<String, String> parameters(String q, String statuses, String... filters) {
    final Map<String, String> parameters = new LinkedHashMap<>();
    parameters.put(Q, q);
    parameters.put(STATUSES, statuses);
    for (int index = 0; index < FILTER_NAMES.size(); index++) {
      parameters.put(FILTER_NAMES.get(index), index < filters.length ? filters[index] : null);
    }
    return parameters;
  }
}
