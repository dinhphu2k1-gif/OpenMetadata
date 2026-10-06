/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;

/**
 * Technical Dictionary reads over `technical_dictionary_search_index`. An unreachable index is
 * reported as {@code TD_INDEX_UNAVAILABLE}; pending outbox work is processed by the caller first.
 */
public final class TechnicalSearchService {
  public static final String DATA = "data";
  public static final String PAGING = "paging";
  public static final String TOTAL = "total";
  public static final String TOTAL_COLUMNS = "totalColumns";
  public static final String TOTAL_TABLES = "totalTables";
  public static final String TOTAL_SOURCES = "totalSources";
  public static final String MAPPED = "mapped";
  private static final String HITS = "hits";
  private static final String SOURCE = "_source";
  private static final String AGGREGATIONS = "aggregations";
  private static final String VALUE = "value";

  public Map<String, Object> search(TechnicalSearchCriteria criteria) {
    final JsonNode hits =
        read(() -> TechnicalSearchIndex.search(TechnicalSearchQueryBuilder.searchBody(criteria)))
            .path(HITS);
    final List<Map<String, Object>> rows = new ArrayList<>();
    hits.path(HITS).forEach(hit -> rows.add(source(hit)));
    return page(rows, hits.path(TOTAL).path(VALUE).asLong(), criteria.limit(), criteria.offset());
  }

  /** How many records matching the criteria have a pending update. */
  public long countPendingUpdates(TechnicalSearchCriteria criteria) {
    return read(() ->
            TechnicalSearchIndex.search(
                TechnicalSearchQueryBuilder.pendingUpdateCountBody(criteria)))
        .path(HITS)
        .path(TOTAL)
        .path(VALUE)
        .asLong();
  }

  /** One page of the records referencing a CDE in the bound version, in rank order. */
  public Map<String, Object> rowsOfCde(String version, UUID cdeId, int limit, int offset) {
    TechnicalSearchQueryBuilder.requireWithinWindow(offset, limit);
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("from", offset);
    body.put("size", limit);
    body.put("track_total_hits", true);
    body.put(
        "sort",
        List.of(
            Map.of(TechnicalIndexFields.RANK, Map.of("order", "asc", "missing", "_last")),
            Map.of(TechnicalIndexFields.COLUMN_FQN, "asc"),
            Map.of(TechnicalIndexFields.TERM_ID, "asc")));
    body.put("query", TechnicalSearchQueryBuilder.cdeQuery(version, cdeId));
    final JsonNode hits = read(() -> TechnicalSearchIndex.search(body)).path(HITS);
    final List<Map<String, Object>> rows = new ArrayList<>();
    hits.path(HITS).forEach(hit -> rows.add(source(hit)));
    return page(rows, hits.path(TOTAL).path(VALUE).asLong(), limit, offset);
  }

  public Map<String, Long> stats(TechnicalSearchCriteria scope) {
    final JsonNode response =
        read(() -> TechnicalSearchIndex.search(TechnicalSearchQueryBuilder.statsBody(scope)));
    final JsonNode aggregations = response.path(AGGREGATIONS);
    final Map<String, Long> stats = new LinkedHashMap<>();
    stats.put(TOTAL_COLUMNS, response.path(HITS).path(TOTAL).path(VALUE).asLong());
    stats.put(
        TOTAL_TABLES,
        aggregations.path(TechnicalSearchQueryBuilder.TABLES_AGGREGATION).path(VALUE).asLong());
    stats.put(
        TOTAL_SOURCES,
        aggregations.path(TechnicalSearchQueryBuilder.SOURCES_AGGREGATION).path(VALUE).asLong());
    stats.put(
        MAPPED,
        aggregations
            .path(TechnicalSearchQueryBuilder.MAPPED_AGGREGATION)
            .path("doc_count")
            .asLong());
    return stats;
  }

  /** Every matching row in Column FQN order, read page by page. */
  public void scanRows(TechnicalSearchCriteria criteria, Consumer<Map<String, Object>> visitor) {
    run(
        () ->
            TechnicalSearchQueries.scan(
                TechnicalSearchQueryBuilder.query(criteria),
                TechnicalSearchQueries.stableSort(TechnicalIndexFields.COLUMN_FQN),
                true,
                hit -> visitor.accept(source(hit))));
  }

  private static Map<String, Object> page(
      List<Map<String, Object>> rows, long total, int limit, int offset) {
    final Map<String, Object> paging = new LinkedHashMap<>();
    paging.put(TOTAL, total);
    paging.put("limit", limit);
    paging.put("offset", offset);
    return Map.of(DATA, rows, PAGING, paging);
  }

  private static Map<String, Object> source(JsonNode hit) {
    return JsonUtils.readValue(hit.path(SOURCE).toString(), new TypeReference<>() {});
  }

  private static void run(Runnable operation) {
    read(
        () -> {
          operation.run();
          return Boolean.TRUE;
        });
  }

  private static <T> T read(Supplier<T> operation) {
    T result = null;
    try {
      result = operation.get();
    } catch (TechnicalIndexUnavailableException exception) {
      throw TechnicalDictionaryErrors.indexUnavailable(
          "Technical Dictionary search index is not available: " + exception.getMessage());
    }
    return result;
  }
}
