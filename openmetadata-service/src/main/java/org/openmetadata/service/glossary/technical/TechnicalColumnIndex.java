/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Reads physical Columns from the Column search index, to pick a Column to declare and to declare
 * the Columns of an import. Technical Dictionary records exist only for declared Columns.
 */
public final class TechnicalColumnIndex {
  private static final String FQN = "fullyQualifiedName";
  private static final int MAX_TABLE_COLUMNS = 10000;
  private static final int TOP_LEVEL_COLUMN_DEPTH = 5;
  private static final int MIN_CANDIDATE_WINDOW = 500;
  private static final int CANDIDATE_WINDOW_FACTOR = 25;
  private static final String COLUMN_NAME = "name.keyword";
  private static final String TABLE_NAME = "table.name";
  private static final int EXACT_COLUMN_BOOST = 1000;
  private static final int PREFIX_COLUMN_BOOST = 500;
  private static final int CONTAINS_COLUMN_BOOST = 100;
  private static final int TABLE_BOOST = 10;
  private static final int FQN_BOOST = 1;
  private static final List<String> SOURCE_FIELDS =
      List.of(
          FQN,
          "name",
          "description",
          "dataType",
          "dataTypeDisplay",
          "dataLength",
          "precision",
          "scale");

  public record ColumnDocument(
      String columnKey, String columnFqn, String description, Map<String, Object> source) {

    public TechnicalColumnSource toSource() {
      return new TechnicalColumnSource(
          TechnicalColumnSource.columnKey(columnFqn),
          columnFqn,
          String.valueOf(source.get(TechnicalDictionaryProfile.SOURCE_COLUMN)),
          description,
          source);
    }
  }

  private TechnicalColumnIndex() {}

  /** Every Column of one table, matched case-insensitively by its location names. */
  public static List<ColumnDocument> columnsOfTable(String database, String schema, String table) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", MAX_TABLE_COLUMNS);
    body.put("_source", SOURCE_FIELDS);
    body.put("sort", List.of(Map.of(FQN, "asc")));
    body.put(
        "query",
        Map.of(
            "bool",
            Map.of(
                "filter",
                List.of(
                    Map.of("term", Map.of("deleted", false)),
                    caseInsensitiveTerm("database.name", database),
                    caseInsensitiveTerm("databaseSchema.name", schema),
                    caseInsensitiveTerm("table.name", table)))));
    final List<ColumnDocument> columns = new ArrayList<>();
    for (JsonNode hit : search(body).path("hits").path("hits")) {
      columns.add(document(hit.path("_id").asText(), hit.path("_source")));
    }
    return columns;
  }

  /**
   * Top-level Columns matching {@code text}, closest first: the Column named exactly {@code text},
   * then Column names starting with it, then names containing it (shorter names first), then
   * Columns whose table or FQN contains it. Nested struct/array/map children are left out.
   *
   * <p>OpenSearch returns a window much larger than {@code limit} ordered by that tier, and the
   * final order and cut are applied here after the nested children are dropped, so neither the
   * alphabetical order nor the children can push a close match out of the result.
   */
  public static List<ColumnDocument> search(String text, int limit) {
    final String needle = nullOrEmpty(text) ? "" : text.trim().toLowerCase(Locale.ROOT);
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", Math.max(MIN_CANDIDATE_WINDOW, limit * CANDIDATE_WINDOW_FACTOR));
    body.put("_source", SOURCE_FIELDS);
    body.put("sort", List.of(Map.of("_score", "desc"), Map.of(FQN, "asc")));
    body.put("query", textQuery(needle));
    final List<ColumnDocument> candidates = new ArrayList<>();
    for (JsonNode hit : search(body).path("hits").path("hits")) {
      final ColumnDocument column = document(hit.path("_id").asText(), hit.path("_source"));
      if (isTopLevel(column.columnFqn())) {
        candidates.add(column);
      }
    }
    return closestFirst(candidates, needle, limit);
  }

  static List<ColumnDocument> closestFirst(
      List<ColumnDocument> candidates, String needle, int limit) {
    return candidates.stream()
        .sorted(
            Comparator.comparingInt((ColumnDocument column) -> -matchTier(column, needle))
                .thenComparingInt(column -> columnName(column).length())
                .thenComparing(TechnicalColumnIndex::columnName)
                .thenComparing(ColumnDocument::columnFqn))
        .limit(limit)
        .toList();
  }

  /** 4 exact Column name, 3 Column name prefix, 2 Column name contains, 1 table contains, else 0. */
  static int matchTier(ColumnDocument column, String needle) {
    final String name = columnName(column).toLowerCase(Locale.ROOT);
    final String table =
        String.valueOf(column.source().getOrDefault(TechnicalDictionaryProfile.SOURCE_TABLE, ""))
            .toLowerCase(Locale.ROOT);
    final int tier;
    if (needle.isEmpty()) {
      tier = 0;
    } else if (name.equals(needle)) {
      tier = 4;
    } else if (name.startsWith(needle)) {
      tier = 3;
    } else if (name.contains(needle)) {
      tier = 2;
    } else {
      tier = table.contains(needle) ? 1 : 0;
    }
    return tier;
  }

  private static String columnName(ColumnDocument column) {
    return String.valueOf(
        column.source().getOrDefault(TechnicalDictionaryProfile.SOURCE_COLUMN, ""));
  }

  private static boolean isTopLevel(String columnFqn) {
    return FullyQualifiedName.split(columnFqn).length == TOP_LEVEL_COLUMN_DEPTH;
  }

  static Map<String, Object> textQuery(String needle) {
    final Map<String, Object> bool = new LinkedHashMap<>();
    bool.put("filter", List.of(Map.of("term", Map.of("deleted", false))));
    bool.put("must_not", List.of(Map.of("term", Map.of("table.deleted", true))));
    if (!needle.isEmpty()) {
      bool.put("should", relevanceClauses(needle));
      bool.put("minimum_should_match", 1);
    }
    return Map.of("bool", bool);
  }

  /** Each clause scores its boost only, so the sum ranks exact > prefix > contains > table > FQN. */
  private static List<Object> relevanceClauses(String needle) {
    final String pattern = "*" + escapeWildcard(needle) + "*";
    return List.of(
        Map.of("term", Map.of(COLUMN_NAME, Map.of("value", needle, "boost", EXACT_COLUMN_BOOST))),
        Map.of(
            "prefix", Map.of(COLUMN_NAME, Map.of("value", needle, "boost", PREFIX_COLUMN_BOOST))),
        wildcard(COLUMN_NAME, pattern, CONTAINS_COLUMN_BOOST),
        wildcard(TABLE_NAME, pattern, TABLE_BOOST),
        wildcard(FQN, pattern, FQN_BOOST));
  }

  private static Map<String, Object> wildcard(String field, String pattern, int boost) {
    return Map.of(
        "wildcard",
        Map.of(field, Map.of("value", pattern, "case_insensitive", true, "boost", boost)));
  }

  private static Map<String, Object> caseInsensitiveTerm(String field, String value) {
    return Map.of("term", Map.of(field, Map.of("value", value, "case_insensitive", true)));
  }

  private static ColumnDocument document(String columnKey, JsonNode source) {
    final String columnFqn = source.path(FQN).asText();
    final String dataType =
        text(source, "dataTypeDisplay") != null
            ? text(source, "dataTypeDisplay")
            : text(source, "dataType");
    return new ColumnDocument(
        columnKey,
        columnFqn,
        text(source, "description"),
        TechnicalColumnSource.sourceExtension(
            columnFqn,
            dataType,
            integer(source, "dataLength"),
            integer(source, "precision"),
            integer(source, "scale")));
  }

  private static String text(JsonNode source, String field) {
    final JsonNode value = source.get(field);
    return value == null || value.isNull() ? null : value.asText();
  }

  private static Integer integer(JsonNode source, String field) {
    final JsonNode value = source.get(field);
    return value == null || !value.isNumber() ? null : value.asInt();
  }

  static String escapeWildcard(String value) {
    return value.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }

  private static JsonNode search(Map<String, Object> body) {
    final SearchRepository repository = Entity.getSearchRepository();
    final String index =
        repository.getIndexMapping(Entity.TABLE_COLUMN).getIndexName(repository.getClusterAlias());
    final RawSearchResponse response;
    try {
      response =
          repository
              .getSearchClient()
              .rawSearchRequest("POST", "/" + index + "/_search", JsonUtils.pojoToJson(body));
    } catch (IOException exception) {
      throw new IllegalStateException("Column search index is not available", exception);
    }
    if (response.statusCode() >= 300) {
      throw new IllegalStateException(
          "Column search index query failed with status " + response.statusCode());
    }
    return JsonUtils.readTree(response.body());
  }
}
