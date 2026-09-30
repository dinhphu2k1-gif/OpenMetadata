/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.service.glossary.technical.TechnicalRowMatcher;

/**
 * Builds every search body sent to `technical_dictionary_search_index` from validated parameters.
 * The client never sends a query: scope, permission and filters are always added here.
 */
public final class TechnicalSearchQueryBuilder {
  public static final int MAX_RESULT_WINDOW = 10_000;
  static final int MIN_NGRAM_LENGTH = 3;
  private static final int CARDINALITY_PRECISION = 40_000;
  private static final String BOOL = "bool";
  private static final String FILTER = "filter";
  private static final String MUST = "must";
  private static final String MUST_NOT = "must_not";
  private static final String SHOULD = "should";
  private static final String MINIMUM_SHOULD_MATCH = "minimum_should_match";
  private static final String TERM = "term";
  private static final String TERMS = "terms";
  private static final String EXISTS = "exists";
  private static final String FIELD = "field";
  private static final String ASC = "asc";
  private static final String WILDCARD_ANY = "*";
  public static final String TABLES_AGGREGATION = "tables";
  public static final String SOURCES_AGGREGATION = "sources";
  public static final String APPROVED_AGGREGATION = "approved";

  private static final List<String> LOCATION_SEARCH_FIELDS =
      List.of(
          TechnicalIndexFields.DATABASE,
          TechnicalIndexFields.SCHEMA,
          TechnicalIndexFields.TABLE,
          TechnicalIndexFields.COLUMN);
  private static final Map<String, List<String>> VIEW_FILTER_FIELDS = viewFilterFields();

  private TechnicalSearchQueryBuilder() {}

  private static Map<String, List<String>> viewFilterFields() {
    final Map<String, List<String>> fields = new LinkedHashMap<>();
    fields.put(TechnicalRowMatcher.CDE_TERM_IDS, List.of(TechnicalIndexFields.CDE, TechnicalIndexFields.ID));
    fields.put(
        TechnicalRowMatcher.SYSTEM_OWNER_IDS,
        List.of(TechnicalIndexFields.SYSTEM_OWNER, TechnicalIndexFields.ID));
    fields.put(
        TechnicalRowMatcher.ELEMENT_TYPES,
        List.of(TechnicalIndexFields.ELEMENT_TYPE, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.GENERATION_TYPES,
        List.of(TechnicalIndexFields.GENERATION_TYPE, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.CREATION_METHODS,
        List.of(TechnicalIndexFields.CREATION_METHOD, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.TIMELINESS,
        List.of(TechnicalIndexFields.TIMELINESS, TechnicalIndexFields.FQN));
    return fields;
  }

  /** One page of rows, sorted by Column FQN. */
  public static Map<String, Object> searchBody(TechnicalSearchCriteria criteria) {
    requireWithinWindow(criteria.offset(), criteria.limit());
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("from", criteria.offset());
    body.put("size", criteria.limit());
    body.put("track_total_hits", true);
    body.put("sort", defaultSort());
    body.put("query", query(criteria));
    return body;
  }

  static void requireWithinWindow(int offset, int limit) {
    if ((long) offset + limit > MAX_RESULT_WINDOW) {
      throw new BadRequestException(
          String.format(
              "Only the first %d results can be paged; narrow the filters", MAX_RESULT_WINDOW));
    }
  }

  public static List<Object> defaultSort() {
    return List.of(
        Map.of(TechnicalIndexFields.COLUMN_FQN, ASC), Map.of(TechnicalIndexFields.TERM_ID, ASC));
  }

  /** Scope, permission, text search and filters of the criteria. */
  public static Map<String, Object> query(TechnicalSearchCriteria criteria) {
    final List<Object> filter = scopeFilters(criteria);
    final List<Object> mustNot = new ArrayList<>();
    addStatusFilter(filter, criteria);
    addFieldFilters(filter, criteria);
    addCdeMapping(filter, mustNot, criteria);
    final Map<String, Object> bool = new LinkedHashMap<>();
    bool.put(FILTER, filter);
    if (!nullOrEmpty(criteria.q())) {
      bool.put(MUST, List.of(textQuery(criteria.q(), criteria.view())));
    }
    if (!mustNot.isEmpty()) {
      bool.put(MUST_NOT, mustNot);
    }
    return Map.of(BOOL, bool);
  }

  private static List<Object> scopeFilters(TechnicalSearchCriteria criteria) {
    final List<Object> filter = new ArrayList<>();
    filter.add(term(TechnicalIndexFields.GLOSSARY_ID, criteria.glossaryId().toString()));
    filter.add(term(TechnicalIndexFields.PARENT_BUSINESS_VERSION, criteria.parentBusinessVersion()));
    if (criteria.consumerOnly()) {
      filter.add(term(TechnicalIndexFields.HAS_PUBLISHED, true));
    }
    return filter;
  }

  private static void addStatusFilter(List<Object> filter, TechnicalSearchCriteria criteria) {
    if (!criteria.statuses().isEmpty()) {
      filter.add(
          terms(
              TechnicalIndexFields.viewField(criteria.view(), TechnicalIndexFields.ENTITY_STATUS),
              criteria.statuses()));
    }
  }

  private static void addFieldFilters(List<Object> filter, TechnicalSearchCriteria criteria) {
    addTerms(filter, TechnicalIndexFields.SERVICE, criteria.filters().get(TechnicalRowMatcher.SOURCE_SERVICES));
    addTerms(
        filter,
        TechnicalIndexFields.SOURCE_STATUS,
        criteria.filters().get(TechnicalRowMatcher.SOURCE_STATUSES));
    VIEW_FILTER_FIELDS.forEach(
        (parameter, path) ->
            addTerms(
                filter,
                TechnicalIndexFields.viewField(criteria.view(), path.toArray(String[]::new)),
                criteria.filters().get(parameter)));
  }

  private static void addTerms(List<Object> filter, String field, List<String> values) {
    if (!nullOrEmpty(values)) {
      filter.add(terms(field, values));
    }
  }

  /** "Mapped" and "not mapped" together select every record, so only a single value filters. */
  private static void addCdeMapping(
      List<Object> filter, List<Object> mustNot, TechnicalSearchCriteria criteria) {
    final List<String> mapping = criteria.filters().getOrDefault(TechnicalRowMatcher.CDE_MAPPING, List.of());
    final Map<String, Object> hasCde =
        Map.of(
            EXISTS,
            Map.of(
                FIELD,
                TechnicalIndexFields.viewField(
                    criteria.view(), TechnicalIndexFields.CDE, TechnicalIndexFields.ID)));
    if (mapping.size() == 1 && TechnicalRowMatcher.MAPPED.equals(mapping.getFirst())) {
      filter.add(hasCde);
    } else if (mapping.size() == 1 && TechnicalRowMatcher.UNMAPPED.equals(mapping.getFirst())) {
      mustNot.add(hasCde);
    }
  }

  /**
   * Partial match on database, schema, table, Column, CDE code and CDE name. Terms of three or more
   * characters use the ngram sub-fields; shorter ones fall back to a substring wildcard.
   */
  static Map<String, Object> textQuery(String q, String view) {
    final String text = q.trim().toLowerCase(Locale.ROOT);
    return text.codePointCount(0, text.length()) >= MIN_NGRAM_LENGTH
        ? ngramQuery(text, view)
        : wildcardQuery(text, view);
  }

  private static Map<String, Object> ngramQuery(String text, String view) {
    final List<String> fields =
        searchFields(view).stream().map(field -> field + "." + TechnicalIndexFields.NGRAM).toList();
    final Map<String, Object> multiMatch = new LinkedHashMap<>();
    multiMatch.put("query", text);
    multiMatch.put("type", "cross_fields");
    multiMatch.put("operator", "and");
    multiMatch.put("fields", fields);
    return Map.of("multi_match", multiMatch);
  }

  private static Map<String, Object> wildcardQuery(String text, String view) {
    final String pattern = WILDCARD_ANY + escapeWildcard(text) + WILDCARD_ANY;
    final List<Object> clauses =
        searchFields(view).stream()
            .map(field -> (Object) Map.of("wildcard", Map.of(field, Map.of("value", pattern))))
            .toList();
    return Map.of(BOOL, Map.of(SHOULD, clauses, MINIMUM_SHOULD_MATCH, 1));
  }

  private static List<String> searchFields(String view) {
    final List<String> fields = new ArrayList<>(LOCATION_SEARCH_FIELDS);
    fields.add(TechnicalIndexFields.viewField(view, TechnicalIndexFields.CDE, TechnicalIndexFields.CODE));
    fields.add(TechnicalIndexFields.viewField(view, TechnicalIndexFields.CDE, TechnicalIndexFields.NAME));
    return fields;
  }

  static String escapeWildcard(String value) {
    return value.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }

  /** Header statistics (TDX-10) over the same scope and permission as the list. */
  public static Map<String, Object> statsBody(TechnicalSearchCriteria scope) {
    final Map<String, Object> aggregations = new LinkedHashMap<>();
    aggregations.put(TABLES_AGGREGATION, cardinality(TechnicalIndexFields.TABLE_KEY));
    aggregations.put(SOURCES_AGGREGATION, cardinality(TechnicalIndexFields.SERVICE));
    aggregations.put(APPROVED_AGGREGATION, Map.of(FILTER, term(TechnicalIndexFields.HAS_PUBLISHED, true)));
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", 0);
    body.put("track_total_hits", true);
    body.put("query", query(scope));
    body.put("aggs", aggregations);
    return body;
  }

  private static Map<String, Object> cardinality(String field) {
    return Map.of(
        "cardinality", Map.of(FIELD, field, "precision_threshold", CARDINALITY_PRECISION));
  }

  /** Records of the scope that belong to the given Columns, whatever the caller may read. */
  public static Map<String, Object> columnKeysQuery(
      UUID glossaryId, String parentBusinessVersion, Collection<String> columnKeys) {
    final List<Object> filter = new ArrayList<>();
    filter.add(term(TechnicalIndexFields.GLOSSARY_ID, glossaryId.toString()));
    filter.add(term(TechnicalIndexFields.PARENT_BUSINESS_VERSION, parentBusinessVersion));
    filter.add(terms(TechnicalIndexFields.COLUMN_KEY, List.copyOf(columnKeys)));
    return Map.of(BOOL, Map.of(FILTER, filter));
  }

  /** Records the caller may read in one table, matched by case-insensitive location names. */
  public static Map<String, Object> tableQuery(
      TechnicalSearchCriteria scope, String database, String schema, String table) {
    final List<Object> filter = scopeFilters(scope);
    filter.add(term(TechnicalIndexFields.DATABASE, database.toLowerCase(Locale.ROOT)));
    filter.add(term(TechnicalIndexFields.SCHEMA, schema.toLowerCase(Locale.ROOT)));
    filter.add(term(TechnicalIndexFields.TABLE, table.toLowerCase(Locale.ROOT)));
    return Map.of(BOOL, Map.of(FILTER, filter));
  }

  static Map<String, Object> term(String field, Object value) {
    return Map.of(TERM, Map.of(field, value));
  }

  static Map<String, Object> terms(String field, Collection<?> values) {
    return Map.of(TERMS, Map.of(field, List.copyOf(values)));
  }
}
