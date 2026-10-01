/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.utils.JsonUtils;

/** Full scans of `technical_dictionary_search_index` with {@code search_after}, used by export. */
public final class TechnicalSearchQueries {
  static final int PAGE_SIZE = 1_000;
  private static final String ASC = "asc";
  private static final String HITS = "hits";
  private static final String SORT = "sort";
  private static final String SOURCE = "_source";

  private TechnicalSearchQueries() {}

  /** Sort that makes {@code search_after} deterministic: the given order, then the record id. */
  public static List<Object> stableSort(String... fields) {
    final List<Object> sort = new ArrayList<>();
    for (String field : fields) {
      sort.add(Map.of(field, ASC));
    }
    sort.add(Map.of(TechnicalIndexFields.TERM_ID, ASC));
    return sort;
  }

  /** Visits every matching hit in sort order. */
  public static void scan(
      Map<String, Object> query, List<Object> sort, Object source, Consumer<JsonNode> visitor) {
    List<Object> after = null;
    boolean more = true;
    while (more) {
      final JsonNode hits =
          TechnicalSearchIndex.search(page(query, sort, source, after)).path(HITS).path(HITS);
      hits.forEach(visitor);
      more = hits.size() == PAGE_SIZE;
      after =
          more
              ? JsonUtils.readValue(hits.get(hits.size() - 1).path(SORT).toString(), List.class)
              : null;
    }
  }

  private static Map<String, Object> page(
      Map<String, Object> query, List<Object> sort, Object source, List<Object> after) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", PAGE_SIZE);
    body.put("query", query);
    body.put(SORT, sort);
    body.put(SOURCE, source);
    if (after != null) {
      body.put("search_after", after);
    }
    return body;
  }

  public static List<UUID> scanTermIds(Map<String, Object> query) {
    final List<UUID> termIds = new ArrayList<>();
    scan(
        query,
        stableSort(),
        List.of(TechnicalIndexFields.TERM_ID),
        hit ->
            termIds.add(
                UUID.fromString(hit.path(SOURCE).path(TechnicalIndexFields.TERM_ID).asText())));
    return termIds;
  }
}
