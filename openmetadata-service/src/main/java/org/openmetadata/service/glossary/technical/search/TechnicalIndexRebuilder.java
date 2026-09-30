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
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex.IndexAction;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

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
    TechnicalIndexSync.markRebuilding(true);
    long indexed = 0;
    try {
      indexed = fill(physicalIndex);
      TechnicalSearchIndex.refreshIndex(physicalIndex);
      TechnicalSearchIndex.switchAlias(physicalIndex);
    } catch (RuntimeException exception) {
      TechnicalSearchIndex.deleteIndex(physicalIndex);
      throw exception;
    } finally {
      TechnicalIndexSync.markRebuilding(false);
    }
    TechnicalIndexSync.drainPending();
    LOG.info("Technical Dictionary index rebuilt into {} with {} records", physicalIndex, indexed);
    return summary(physicalIndex, indexed);
  }

  private static long fill(String physicalIndex) {
    long indexed = 0;
    final Glossary technical = TechnicalCatalog.findGlossary().orElse(null);
    if (technical != null) {
      final String prefix = TechnicalCatalog.recordHashPrefix(technical);
      List<RecordIdentity> page = dao().listRecordsAfter(prefix, FIRST_KEY, TechnicalIndexSync.BATCH_SIZE);
      while (!page.isEmpty()) {
        indexed += write(physicalIndex, page);
        page = nextPage(prefix, page);
      }
    }
    return indexed;
  }

  private static List<RecordIdentity> nextPage(String prefix, List<RecordIdentity> page) {
    return page.size() < TechnicalIndexSync.BATCH_SIZE
        ? List.of()
        : dao().listRecordsAfter(
            prefix, page.getLast().termId().toString(), TechnicalIndexSync.BATCH_SIZE);
  }

  private static long write(String physicalIndex, List<RecordIdentity> page) {
    final List<IndexAction> upserts =
        new TechnicalDocumentBuilder()
            .buildIdentities(page).stream()
                .filter(action -> !action.isDelete())
                .toList();
    final List<String> failed = TechnicalSearchIndex.bulkInto(physicalIndex, upserts);
    if (!failed.isEmpty()) {
      throw new TechnicalIndexUnavailableException(
          String.format("Rebuild rejected %d documents, for example %s", failed.size(), failed.getFirst()));
    }
    return upserts.size();
  }

  private static Map<String, Object> summary(String physicalIndex, long indexed) {
    final Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("index", physicalIndex);
    summary.put("alias", TechnicalSearchIndex.alias());
    summary.put("indexed", indexed);
    summary.put("pending", TechnicalIndexSync.pendingCount());
    return summary;
  }

  private static TechnicalSourceStateDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }
}
