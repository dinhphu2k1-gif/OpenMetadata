/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import jakarta.ws.rs.NotFoundException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.search.GovernanceSearchIndex;
import org.openmetadata.service.governance.search.GovernanceSearchIndex.IndexAction;
import org.openmetadata.service.governance.search.GovernanceSearchMetrics;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO.ScopeKey;

/** Blue/green rebuild of every governed glossary scope. */
@Slf4j
public final class GovernedGlossaryIndexRebuilder {
  private static final ReentrantLock LOCK = new ReentrantLock();

  private GovernedGlossaryIndexRebuilder() {}

  public static void ensureIndex() {
    final GovernanceSearchIndex index = GovernedGlossarySearchIndex.index();
    if (index.strayIndexExists()) {
      index.deleteIndex(index.alias());
    }
    if (!index.aliasExists() || !index.mappingIsCurrent()) {
      rebuild();
    }
  }

  public static void ensureAliasExists() {
    if (!GovernedGlossarySearchIndex.index().aliasExists()) {
      ensureIndex();
    }
  }

  public static Map<String, Object> rebuild() {
    if (!LOCK.tryLock()) {
      throw new IllegalStateException("A governed glossary index rebuild is already running");
    }
    Map<String, Object> summary;
    GovernedGlossaryOutbox.markRebuilding(true);
    try {
      summary = rebuildLocked();
    } finally {
      GovernedGlossaryOutbox.markRebuilding(false);
      LOCK.unlock();
    }
    GovernedGlossaryOutbox.drainPending();
    summary.put("pending", dao().countPending());
    return summary;
  }

  private static Map<String, Object> rebuildLocked() {
    final GovernanceSearchIndex index = GovernedGlossarySearchIndex.index();
    final String physicalIndex = index.createPhysicalIndex();
    long indexed = 0;
    try {
      indexed = fill(physicalIndex);
      index.refreshIndex(physicalIndex);
      index.switchAlias(physicalIndex);
      GovernanceSearchMetrics.GOVERNED.setAvailable(true);
    } catch (RuntimeException exception) {
      index.deleteIndex(physicalIndex);
      GovernanceSearchMetrics.GOVERNED.setAvailable(false);
      throw exception;
    }
    return summary(physicalIndex, indexed);
  }

  private static long fill(final String physicalIndex) {
    final GovernedGlossaryDocumentBuilder builder = new GovernedGlossaryDocumentBuilder();
    long indexed = 0;
    for (ScopeKey scope : dao().listScopes()) {
      try {
        final List<IndexAction> actions =
            builder.buildScope(scope.glossaryId(), scope.parentBusinessVersion(), false);
        write(physicalIndex, actions);
        indexed += actions.size();
      } catch (NotFoundException exception) {
        LOG.warn(
            "Skipping unresolved governed glossary scope {} {}",
            scope.glossaryId(),
            scope.parentBusinessVersion());
      }
    }
    return indexed;
  }

  private static void write(final String physicalIndex, final List<IndexAction> actions) {
    final List<String> failed =
        GovernedGlossarySearchIndex.index().bulkInto(physicalIndex, actions);
    if (!failed.isEmpty()) {
      throw new IllegalStateException("Governed glossary rebuild rejected " + failed.getFirst());
    }
  }

  private static Map<String, Object> summary(final String physicalIndex, final long indexed) {
    final Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("index", physicalIndex);
    summary.put("alias", GovernedGlossarySearchIndex.index().alias());
    summary.put("indexed", indexed);
    summary.put("pending", dao().countPending());
    return summary;
  }

  private static GovernedGlossarySearchDAO dao() {
    return Entity.getJdbi().onDemand(GovernedGlossarySearchDAO.class);
  }
}
