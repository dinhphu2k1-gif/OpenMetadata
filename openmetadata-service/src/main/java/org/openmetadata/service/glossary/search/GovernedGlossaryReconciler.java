/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.Scope;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.ScopeType;
import org.openmetadata.service.governance.search.GovernanceSearchMetrics;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO.ScopeKey;

/**
 * Periodic count and revision checksum comparison between database scopes and the index. A drifting
 * scope is queued again so the next drain repairs it. Archived scopes are immutable and are only
 * written by a cutover or a rebuild, so they are not compared on every run.
 */
@Slf4j
public final class GovernedGlossaryReconciler {
  private static final String REVISION_SUM = "revisionSum";

  private GovernedGlossaryReconciler() {}

  public static long reconcile() {
    long drift = 0;
    final GovernedGlossaryDocumentBuilder builder = new GovernedGlossaryDocumentBuilder();
    for (ScopeKey scope : dao().listScopes()) {
      try {
        drift += reconcile(scope, builder);
      } catch (NotFoundException exception) {
        LOG.warn(
            "Skipping unresolved governed glossary scope {} {} during reconciliation",
            scope.glossaryId(),
            scope.parentBusinessVersion());
      }
    }
    GovernanceSearchMetrics.GOVERNED.setDriftRows(drift);
    return drift;
  }

  private static long reconcile(
      final ScopeKey scope, final GovernedGlossaryDocumentBuilder builder) {
    final Scope resolved =
        new GlossaryFlatListService()
            .resolveScope(scope.glossaryId(), scope.parentBusinessVersion());
    long drift = 0;
    if (resolved.type() != ScopeType.ARCHIVED) {
      drift = drift(scope, builder.rows(scope.glossaryId(), resolved));
    }
    if (drift > 0) {
      GovernedGlossaryOutbox.enqueue(dao(), scope.glossaryId(), scope.parentBusinessVersion());
    }
    return drift;
  }

  private static long drift(final ScopeKey scope, final List<Map<String, Object>> rows) {
    final long databaseRevision =
        rows.stream().mapToLong(GovernedGlossaryDocumentBuilder::revisionMarker).sum();
    final JsonNode indexed = indexed(scope);
    final long indexCount = indexed.path("hits").path("total").path("value").asLong();
    final long indexRevision =
        Math.round(indexed.path("aggregations").path(REVISION_SUM).path("value").asDouble());
    final long drift =
        Math.abs(rows.size() - indexCount) + (databaseRevision == indexRevision ? 0 : 1);
    if (drift > 0) {
      LOG.warn(
          "Governed glossary search drift glossary={} scope={} dbCount={} indexCount={} dbRevision={} indexRevision={}; requeued",
          scope.glossaryId(),
          scope.parentBusinessVersion(),
          rows.size(),
          indexCount,
          databaseRevision,
          indexRevision);
    }
    return drift;
  }

  private static JsonNode indexed(final ScopeKey scope) {
    final Map<String, Object> query =
        Map.of(
            "bool",
            Map.of(
                "filter",
                List.of(
                    GovernedGlossarySearchIndex.term(
                        GovernedGlossaryIndexFields.GLOSSARY_ID, scope.glossaryId().toString()),
                    GovernedGlossarySearchIndex.term(
                        GovernedGlossaryIndexFields.PARENT_BUSINESS_VERSION,
                        scope.parentBusinessVersion()))));
    return GovernedGlossarySearchIndex.search(
        Map.of(
            "size",
            0,
            "track_total_hits",
            true,
            "query",
            query,
            "aggs",
            Map.of(
                REVISION_SUM,
                Map.of("sum", Map.of("field", GovernedGlossaryIndexFields.REVISION_MARKER)))));
  }

  private static GovernedGlossarySearchDAO dao() {
    return Entity.getJdbi().onDemand(GovernedGlossarySearchDAO.class);
  }
}
