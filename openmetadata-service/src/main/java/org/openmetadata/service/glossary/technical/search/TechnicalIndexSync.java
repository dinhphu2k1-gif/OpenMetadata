/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.collect.Lists;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.TechnicalIndexOutboxDAO;
import org.openmetadata.service.jdbi3.TechnicalIndexOutboxDAO.OutboxEntry;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

/**
 * Keeps `technical_dictionary_search_index` aligned with the database. After a committed write the
 * affected documents are rebuilt from the database and written with {@code refresh=wait_for}; when
 * that fails the record ids go to `technical_index_outbox` and the request still succeeds. The
 * outbox is drained at startup, periodically and before every Technical Dictionary read.
 */
@Slf4j
public final class TechnicalIndexSync {
  static final int BATCH_SIZE = 500;
  private static final int REQUEST_OUTBOX_BATCHES = 1;
  private static final int DRAIN_OUTBOX_BATCHES = 200;
  private static final int MAX_ERROR_LENGTH = 2_000;
  private static final long WORKER_PERIOD_SECONDS = 60;
  private static final String FIRST_KEY = "";
  private static final String GLOSSARY = "glossary";
  private static final String NAME = "name";

  private static final ReentrantLock OUTBOX_LOCK = new ReentrantLock();
  private static final AtomicBoolean WORKER_STARTED = new AtomicBoolean();
  private static final AtomicBoolean REBUILDING = new AtomicBoolean();
  private static final ScheduledExecutorService WORKER =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            final Thread thread = new Thread(runnable, "technical-index-outbox");
            thread.setDaemon(true);
            return thread;
          });

  private TechnicalIndexSync() {}

  /** Rebuilds the documents of the given records after a committed write; never throws. */
  public static void refresh(Collection<UUID> termIds) {
    final List<UUID> distinct = termIds.stream().distinct().toList();
    if (REBUILDING.get()) {
      enqueue(distinct, "Written while the index was being rebuilt");
    }
    Lists.partition(distinct, BATCH_SIZE).forEach(TechnicalIndexSync::refreshBatch);
  }

  public static void refresh(UUID termId) {
    refresh(List.of(termId));
  }

  private static void refreshBatch(List<UUID> batch) {
    try {
      final List<String> failed = write(batch);
      enqueue(failed.stream().map(UUID::fromString).toList(), "Rejected by the search engine");
    } catch (RuntimeException exception) {
      // A committed write must succeed even when its search document cannot be written now.
      LOG.warn("Technical Dictionary index sync failed for {} records; queued", batch.size(), exception);
      enqueue(batch, errorOf(exception));
    }
  }

  private static List<String> write(List<UUID> termIds) {
    return TechnicalSearchIndex.bulk(new TechnicalDocumentBuilder().build(termIds), true);
  }

  /** Re-synchronizes every record of one catalog version, for example after a cutover. */
  public static void refreshScope(String parentBusinessVersion) {
    try {
      TechnicalCatalog.findGlossary()
          .ifPresent(technical -> refreshScope(technical, parentBusinessVersion));
    } catch (JdbiException exception) {
      LOG.error(
          "Unable to list Technical Dictionary records of version {}; rebuild the index",
          parentBusinessVersion,
          exception);
    }
  }

  private static void refreshScope(Glossary technical, String parentBusinessVersion) {
    final TechnicalSourceStateDAO dao = Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
    final String prefix = TechnicalCatalog.recordHashPrefix(technical);
    List<RecordIdentity> page =
        dao.listRecordsInScopeAfter(prefix, parentBusinessVersion, FIRST_KEY, BATCH_SIZE);
    while (!page.isEmpty()) {
      refresh(page.stream().map(RecordIdentity::termId).toList());
      final String last = page.getLast().termId().toString();
      page = page.size() < BATCH_SIZE
          ? List.of()
          : dao.listRecordsInScopeAfter(prefix, parentBusinessVersion, last, BATCH_SIZE);
    }
  }

  /**
   * Re-synchronizes the records that reference Data Dictionary CDEs approved in a new version, so
   * their stored CDE code, name and owners stay current. Keys are catalog versions; never throws.
   */
  public static void onCdesApproved(Map<String, Set<UUID>> cdeIdsByScope) {
    cdeIdsByScope.forEach(TechnicalIndexSync::refreshReferencing);
  }

  private static void refreshReferencing(String parentBusinessVersion, Set<UUID> cdeIds) {
    try {
      refresh(TechnicalSearchQueries.termIdsReferencingCdes(cdeIds, parentBusinessVersion));
    } catch (RuntimeException exception) {
      // The Data Dictionary workflow must not fail because the Technical Dictionary index is down.
      LOG.warn(
          "Unable to refresh Technical Dictionary records of {} approved CDEs in version {}",
          cdeIds.size(),
          parentBusinessVersion,
          exception);
    }
  }

  public static boolean isDataDictionaryTerm(PublishedSnapshotRecord snapshot) {
    final boolean isTerm = GlossaryVersioningService.GLOSSARY_TERM.equals(snapshot.entityType());
    return isTerm
        && !nullOrEmpty(snapshot.parentBusinessVersion())
        && DataDictionaryResolver.DATA_DICTIONARY_NAME.equals(
            glossaryNameOf(JsonUtils.readTree(snapshot.payload())));
  }

  /** True when a working or snapshot payload is a Technical Dictionary record or catalog. */
  public static boolean isTechnicalPayload(String payload) {
    final JsonNode root = JsonUtils.readTree(payload);
    final String name = root.has(GLOSSARY) ? glossaryNameOf(root) : root.path(NAME).asText(null);
    return GovernedGlossaryProfileRegistry.findByName(name).orElse(null)
        == GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY;
  }

  private static String glossaryNameOf(JsonNode payload) {
    return payload.path(GLOSSARY).path(NAME).asText(null);
  }

  /** The Technical Dictionary records among the given term ids; empty when they cannot be read. */
  public static Set<UUID> technicalRecordIds(Collection<UUID> termIds) {
    Set<UUID> result = Set.of();
    try {
      result =
          TechnicalCatalog.findGlossary()
              .map(technical -> recordIds(technical, termIds))
              .orElse(Set.of());
    } catch (JdbiException exception) {
      LOG.warn("Unable to classify {} records for index sync", termIds.size(), exception);
    }
    return result;
  }

  private static Set<UUID> recordIds(Glossary technical, Collection<UUID> termIds) {
    final List<String> ids = termIds.stream().map(UUID::toString).distinct().toList();
    return ids.isEmpty()
        ? Set.of()
        : Entity.getJdbi()
            .onDemand(TechnicalSourceStateDAO.class)
            .listRecordsByIds(TechnicalCatalog.recordHashPrefix(technical), ids)
            .stream()
            .map(RecordIdentity::termId)
            .collect(Collectors.toUnmodifiableSet());
  }

  /** Processes one outbox batch; used before every Technical Dictionary read. */
  public static void processPendingForRequest() {
    processPending(REQUEST_OUTBOX_BATCHES);
  }

  public static void drainPending() {
    processPending(DRAIN_OUTBOX_BATCHES);
  }

  /**
   * Drains up to {@code maxBatches} batches. Skipped during a rebuild: entries queued meanwhile
   * must be written into the new index, after the alias has moved.
   */
  private static void processPending(int maxBatches) {
    if (!REBUILDING.get() && OUTBOX_LOCK.tryLock()) {
      try {
        boolean more = true;
        for (int batch = 0; batch < maxBatches && more; batch++) {
          more = processBatch();
        }
      } finally {
        OUTBOX_LOCK.unlock();
      }
    }
  }

  /** Returns true when a full batch was processed successfully and more work may remain. */
  private static boolean processBatch() {
    final TechnicalIndexOutboxDAO dao = outbox();
    final List<OutboxEntry> entries = dao.listPending(BATCH_SIZE);
    boolean more = false;
    if (!entries.isEmpty()) {
      more = retry(dao, entries) && entries.size() == BATCH_SIZE;
    }
    return more;
  }

  private static boolean retry(TechnicalIndexOutboxDAO dao, List<OutboxEntry> entries) {
    final List<UUID> termIds = entries.stream().map(OutboxEntry::termId).toList();
    final long cutoff = entries.stream().mapToLong(OutboxEntry::enqueuedAt).max().orElse(0L);
    boolean succeeded = false;
    try {
      final List<String> failed = write(termIds);
      final List<String> written =
          termIds.stream().map(UUID::toString).filter(id -> !failed.contains(id)).toList();
      deleteProcessed(dao, written, cutoff);
      markFailed(dao, failed, "Rejected by the search engine");
      succeeded = failed.isEmpty();
    } catch (RuntimeException exception) {
      // Leave the batch queued; it is retried by the next drain.
      LOG.warn("Technical Dictionary index outbox batch failed", exception);
      markFailed(dao, termIds.stream().map(UUID::toString).toList(), errorOf(exception));
    }
    return succeeded;
  }

  private static void deleteProcessed(TechnicalIndexOutboxDAO dao, List<String> termIds, long cutoff) {
    if (!termIds.isEmpty()) {
      dao.deleteProcessed(termIds, cutoff);
    }
  }

  private static void markFailed(TechnicalIndexOutboxDAO dao, List<String> termIds, String error) {
    if (!termIds.isEmpty()) {
      dao.markFailed(termIds, error);
    }
  }

  private static void enqueue(List<UUID> termIds, String reason) {
    final long now = System.currentTimeMillis();
    try {
      final TechnicalIndexOutboxDAO dao = outbox();
      termIds.forEach(termId -> dao.enqueue(termId.toString(), now));
    } catch (JdbiException exception) {
      LOG.error(
          "Unable to queue {} Technical Dictionary records for index sync ({}); rebuild the index",
          termIds.size(),
          reason,
          exception);
    }
  }

  /** Starts the periodic outbox worker once per JVM. */
  public static void startWorker() {
    if (WORKER_STARTED.compareAndSet(false, true)) {
      WORKER.scheduleWithFixedDelay(
          TechnicalIndexSync::drainSafely,
          WORKER_PERIOD_SECONDS,
          WORKER_PERIOD_SECONDS,
          TimeUnit.SECONDS);
    }
  }

  private static void drainSafely() {
    try {
      TechnicalIndexRebuilder.ensureAliasExists();
      drainPending();
    } catch (RuntimeException exception) {
      // A failing run must not cancel the scheduled worker.
      LOG.warn("Technical Dictionary index outbox worker run failed", exception);
    }
  }

  /** While true, every synchronized record is also queued so a rebuild cannot lose it. */
  static void markRebuilding(boolean rebuilding) {
    REBUILDING.set(rebuilding);
  }

  public static long pendingCount() {
    return outbox().countPending();
  }

  private static TechnicalIndexOutboxDAO outbox() {
    return Entity.getJdbi().onDemand(TechnicalIndexOutboxDAO.class);
  }

  private static String errorOf(RuntimeException exception) {
    final String message =
        exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
    return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
  }
}
