/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.dq.DqTestOutbox;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentBuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexRebuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.OutboxEntry;

/**
 * Durable side effects of Technical Dictionary writes. A write records what has to follow in the
 * same transaction: rebuilding the search document ({@code INDEX}), projecting the tags of a Column
 * ({@code PROJECTION}) and clearing the Columns of a replaced Data Dictionary version ({@code
 * RESET}). After commit the entries are processed at once; failed ones stay queued and are retried
 * by the worker and before every read. Every entry is derived from the database again when it is
 * processed, so repeating it is safe.
 */
@Slf4j
public final class TechnicalOutbox {
  public static final String INDEX = "INDEX";
  public static final String PROJECTION = "PROJECTION";
  public static final String RESET = "RESET";

  static final int BATCH_SIZE = 500;
  private static final int REQUEST_BATCHES = 2;
  private static final int DRAIN_BATCHES = 200;
  private static final int MAX_ERROR_LENGTH = 2_000;
  private static final long WORKER_PERIOD_SECONDS = 60;

  private static final ReentrantLock LOCK = new ReentrantLock();
  private static final AtomicBoolean WORKER_STARTED = new AtomicBoolean();
  private static final AtomicBoolean REBUILDING = new AtomicBoolean();
  private static final ScheduledExecutorService WORKER =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            final Thread thread = new Thread(runnable, "technical-outbox");
            thread.setDaemon(true);
            return thread;
          });

  private TechnicalOutbox() {}

  /** Queues the document rebuild and the Column projection of a record, in the caller's transaction. */
  public static void enqueueRecord(TechnicalDictionaryDAO dao, TechnicalRecord record) {
    enqueueIndex(dao, record.id());
    enqueueProjection(dao, record.columnKey(), record.columnFqn());
  }

  public static void enqueueIndex(TechnicalDictionaryDAO dao, String recordId) {
    dao.enqueue(INDEX, recordId, null, System.currentTimeMillis());
  }

  public static void enqueueProjection(
      TechnicalDictionaryDAO dao, String columnKey, String columnFqn) {
    dao.enqueue(PROJECTION, columnKey, columnFqn, System.currentTimeMillis());
  }

  /** Queues the removal of the tags and documents of the records deleted by one reset. */
  public static void enqueueReset(TechnicalDictionaryDAO dao, String replacedVersion) {
    dao.enqueue(RESET, replacedVersion, replacedVersion, System.currentTimeMillis());
  }

  /** Processes a few batches after a committed write; never throws. */
  public static void flush() {
    process(REQUEST_BATCHES);
  }

  public static void flush(int maxBatches) {
    process(maxBatches);
  }

  public static void drainPending() {
    process(DRAIN_BATCHES);
  }

  /** Processes the outbox on the worker thread, for work too long for a request. */
  public static void drainAsync() {
    WORKER.execute(TechnicalOutbox::drainSafely);
  }

  /**
   * A CDE approved in a new version changes the CDE code, name and owners stored in the documents
   * of the records that reference it. Never throws: the Data Dictionary workflow must not fail
   * because the Technical Dictionary index is behind.
   */
  public static void onCdesApproved(Map<String, Set<UUID>> cdeIdsByScope) {
    try {
      final Set<UUID> cdeIds =
          cdeIdsByScope.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
      final Set<String> recordIds = TechnicalDocumentBuilder.recordIdsOfCdes(cdeIds);
      if (!recordIds.isEmpty()) {
        recordIds.forEach(id -> enqueueIndex(dao(), id));
        flush();
      }
    } catch (RuntimeException exception) {
      LOG.warn("Unable to refresh Technical Dictionary records of approved CDEs", exception);
    }
  }

  public static boolean isDataDictionaryTerm(PublishedSnapshotRecord snapshot) {
    final boolean isTerm = Entity.GLOSSARY_TERM.equals(snapshot.entityType());
    return isTerm
        && !nullOrEmpty(snapshot.parentBusinessVersion())
        && DataDictionaryResolver.DATA_DICTIONARY_NAME.equals(
            JsonUtils.readTree(snapshot.payload()).path("glossary").path("name").asText(null));
  }

  public static long pendingCount() {
    return dao().countPending();
  }

  /** While true nothing is processed: entries queued during a rebuild are written after it. */
  public static void markRebuilding(boolean rebuilding) {
    REBUILDING.set(rebuilding);
  }

  public static void startWorker() {
    if (WORKER_STARTED.compareAndSet(false, true)) {
      WORKER.scheduleWithFixedDelay(
          TechnicalOutbox::drainSafely,
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
      LOG.warn("Technical Dictionary outbox worker run failed", exception);
    }
  }

  private static void process(int maxBatches) {
    if (!REBUILDING.get() && LOCK.tryLock()) {
      try {
        boolean more = true;
        for (int batch = 0; batch < maxBatches && more; batch++) {
          more = processBatch();
        }
      } catch (JdbiException exception) {
        LOG.warn("Technical Dictionary outbox could not be read", exception);
      } finally {
        LOCK.unlock();
      }
    }
  }

  /** Returns true when a full batch succeeded, so more work may remain. */
  private static boolean processBatch() {
    final List<OutboxEntry> entries = dao().listPending(BATCH_SIZE);
    boolean succeeded = true;
    succeeded &= processIndex(kind(entries, INDEX));
    succeeded &= processEach(kind(entries, PROJECTION), TechnicalOutbox::project);
    succeeded &= processEach(kind(entries, RESET), TechnicalOutbox::reset);
    return succeeded && entries.size() == BATCH_SIZE;
  }

  private static List<OutboxEntry> kind(List<OutboxEntry> entries, String kind) {
    return entries.stream().filter(entry -> kind.equals(entry.kind())).toList();
  }

  private static boolean processIndex(List<OutboxEntry> entries) {
    boolean succeeded = true;
    if (!entries.isEmpty()) {
      final List<String> ids = entries.stream().map(OutboxEntry::subjectKey).toList();
      try {
        final List<String> failed =
            TechnicalSearchIndex.bulk(new TechnicalDocumentBuilder().build(ids), true);
        entries.forEach(entry -> settle(entry, failed.contains(entry.subjectKey()), "Rejected"));
        succeeded = failed.isEmpty();
      } catch (RuntimeException exception) {
        LOG.warn("Technical Dictionary index batch failed", exception);
        entries.forEach(
            entry -> dao().markFailed(entry.kind(), entry.subjectKey(), error(exception)));
        succeeded = false;
      }
    }
    return succeeded;
  }

  private static boolean processEach(List<OutboxEntry> entries, EntryAction action) {
    boolean succeeded = true;
    for (OutboxEntry entry : entries) {
      try {
        action.run(entry);
        dao().deleteProcessed(entry.kind(), entry.subjectKey(), entry.enqueuedAt());
      } catch (RuntimeException exception) {
        LOG.warn(
            "Technical Dictionary {} entry {} failed", entry.kind(), entry.subjectKey(), exception);
        dao().markFailed(entry.kind(), entry.subjectKey(), error(exception));
        succeeded = false;
      }
    }
    return succeeded;
  }

  private static void settle(OutboxEntry entry, boolean failed, String reason) {
    if (failed) {
      dao().markFailed(entry.kind(), entry.subjectKey(), reason);
    } else {
      dao().deleteProcessed(entry.kind(), entry.subjectKey(), entry.enqueuedAt());
    }
  }

  private static void project(OutboxEntry entry) {
    new TechnicalColumnProjection().projectColumns(List.of(entry.payload()));
    DqTestOutbox.afterColumnProjected(entry.subjectKey());
  }

  /** Clears the projection and the documents of every record removed by one reset. */
  private static void reset(OutboxEntry entry) {
    final String version = entry.payload();
    String after = "";
    List<TechnicalDictionaryDAO.AuditRow> page = dao().listResetAfter(version, after, BATCH_SIZE);
    while (!page.isEmpty()) {
      new TechnicalColumnProjection()
          .projectColumns(page.stream().map(TechnicalDictionaryDAO.AuditRow::columnFqn).toList());
      deleteDocuments(page);
      after = page.getLast().id();
      page = dao().listResetAfter(version, after, BATCH_SIZE);
    }
  }

  private static void deleteDocuments(List<TechnicalDictionaryDAO.AuditRow> page) {
    final List<TechnicalSearchIndex.IndexAction> deletes = new ArrayList<>();
    page.forEach(audit -> deletes.add(TechnicalSearchIndex.IndexAction.delete(audit.recordId())));
    TechnicalSearchIndex.bulk(deletes, false);
  }

  private static String error(RuntimeException exception) {
    final String message =
        exception.getMessage() == null
            ? exception.getClass().getSimpleName()
            : exception.getMessage();
    return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }

  @FunctionalInterface
  private interface EntryAction {
    void run(OutboxEntry entry);
  }
}
