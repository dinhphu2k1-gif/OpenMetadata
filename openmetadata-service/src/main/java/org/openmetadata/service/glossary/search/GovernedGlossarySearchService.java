/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.search.GovernanceSearchScanner;

/** List, filter, pagination and export reads over the governed glossary index. */
public final class GovernedGlossarySearchService {
  private static final String HITS = "hits";
  private static final int MAX_RESULT_WINDOW = 10_000;
  private static final String SOURCE = "_source";
  private static final String TOTAL = "total";
  private static final String VALUE = "value";

  public Map<String, Object> search(final GovernedGlossarySearchRequest request) {
    GovernedGlossaryOutbox.drainBeforeRead();
    if (outsideResultWindow(request)) {
      return searchAfter(request);
    }
    final JsonNode hits =
        GovernedGlossarySearchIndex.search(GovernedGlossarySearchQueryBuilder.searchBody(request))
            .path(HITS);
    final List<Map<String, Object>> rows = new ArrayList<>();
    hits.path(HITS).forEach(hit -> rows.add(source(hit)));
    return page(
        rows,
        hits.path(TOTAL).path(VALUE).asLong(),
        request.criteria().limit(),
        request.criteria().offset());
  }

  public List<Map<String, Object>> filterAll(final GovernedGlossarySearchRequest request) {
    GovernedGlossaryOutbox.drainBeforeRead();
    return scanAll(request);
  }

  private static Map<String, Object> searchAfter(final GovernedGlossarySearchRequest request) {
    final List<Map<String, Object>> allRows = scanAll(request);
    final int offset = Math.min(request.criteria().offset(), allRows.size());
    final int end = Math.min(offset + request.criteria().limit(), allRows.size());
    return page(
        allRows.subList(offset, end),
        allRows.size(),
        request.criteria().limit(),
        request.criteria().offset());
  }

  private static List<Map<String, Object>> scanAll(final GovernedGlossarySearchRequest request) {
    final List<Map<String, Object>> rows = new ArrayList<>();
    GovernanceSearchScanner.scan(
        GovernedGlossarySearchIndex.index(),
        GovernedGlossarySearchQueryBuilder.query(request),
        GovernedGlossarySearchQueryBuilder.stableSort(request.criteria()),
        Map.of("excludes", GovernedGlossarySearchQueryBuilder.internalSourceFields()),
        hit -> rows.add(source(hit)));
    return rows;
  }

  private static boolean outsideResultWindow(final GovernedGlossarySearchRequest request) {
    return (long) request.criteria().offset() + request.criteria().limit() > MAX_RESULT_WINDOW;
  }

  private static Map<String, Object> page(
      final List<Map<String, Object>> rows, final long total, final int limit, final int offset) {
    final Map<String, Object> paging = new LinkedHashMap<>();
    paging.put(TOTAL, total);
    paging.put("limit", limit);
    paging.put("offset", offset);
    return Map.of("data", rows, "paging", paging);
  }

  private static Map<String, Object> source(final JsonNode hit) {
    return JsonUtils.readValue(hit.path(SOURCE).toString(), new TypeReference<>() {});
  }
}
