/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;

/**
 * Technical Dictionary reads over `technical_dictionary_search_index`. Pending index work is
 * processed first, so a read right after a failed sync already sees the repaired documents. An
 * unreachable index is reported as {@code TD_INDEX_UNAVAILABLE}.
 */
public final class TechnicalSearchService {
  public static final String DATA = "data";
  public static final String PAGING = "paging";
  public static final String TOTAL = "total";
  public static final String TOTAL_COLUMNS = "totalColumns";
  public static final String TOTAL_TABLES = "totalTables";
  public static final String TOTAL_SOURCES = "totalSources";
  public static final String APPROVED = "approved";
  private static final String HITS = "hits";
  private static final String SOURCE = "_source";
  private static final String AGGREGATIONS = "aggregations";
  private static final String VALUE = "value";

  public Map<String, Object> search(TechnicalSearchCriteria criteria) {
    final JsonNode hits =
        read(() -> TechnicalSearchIndex.search(TechnicalSearchQueryBuilder.searchBody(criteria)))
            .path(HITS);
    final List<Map<String, Object>> rows = new ArrayList<>();
    hits.path(HITS).forEach(hit -> rows.add(TechnicalRowMapper.toRow(source(hit), criteria.view())));
    final Map<String, Object> paging = new LinkedHashMap<>();
    paging.put(TOTAL, hits.path(TOTAL).path(VALUE).asLong());
    paging.put("limit", criteria.limit());
    paging.put("offset", criteria.offset());
    return Map.of(DATA, rows, PAGING, paging);
  }

  public Map<String, Long> stats(TechnicalSearchCriteria scope) {
    final JsonNode response =
        read(() -> TechnicalSearchIndex.search(TechnicalSearchQueryBuilder.statsBody(scope)));
    final JsonNode aggregations = response.path(AGGREGATIONS);
    final Map<String, Long> stats = new LinkedHashMap<>();
    stats.put(TOTAL_COLUMNS, response.path(HITS).path(TOTAL).path(VALUE).asLong());
    stats.put(TOTAL_TABLES, aggregations.path(TechnicalSearchQueryBuilder.TABLES_AGGREGATION).path(VALUE).asLong());
    stats.put(TOTAL_SOURCES, aggregations.path(TechnicalSearchQueryBuilder.SOURCES_AGGREGATION).path(VALUE).asLong());
    stats.put(APPROVED, aggregations.path(TechnicalSearchQueryBuilder.APPROVED_AGGREGATION).path("doc_count").asLong());
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
                hit -> visitor.accept(TechnicalRowMapper.toRow(source(hit), criteria.view()))));
  }

  /** Every matching row; used to select records whose state is then re-read from the database. */
  public List<Map<String, Object>> rows(TechnicalSearchCriteria criteria) {
    final List<Map<String, Object>> rows = new ArrayList<>();
    scanRows(criteria, rows::add);
    return rows;
  }

  /** Ids of every matching record, to be re-read from the database before any write. */
  public List<UUID> termIds(TechnicalSearchCriteria criteria) {
    return read(() -> TechnicalSearchQueries.scanTermIds(TechnicalSearchQueryBuilder.query(criteria)));
  }

  /** Column keys among {@code columnKeys} that already have a record in the scope. */
  public Map<String, String> declaredColumns(
      UUID glossaryId, String parentBusinessVersion, Collection<String> columnKeys) {
    final Map<String, String> declared = new LinkedHashMap<>();
    if (!columnKeys.isEmpty()) {
      run(
          () ->
              TechnicalSearchQueries.scan(
                  TechnicalSearchQueryBuilder.columnKeysQuery(
                      glossaryId, parentBusinessVersion, columnKeys),
                  TechnicalSearchQueries.stableSort(),
                  List.of(TechnicalIndexFields.COLUMN_KEY, TechnicalIndexFields.TERM_ID),
                  hit ->
                      declared.put(
                          hit.path(SOURCE).path(TechnicalIndexFields.COLUMN_KEY).asText(),
                          hit.path(SOURCE).path(TechnicalIndexFields.TERM_ID).asText())));
    }
    return declared;
  }

  /** Rows the caller may read in one table. */
  public List<Map<String, Object>> rowsOfTable(
      TechnicalSearchCriteria scope, String database, String schema, String table) {
    final List<Map<String, Object>> rows = new ArrayList<>();
    run(
        () ->
            TechnicalSearchQueries.scan(
                TechnicalSearchQueryBuilder.tableQuery(scope, database, schema, table),
                TechnicalSearchQueries.stableSort(TechnicalIndexFields.COLUMN_FQN),
                true,
                hit -> rows.add(TechnicalRowMapper.toRow(source(hit), scope.view()))));
    return rows;
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
