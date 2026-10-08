/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.search.GovernanceOutboxRunner;
import org.openmetadata.service.governance.search.GovernanceSearchIndex.IndexAction;
import org.openmetadata.service.governance.search.GovernanceSearchMetrics;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO.ScopeEvent;

/**
 * Durable, coalescing scope rebuilds for governed glossary search rows. Writes and reads only take
 * fresh entries; entries that already failed are retried by the worker, which gives them a
 * worker-period backoff and keeps one failing scope from blocking the others. Nothing touches the
 * engine while its circuit is open.
 */
@Slf4j
public final class GovernedGlossaryOutbox {
  private static final int BATCH_SIZE = 100;
  private static final int DRAIN_BATCHES = 500;
  private static final int FLUSH_BATCHES = 5;
  private static final int MAX_ERROR_LENGTH = 2_000;
  private static final long WORKER_PERIOD_SECONDS = 60;
  private static final GovernanceOutboxRunner RUNNER =
      new GovernanceOutboxRunner("governed-glossary-search-outbox");

  private GovernedGlossaryOutbox() {}

  public static void enqueue(
      final GovernedGlossarySearchDAO dao,
      final UUID glossaryId,
      final String parentBusinessVersion) {
    if (glossaryId != null && parentBusinessVersion != null) {
      dao.enqueue(glossaryId, parentBusinessVersion, System.currentTimeMillis());
    }
  }

  /** After a committed write: waits for the lock and indexes the fresh entries. */
  public static void flush() {
    flushAfterWrite(FLUSH_BATCHES);
  }

  /** After a committed bulk write, which may have queued many scopes. */
  public static void flushAll() {
    flushAfterWrite(DRAIN_BATCHES);
  }

  /** Before a list read: indexes fresh entries only when the lock is free. */
  public static void drainBeforeRead() {
    if (isReachable()) {
      RUNNER.process(
          FLUSH_BATCHES, () -> processBatch(freshEntries()), GovernedGlossaryOutbox::readFailed);
    }
  }

  /** Every pending entry, including the failed ones; for the worker, startup and rebuilds. */
  public static void drainPending() {
    RUNNER.process(
        DRAIN_BATCHES, () -> processBatch(allEntries()), GovernedGlossaryOutbox::readFailed);
  }

  public static void startWorker() {
    RUNNER.start(GovernedGlossaryOutbox::drainSafely, WORKER_PERIOD_SECONDS);
  }

  public static void markRebuilding(final boolean rebuilding) {
    RUNNER.markRebuilding(rebuilding);
  }

  private static void flushAfterWrite(final int maxBatches) {
    if (isReachable()) {
      RUNNER.processAfterWrite(
          maxBatches, () -> processBatch(freshEntries()), GovernedGlossaryOutbox::readFailed);
    }
  }

  private static boolean isReachable() {
    return GovernedGlossarySearchIndex.index().isReachable();
  }

  private static void drainSafely() {
    try {
      GovernedGlossaryIndexRebuilder.ensureAliasExists();
      drainPending();
      if (GovernedGlossaryReconciler.reconcile() > 0) {
        drainPending();
      }
    } catch (RuntimeException exception) {
      GovernanceSearchMetrics.GOVERNED.setAvailable(false);
      LOG.warn("Governed glossary search worker run failed", exception);
    } finally {
      updateMetrics();
    }
  }

  private static void readFailed(final JdbiException exception) {
    LOG.warn("Governed glossary search outbox could not be read", exception);
  }

  private static List<ScopeEvent> freshEntries() {
    return dao().listFresh(BATCH_SIZE);
  }

  private static List<ScopeEvent> allEntries() {
    return dao().listPending(BATCH_SIZE);
  }

  /** Returns true when a full batch succeeded, so more work may remain. */
  private static boolean processBatch(final List<ScopeEvent> entries) {
    boolean succeeded = true;
    for (ScopeEvent entry : entries) {
      succeeded &= process(entry);
    }
    return succeeded && entries.size() == BATCH_SIZE;
  }

  private static boolean process(final ScopeEvent entry) {
    boolean succeeded = false;
    try {
      final List<IndexAction> actions = actions(entry);
      final List<String> failed = GovernedGlossarySearchIndex.index().bulk(actions, true);
      if (!failed.isEmpty()) {
        throw new IllegalStateException("Rejected document " + failed.getFirst());
      }
      dao().deleteProcessed(entry.glossaryId(), entry.parentBusinessVersion(), entry.enqueuedAt());
      GovernanceSearchMetrics.GOVERNED.setAvailable(true);
      succeeded = true;
    } catch (RuntimeException exception) {
      dao().markFailed(entry.glossaryId(), entry.parentBusinessVersion(), error(exception));
      GovernanceSearchMetrics.GOVERNED.recordRetry();
      GovernanceSearchMetrics.GOVERNED.setAvailable(false);
      LOG.warn(
          "Governed glossary search scope {} {} failed",
          entry.glossaryId(),
          entry.parentBusinessVersion(),
          exception);
    }
    return succeeded;
  }

  private static List<IndexAction> actions(final ScopeEvent entry) {
    List<IndexAction> actions;
    try {
      actions =
          new GovernedGlossaryDocumentBuilder()
              .buildScope(entry.glossaryId(), entry.parentBusinessVersion(), true);
    } catch (NotFoundException exception) {
      actions =
          GovernedGlossarySearchIndex.deleteAllInScope(
              entry.glossaryId(), entry.parentBusinessVersion());
    }
    return actions;
  }

  private static String error(final RuntimeException exception) {
    final String message =
        exception.getMessage() == null
            ? exception.getClass().getSimpleName()
            : exception.getMessage();
    return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
  }

  private static void updateMetrics() {
    try {
      final GovernedGlossarySearchDAO dao = dao();
      GovernanceSearchMetrics.GOVERNED.updateOutbox(dao.countPending(), dao.oldestPendingAt());
    } catch (JdbiException exception) {
      LOG.warn("Governed glossary search outbox metrics could not be read", exception);
    }
  }

  private static GovernedGlossarySearchDAO dao() {
    return Entity.getJdbi().onDemand(GovernedGlossarySearchDAO.class);
  }
}
