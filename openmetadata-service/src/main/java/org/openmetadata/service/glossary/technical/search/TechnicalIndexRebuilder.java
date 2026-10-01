/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;
import org.openmetadata.service.glossary.technical.TechnicalOutbox;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex.IndexAction;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * Rebuilds `technical_dictionary_search_index` from the database into a new physical index and
 * then moves the alias, so readers keep using the previous index until the new one is complete.
 * Only declared records are read, page by page by record id.
 */
@Slf4j
public final class TechnicalIndexRebuilder {
  private static final String FIRST_KEY = "";
  private static final ReentrantLock REBUILD_LOCK = new ReentrantLock();

  private TechnicalIndexRebuilder() {}

  /**
   * Builds the index at startup when it does not exist yet (new environment) or was created from
   * an older mapping.
   */
  public static void ensureIndex() {
    if (TechnicalSearchIndex.strayIndexExists()) {
      TechnicalSearchIndex.deleteIndex(TechnicalSearchIndex.alias());
    }
    if (!TechnicalSearchIndex.aliasExists() || !TechnicalSearchIndex.mappingIsCurrent()) {
      rebuild();
    }
  }

  /** Cheap periodic check: builds the index when it was never created, for example after an outage. */
  public static void ensureAliasExists() {
    if (!TechnicalSearchIndex.aliasExists()) {
      ensureIndex();
    }
  }

  public static Map<String, Object> rebuild() {
    if (!REBUILD_LOCK.tryLock()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.INDEX_UNAVAILABLE,
          "A Technical Dictionary index rebuild is already running");
    }
    try {
      return rebuildLocked();
    } finally {
      REBUILD_LOCK.unlock();
    }
  }

  private static Map<String, Object> rebuildLocked() {
    final String physicalIndex = TechnicalSearchIndex.createPhysicalIndex();
    TechnicalOutbox.markRebuilding(true);
    long indexed = 0;
    try {
      indexed = fill(physicalIndex);
      TechnicalSearchIndex.refreshIndex(physicalIndex);
      TechnicalSearchIndex.switchAlias(physicalIndex);
    } catch (RuntimeException exception) {
      TechnicalSearchIndex.deleteIndex(physicalIndex);
      throw exception;
    } finally {
      TechnicalOutbox.markRebuilding(false);
    }
    TechnicalOutbox.drainPending();
    LOG.info("Technical Dictionary index rebuilt into {} with {} records", physicalIndex, indexed);
    return summary(physicalIndex, indexed);
  }

  private static long fill(String physicalIndex) {
    final TechnicalDocumentBuilder builder = new TechnicalDocumentBuilder();
    long indexed = 0;
    List<TechnicalRecord> page = dao().listAfter(FIRST_KEY, TechnicalOutboxBatch.SIZE);
    while (!page.isEmpty()) {
      indexed += write(physicalIndex, builder.upserts(page));
      page =
          page.size() < TechnicalOutboxBatch.SIZE
              ? List.of()
              : dao().listAfter(page.getLast().id(), TechnicalOutboxBatch.SIZE);
    }
    return indexed;
  }

  private static long write(String physicalIndex, List<IndexAction> upserts) {
    final List<String> failed = TechnicalSearchIndex.bulkInto(physicalIndex, upserts);
    if (!failed.isEmpty()) {
      throw new TechnicalIndexUnavailableException(
          String.format(
              "Rebuild rejected %d documents, for example %s", failed.size(), failed.getFirst()));
    }
    return upserts.size();
  }

  private static Map<String, Object> summary(String physicalIndex, long indexed) {
    final Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("index", physicalIndex);
    summary.put("alias", TechnicalSearchIndex.alias());
    summary.put("indexed", indexed);
    summary.put("pending", TechnicalOutbox.pendingCount());
    return summary;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }

  /** Page size of a rebuild read. */
  private static final class TechnicalOutboxBatch {
    private static final int SIZE = 500;

    private TechnicalOutboxBatch() {}
  }
}
