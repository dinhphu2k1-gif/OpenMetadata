/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.PortalConfiguration;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.OutboxEntry;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * Durable side effects of Data Quality Rule and Technical Dictionary changes. A change records
 * what has to follow in the same transaction; after commit the entries are processed on the
 * worker thread, failed ones stay queued and are retried. Every entry is derived from the
 * database again when it is processed, so repeating it is safe.
 */
@Slf4j
public final class DqTestOutbox {
  public static final String RECONCILE_RULE = "RECONCILE_RULE";
  public static final String RECONCILE_COLUMN = "RECONCILE_COLUMN";
  public static final String RETIRE_SCOPE = "RETIRE_SCOPE";
  public static final String SYNC_PIPELINE = "SYNC_PIPELINE";
  public static final String RECONCILE_ALL = "RECONCILE_ALL";

  /** An ingestion pipeline was created, changed, switched on or off or deleted on the Portal. */
  public static final String SYNC_INGESTION_PIPELINE = "SYNC_INGESTION_PIPELINE";

  /** A run of an ingestion pipeline was requested on the Portal. */
  public static final String TRIGGER_INGESTION_PIPELINE = "TRIGGER_PIPELINE";

  static final int BATCH_SIZE = 50;
  private static final int DRAIN_BATCHES = 200;
  private static final int MAX_ERROR_LENGTH = 2_000;
  private static final long WORKER_PERIOD_SECONDS = 60;
  private static final String ALL_KEY = "all";

  private static final ReentrantLock LOCK = new ReentrantLock();
  private static final AtomicBoolean WORKER_STARTED = new AtomicBoolean();
  private static final ScheduledExecutorService WORKER =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            final Thread thread = new Thread(runnable, "dq-test-outbox");
            thread.setDaemon(true);
            return thread;
          });

  private DqTestOutbox() {}

  // ---- recording, in the caller's transaction ---------------------------------------------

  public static void enqueueRule(DqRuleTestDAO dao, String ruleId) {
    enqueue(dao, RECONCILE_RULE, ruleId, null);
  }

  public static void enqueueColumn(DqRuleTestDAO dao, String columnKey, String previousCdeId) {
    enqueue(dao, RECONCILE_COLUMN, columnKey, previousCdeId);
  }

  public static void enqueueScopeRetirement(DqRuleTestDAO dao, String scope) {
    enqueue(dao, RETIRE_SCOPE, scope, null);
  }

  public static void enqueueAll(DqRuleTestDAO dao) {
    enqueue(dao, RECONCILE_ALL, ALL_KEY, null);
  }

  /**
   * The Portal has no pipeline service client, so it records the change and the OpenMetadata
   * server deploys the pipeline. The payload is the pipeline name, which is all that is left to
   * remove the deployed pipeline once the pipeline itself is deleted.
   */
  public static void enqueueIngestionPipelineSync(UUID pipelineId, String pipelineName) {
    enqueue(dao(), SYNC_INGESTION_PIPELINE, pipelineId.toString(), pipelineName);
  }

  public static void enqueueIngestionPipelineTrigger(UUID pipelineId) {
    enqueue(dao(), TRIGGER_INGESTION_PIPELINE, pipelineId.toString(), null);
  }

  private static void enqueue(DqRuleTestDAO dao, String kind, String key, String payload) {
    dao.enqueue(kind, key, payload, System.currentTimeMillis());
  }

  /**
   * A Technical Dictionary change of a Column was just projected. The Technical Dictionary outbox
   * entry that led here is durable and retried, so this is queued in its own transaction.
   */
  public static void afterColumnProjected(String columnKey) {
    enqueueColumn(dao(), columnKey, null);
    drainAsync();
  }

  /** Publication hook: queues the reconcile of an approved Data Quality Rule. */
  public static void onPublished(Handle handle, PublishedSnapshotRecord published) {
    if (isDataQualityRule(published)) {
      enqueueRule(handle.attach(DqRuleTestDAO.class), published.entityId().toString());
    }
  }

  /**
   * Publication of a governed glossary version (a Data Dictionary or Data Quality cutover or the
   * approval of a catalog with its rules) changes which Rules are effective.
   */
  public static void onGlossaryPublished(Handle handle, UUID glossaryId) {
    final boolean governed =
        GovernedGlossaryProfileRegistry.isGoverned(
            Entity.getEntity(
                Entity.GLOSSARY, glossaryId, "", org.openmetadata.schema.type.Include.ALL));
    if (governed) {
      enqueueAll(handle.attach(DqRuleTestDAO.class));
    }
  }

  public static boolean isDataQualityRule(PublishedSnapshotRecord snapshot) {
    final boolean isTerm = Entity.GLOSSARY_TERM.equals(snapshot.entityType());
    return isTerm
        && !nullOrEmpty(snapshot.parentBusinessVersion())
        && GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY
            .glossaryName()
            .equals(
                JsonUtils.readTree(snapshot.payload()).path("glossary").path("name").asText(null));
  }

  // ---- processing --------------------------------------------------------------------------

  /**
   * Processes the queue on the worker thread; used after a committed change. The Portal only
   * records entries: the OpenMetadata server owns the pipeline service and processes them.
   */
  public static void drainAsync() {
    if (!PortalConfiguration.isActive()) {
      WORKER.execute(DqTestOutbox::drainSafely);
    }
  }

  public static void drainPending() {
    if (!PortalConfiguration.isActive()) {
      process(DRAIN_BATCHES);
    }
  }

  public static void startWorker() {
    if (WORKER_STARTED.compareAndSet(false, true)) {
      WORKER.scheduleWithFixedDelay(
          DqTestOutbox::drainSafely,
          WORKER_PERIOD_SECONDS,
          WORKER_PERIOD_SECONDS,
          TimeUnit.SECONDS);
    }
  }

  public static long pendingCount() {
    return dao().countPending();
  }

  public static Long oldestPendingAt() {
    return dao().oldestPendingAt();
  }

  private static void drainSafely() {
    try {
      drainPending();
    } catch (RuntimeException exception) {
      LOG.warn("Data Quality test outbox worker run failed", exception);
    }
  }

  private static void process(int maxBatches) {
    if (LOCK.tryLock()) {
      try {
        boolean more = true;
        for (int batch = 0; batch < maxBatches && more; batch++) {
          more = processBatch();
        }
      } catch (JdbiException exception) {
        LOG.warn("Data Quality test outbox could not be read", exception);
      } finally {
        LOCK.unlock();
      }
    }
  }

  /** Returns true when a full batch succeeded, so more work may remain. */
  private static boolean processBatch() {
    final List<OutboxEntry> entries = dao().listPending(BATCH_SIZE);
    final List<OutboxEntry> columns =
        entries.stream().filter(entry -> RECONCILE_COLUMN.equals(entry.kind())).toList();
    boolean succeeded = processColumns(columns);
    for (OutboxEntry entry : entries) {
      if (!RECONCILE_COLUMN.equals(entry.kind())) {
        succeeded &= processEntry(entry);
      }
    }
    return succeeded && entries.size() == BATCH_SIZE;
  }

  /**
   * Columns changed together (a Technical Dictionary import) reconcile every Rule they touch once,
   * not once per Column.
   */
  private static boolean processColumns(List<OutboxEntry> columns) {
    boolean succeeded = true;
    if (!columns.isEmpty()) {
      try {
        final Set<String> ruleIds = new LinkedHashSet<>();
        columns.forEach(entry -> ruleIds.addAll(rulesOfColumn(entry)));
        final int errors = reconcileRules(ruleIds);
        if (errors > 0) {
          throw new IllegalStateException(errors + " binding(s) could not be reconciled");
        }
        columns.forEach(
            entry -> dao().deleteProcessed(entry.kind(), entry.subjectKey(), entry.enqueuedAt()));
      } catch (RuntimeException exception) {
        LOG.warn("Data Quality test outbox column batch failed", exception);
        columns.forEach(
            entry -> dao().markFailed(entry.kind(), entry.subjectKey(), error(exception)));
        succeeded = false;
      }
    }
    return succeeded;
  }

  private static boolean processEntry(OutboxEntry entry) {
    boolean succeeded = true;
    try {
      final int errors = run(entry);
      if (errors > 0) {
        throw new IllegalStateException(errors + " binding(s) could not be reconciled");
      }
      dao().deleteProcessed(entry.kind(), entry.subjectKey(), entry.enqueuedAt());
    } catch (RuntimeException exception) {
      LOG.warn(
          "Data Quality test outbox {} entry {} failed",
          entry.kind(),
          entry.subjectKey(),
          exception);
      dao().markFailed(entry.kind(), entry.subjectKey(), error(exception));
      succeeded = false;
    }
    return succeeded;
  }

  private static int run(OutboxEntry entry) {
    return switch (entry.kind()) {
      case RECONCILE_RULE -> DqTestReconciler.reconcileRule(entry.subjectKey());
      case RECONCILE_COLUMN -> reconcileRules(rulesOfColumn(entry));
      case SYNC_PIPELINE -> DqTestReconciler.reconcileRule(entry.subjectKey());
      case SYNC_INGESTION_PIPELINE -> {
        DqPipelineGateway.syncIngestionPipeline(entry.subjectKey(), entry.payload());
        yield 0;
      }
      case TRIGGER_INGESTION_PIPELINE -> {
        DqPipelineGateway.triggerIngestionPipeline(entry.subjectKey());
        yield 0;
      }
      case RETIRE_SCOPE, RECONCILE_ALL -> reconcileRules(allRuleIds());
      default -> throw new IllegalArgumentException("Unknown outbox kind " + entry.kind());
    };
  }

  /** The Rules of the CDE the Column left, of the CDE it joined and of its bindings. */
  private static Set<String> rulesOfColumn(OutboxEntry entry) {
    final Set<String> ruleIds = new LinkedHashSet<>();
    dao()
        .listBindingsByColumn(entry.subjectKey())
        .forEach(binding -> ruleIds.add(binding.ruleTermId()));
    if (!nullOrEmpty(entry.payload())) {
      dao().listRuleExecByCde(entry.payload()).forEach(rule -> ruleIds.add(rule.ruleTermId()));
    }
    for (ColumnRow column : dao().listColumnsByKeys(List.of(entry.subjectKey()))) {
      if (column.cdeTermId() != null) {
        dao().listRuleExecByCde(column.cdeTermId()).forEach(rule -> ruleIds.add(rule.ruleTermId()));
      }
    }
    return ruleIds;
  }

  private static int reconcileRules(Set<String> ruleIds) {
    int errors = 0;
    for (String ruleId : ruleIds) {
      errors += DqTestReconciler.reconcileRule(ruleId);
    }
    return errors;
  }

  private static Set<String> allRuleIds() {
    final Set<String> ruleIds = new LinkedHashSet<>();
    dao().listRuleExec().forEach(rule -> ruleIds.add(rule.ruleTermId()));
    DqRuleSource.effectiveRuleIds().forEach(id -> ruleIds.add(id.toString()));
    return ruleIds;
  }

  /** Bindings that failed, for the reconcile status endpoint. */
  public static List<BindingRow> errorBindings() {
    return dao().listBindingsInState(DqTestReconciler.ERROR);
  }

  static UUID uuid(String id) {
    return UUID.fromString(id);
  }

  private static String error(RuntimeException exception) {
    final String message =
        exception.getMessage() == null
            ? exception.getClass().getSimpleName()
            : exception.getMessage();
    return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
  }

  private static DqRuleTestDAO dao() {
    return Entity.getJdbi().onDemand(DqRuleTestDAO.class);
  }
}
