/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.openmetadata.schema.utils.JsonUtils;

/** Bounded full scans using a deterministic sort and {@code search_after}. */
public final class GovernanceSearchScanner {
  private static final String ASC = "asc";
  private static final String HITS = "hits";
  private static final int PAGE_SIZE = 1_000;
  private static final String SORT = "sort";

  private GovernanceSearchScanner() {}

  public static List<Object> stableSort(final String tieBreaker, final String... fields) {
    final List<Object> sort = new ArrayList<>();
    for (String field : fields) {
      sort.add(Map.of(field, ASC));
    }
    sort.add(Map.of(tieBreaker, ASC));
    return sort;
  }

  public static void scan(
      final GovernanceSearchIndex index,
      final Map<String, Object> query,
      final List<Object> sort,
      final Object source,
      final Consumer<JsonNode> visitor) {
    List<Object> after = null;
    boolean more = true;
    while (more) {
      final JsonNode hits = index.search(page(query, sort, source, after)).path(HITS).path(HITS);
      hits.forEach(visitor);
      more = hits.size() == PAGE_SIZE;
      after = more ? sortValues(hits.get(hits.size() - 1)) : null;
    }
  }

  private static List<Object> sortValues(final JsonNode hit) {
    return JsonUtils.readValue(hit.path(SORT).toString(), List.class);
  }

  private static Map<String, Object> page(
      final Map<String, Object> query,
      final List<Object> sort,
      final Object source,
      final List<Object> after) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("size", PAGE_SIZE);
    body.put("query", query);
    body.put(SORT, sort);
    body.put("_source", source);
    if (after != null) {
      body.put("search_after", after);
    }
    return body;
  }
}
