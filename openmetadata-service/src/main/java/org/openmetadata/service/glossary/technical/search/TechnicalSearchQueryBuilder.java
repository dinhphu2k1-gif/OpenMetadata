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
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRecordChangeRequest;
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
  public static final String MAPPED_AGGREGATION = "mapped";

  private static final List<String> LOCATION_SEARCH_FIELDS =
      List.of(
          TechnicalIndexFields.DATABASE,
          TechnicalIndexFields.SCHEMA,
          TechnicalIndexFields.TABLE,
          TechnicalIndexFields.COLUMN,
          TechnicalIndexFields.path(TechnicalIndexFields.CDE, TechnicalIndexFields.CODE),
          TechnicalIndexFields.path(TechnicalIndexFields.CDE, TechnicalIndexFields.NAME));
  private static final Map<String, String> FILTER_FIELDS = filterFields();

  private TechnicalSearchQueryBuilder() {}

  private static Map<String, String> filterFields() {
    final Map<String, String> fields = new LinkedHashMap<>();
    fields.put(TechnicalRowMatcher.SOURCE_SERVICES, TechnicalIndexFields.SERVICE);
    fields.put(TechnicalRowMatcher.SOURCE_STATUSES, TechnicalIndexFields.SOURCE_STATUS);
    fields.put(
        TechnicalRowMatcher.CDE_TERM_IDS,
        TechnicalIndexFields.path(TechnicalIndexFields.CDE, TechnicalIndexFields.ID));
    fields.put(
        TechnicalRowMatcher.SYSTEM_OWNER_IDS,
        TechnicalIndexFields.path(TechnicalIndexFields.SYSTEM_OWNERS, TechnicalIndexFields.ID));
    fields.put(
        TechnicalRowMatcher.ELEMENT_TYPES,
        TechnicalIndexFields.path(TechnicalIndexFields.ELEMENT_TYPE, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.GENERATION_TYPES,
        TechnicalIndexFields.path(TechnicalIndexFields.GENERATION_TYPE, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.CREATION_METHODS,
        TechnicalIndexFields.path(TechnicalIndexFields.CREATION_METHOD, TechnicalIndexFields.FQN));
    fields.put(
        TechnicalRowMatcher.TIMELINESS,
        TechnicalIndexFields.path(TechnicalIndexFields.TIMELINESS, TechnicalIndexFields.FQN));
    return fields;
  }

  /** One page of rows, sorted by rank (unranked last), then by Column FQN. */
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
        Map.of(TechnicalIndexFields.RANK, Map.of("order", ASC, "missing", "_last")),
        Map.of(TechnicalIndexFields.COLUMN_FQN, ASC),
        Map.of(TechnicalIndexFields.TERM_ID, ASC));
  }

  /** Bound version, text search and filters of the criteria. */
  public static Map<String, Object> query(TechnicalSearchCriteria criteria) {
    final List<Object> filter = new ArrayList<>();
    final List<Object> mustNot = new ArrayList<>();
    filter.add(
        term(TechnicalIndexFields.DATA_DICTIONARY_VERSION, criteria.dataDictionaryVersion()));
    FILTER_FIELDS.forEach(
        (parameter, field) -> addTerms(filter, field, criteria.filters().get(parameter)));
    addStatuses(filter, criteria);
    addCdeMapping(filter, mustNot, criteria);
    if (criteria.hideUnapproved()) {
      filter.add(term(TechnicalIndexFields.STATUS, TechnicalRecord.STATUS_APPROVED));
    }
    final Map<String, Object> bool = new LinkedHashMap<>();
    bool.put(FILTER, filter);
    if (!nullOrEmpty(criteria.q())) {
      bool.put(MUST, List.of(textQuery(criteria.q())));
    }
    if (!mustNot.isEmpty()) {
      bool.put(MUST_NOT, mustNot);
    }
    return Map.of(BOOL, bool);
  }

  /**
   * A pending update lists as a second row carrying the status of its change, so a status filter
   * matches the record's own status or, for editors and reviewers, the status of its pending update.
   */
  private static void addStatuses(List<Object> filter, TechnicalSearchCriteria criteria) {
    final List<String> statuses = statusFilter(criteria);
    final List<String> changeStatuses = changeStatuses(criteria);
    if (changeStatuses.isEmpty()) {
      addTerms(filter, TechnicalIndexFields.STATUS, statuses);
    } else {
      final List<Object> alternatives =
          List.of(
              terms(TechnicalIndexFields.STATUS, statuses),
              pendingUpdateWithStatus(changeStatuses));
      filter.add(Map.of(BOOL, Map.of(SHOULD, alternatives, MINIMUM_SHOULD_MATCH, 1)));
    }
  }

  private static List<String> statusFilter(TechnicalSearchCriteria criteria) {
    return criteria.filters().getOrDefault(TechnicalRowMatcher.STATUSES, List.of());
  }

  /** The change request statuses whose row shows under the requested record statuses. */
  private static List<String> changeStatuses(TechnicalSearchCriteria criteria) {
    final List<String> result = new ArrayList<>();
    if (!criteria.hideUnapproved()) {
      statusFilter(criteria).forEach(status -> addChangeStatus(result, status));
    }
    return result;
  }

  private static void addChangeStatus(List<String> result, String recordStatus) {
    if (TechnicalRecord.STATUS_DRAFT.equals(recordStatus)) {
      result.add(TechnicalRecordChangeRequest.STATUS_DRAFT);
    } else if (TechnicalRecord.STATUS_IN_REVIEW.equals(recordStatus)) {
      result.add(TechnicalRecordChangeRequest.STATUS_IN_REVIEW);
    } else if (TechnicalRecord.STATUS_REJECTED.equals(recordStatus)) {
      result.add(TechnicalRecordChangeRequest.STATUS_REJECTED);
    }
  }

  private static Map<String, Object> pendingUpdateWithStatus(List<String> changeStatuses) {
    return Map.of(
        BOOL,
        Map.of(
            FILTER,
            List.of(
                term(TechnicalIndexFields.HAS_PENDING_CHANGE, true),
                term(TechnicalIndexFields.CHANGE_OPERATION, "UPDATE"),
                terms(TechnicalIndexFields.CHANGE_REQUEST_STATUS, changeStatuses))));
  }

  private static void addTerms(List<Object> filter, String field, List<String> values) {
    if (!nullOrEmpty(values)) {
      filter.add(terms(field, values));
    }
  }

  /** "Mapped" and "not mapped" together select every record, so only a single value filters. */
  private static void addCdeMapping(
      List<Object> filter, List<Object> mustNot, TechnicalSearchCriteria criteria) {
    final List<String> mapping =
        criteria.filters().getOrDefault(TechnicalRowMatcher.CDE_MAPPING, List.of());
    final Map<String, Object> hasCde =
        Map.of(
            EXISTS,
            Map.of(
                FIELD,
                TechnicalIndexFields.path(TechnicalIndexFields.CDE, TechnicalIndexFields.ID)));
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
  static Map<String, Object> textQuery(String q) {
    final String text = q.trim().toLowerCase(Locale.ROOT);
    return text.codePointCount(0, text.length()) >= MIN_NGRAM_LENGTH
        ? ngramQuery(text)
        : wildcardQuery(text);
  }

  private static Map<String, Object> ngramQuery(String text) {
    final List<String> fields =
        LOCATION_SEARCH_FIELDS.stream()
            .map(field -> field + "." + TechnicalIndexFields.NGRAM)
            .toList();
    final Map<String, Object> multiMatch = new LinkedHashMap<>();
    multiMatch.put("query", text);
    multiMatch.put("type", "cross_fields");
    multiMatch.put("operator", "and");
    multiMatch.put("fields", fields);
    return Map.of("multi_match", multiMatch);
  }

  private static Map<String, Object> wildcardQuery(String text) {
    final String pattern = WILDCARD_ANY + escapeWildcard(text) + WILDCARD_ANY;
    final List<Object> clauses =
        LOCATION_SEARCH_FIELDS.stream()
            .map(field -> (Object) Map.of("wildcard", Map.of(field, Map.of("value", pattern))))
            .toList();
    return Map.of(BOOL, Map.of(SHOULD, clauses, MINIMUM_SHOULD_MATCH, 1));
  }

  static String escapeWildcard(String value) {
    return value.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }

  /**
   * Counts the records that list as two rows: those with a pending update that also match the
   * criteria through their own status, which a status filter makes a subset of the matches.
   */
  public static Map<String, Object> pendingUpdateCountBody(TechnicalSearchCriteria criteria) {
    final List<Object> filter = new ArrayList<>();
    filter.add(query(criteria));
    filter.add(term(TechnicalIndexFields.HAS_PENDING_CHANGE, true));
    filter.add(term(TechnicalIndexFields.CHANGE_OPERATION, "UPDATE"));
    if (!statusFilter(criteria).isEmpty()) {
      filter.add(terms(TechnicalIndexFields.STATUS, statusFilter(criteria)));
      filter.add(terms(TechnicalIndexFields.CHANGE_REQUEST_STATUS, changeStatuses(criteria)));
    }
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", 0);
    body.put("track_total_hits", true);
    body.put("query", Map.of(BOOL, Map.of(FILTER, filter)));
    return body;
  }

  /** Header statistics over the same bound version as the list. */
  public static Map<String, Object> statsBody(TechnicalSearchCriteria scope) {
    final Map<String, Object> aggregations = new LinkedHashMap<>();
    aggregations.put(TABLES_AGGREGATION, cardinality(TechnicalIndexFields.TABLE_KEY));
    aggregations.put(SOURCES_AGGREGATION, cardinality(TechnicalIndexFields.SERVICE));
    aggregations.put(
        MAPPED_AGGREGATION,
        Map.of(
            FILTER,
            Map.of(
                BOOL,
                Map.of(
                    FILTER,
                    List.of(
                        term(TechnicalIndexFields.STATUS, TechnicalRecord.STATUS_APPROVED),
                        Map.of(
                            EXISTS,
                            Map.of(
                                FIELD,
                                TechnicalIndexFields.path(
                                    TechnicalIndexFields.CDE, TechnicalIndexFields.ID))))))));
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

  /** Records that belong to the given Columns in the bound version. */
  public static Map<String, Object> columnKeysQuery(
      String dataDictionaryVersion, Collection<String> columnKeys) {
    final List<Object> filter = new ArrayList<>();
    filter.add(term(TechnicalIndexFields.DATA_DICTIONARY_VERSION, dataDictionaryVersion));
    filter.add(terms(TechnicalIndexFields.COLUMN_KEY, List.copyOf(columnKeys)));
    return Map.of(BOOL, Map.of(FILTER, filter));
  }

  /** Records referencing one CDE, sorted by rank by the caller. */
  public static Map<String, Object> cdeQuery(String dataDictionaryVersion, UUID cdeId) {
    return Map.of(
        BOOL,
        Map.of(
            FILTER,
            List.of(
                term(TechnicalIndexFields.DATA_DICTIONARY_VERSION, dataDictionaryVersion),
                term(TechnicalIndexFields.STATUS, TechnicalRecord.STATUS_APPROVED),
                term(
                    TechnicalIndexFields.path(TechnicalIndexFields.CDE, TechnicalIndexFields.ID),
                    cdeId.toString()))));
  }

  /** Records of one table, matched by case-insensitive location names. */
  public static Map<String, Object> tableQuery(
      String dataDictionaryVersion, String database, String schema, String table) {
    return Map.of(
        BOOL,
        Map.of(
            FILTER,
            List.of(
                term(TechnicalIndexFields.DATA_DICTIONARY_VERSION, dataDictionaryVersion),
                term(TechnicalIndexFields.DATABASE, database.toLowerCase(Locale.ROOT)),
                term(TechnicalIndexFields.SCHEMA, schema.toLowerCase(Locale.ROOT)),
                term(TechnicalIndexFields.TABLE, table.toLowerCase(Locale.ROOT)))));
  }

  static Map<String, Object> term(String field, Object value) {
    return Map.of(TERM, Map.of(field, value));
  }

  static Map<String, Object> terms(String field, Collection<?> values) {
    return Map.of(TERMS, Map.of(field, List.copyOf(values)));
  }
}
