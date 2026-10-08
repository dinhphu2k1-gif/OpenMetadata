/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.service.governance.search.GovernanceSearchIndex;
import org.openmetadata.service.governance.search.GovernanceSearchIndex.IndexAction;
import org.openmetadata.service.governance.search.GovernanceSearchScanner;

/** Governed Data Dictionary and Data Quality flat-row index. */
public final class GovernedGlossarySearchIndex {
  public static final String INDEX_NAME = "governed_glossary_search_index";
  private static final GovernanceSearchIndex INDEX =
      new GovernanceSearchIndex(
          INDEX_NAME, "/elasticsearch/governed_glossary_search_index_mapping.json");

  private GovernedGlossarySearchIndex() {}

  public static GovernanceSearchIndex index() {
    return INDEX;
  }

  public static List<String> idsInScope(final UUID glossaryId, final String parentBusinessVersion) {
    final List<String> ids = new ArrayList<>();
    final Map<String, Object> query =
        Map.of(
            "bool",
            Map.of(
                "filter",
                List.of(
                    term(GovernedGlossaryIndexFields.GLOSSARY_ID, glossaryId.toString()),
                    term(
                        GovernedGlossaryIndexFields.PARENT_BUSINESS_VERSION,
                        parentBusinessVersion))));
    GovernanceSearchScanner.scan(
        INDEX,
        query,
        GovernanceSearchScanner.stableSort(
            GovernedGlossaryIndexFields.RECORD_TYPE, GovernedGlossaryIndexFields.TERM_ID),
        false,
        hit -> ids.add(hit.path("_id").asText()));
    return ids;
  }

  public static List<IndexAction> deleteAllInScope(
      final UUID glossaryId, final String parentBusinessVersion) {
    return idsInScope(glossaryId, parentBusinessVersion).stream().map(IndexAction::delete).toList();
  }

  public static JsonNode search(final Map<String, Object> body) {
    return INDEX.search(body);
  }

  public static Map<String, Object> term(final String field, final Object value) {
    return Map.of("term", Map.of(field, value));
  }
}
