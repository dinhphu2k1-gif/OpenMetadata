/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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
  private static final List<String> SOURCE_FIELDS =
      List.of(
          FQN, "name", "description", "dataType", "dataTypeDisplay", "dataLength", "precision",
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
   * Top-level Columns whose FQN contains {@code text}, in FQN order, for picking a Column to
   * declare. Nested struct/array/map children are left out.
   */
  public static List<ColumnDocument> search(String text, int limit) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", limit);
    body.put("_source", SOURCE_FIELDS);
    body.put("sort", List.of(Map.of(FQN, "asc")));
    body.put("query", textQuery(text));
    final List<ColumnDocument> columns = new ArrayList<>();
    for (JsonNode hit : search(body).path("hits").path("hits")) {
      final ColumnDocument column = document(hit.path("_id").asText(), hit.path("_source"));
      if (isTopLevel(column.columnFqn())) {
        columns.add(column);
      }
    }
    return columns;
  }

  private static boolean isTopLevel(String columnFqn) {
    return FullyQualifiedName.split(columnFqn).length == TOP_LEVEL_COLUMN_DEPTH;
  }

  private static Map<String, Object> textQuery(String text) {
    final List<Object> filters = new ArrayList<>();
    filters.add(Map.of("term", Map.of("deleted", false)));
    if (!nullOrEmpty(text) && !text.isBlank()) {
      filters.add(
          Map.of(
              "wildcard",
              Map.of(
                  FQN,
                  Map.of(
                      "value", "*" + escapeWildcard(text.trim()) + "*",
                      "case_insensitive", true))));
    }
    return Map.of(
        "bool",
        Map.of("filter", filters, "must_not", List.of(Map.of("term", Map.of("table.deleted", true)))));
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
        repository
            .getIndexMapping(Entity.TABLE_COLUMN)
            .getIndexName(repository.getClusterAlias());
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
