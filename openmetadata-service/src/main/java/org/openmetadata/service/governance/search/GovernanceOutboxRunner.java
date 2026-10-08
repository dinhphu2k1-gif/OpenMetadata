/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;

/**
 * Shared locking, bounded draining and retry-worker lifecycle for governance outboxes. Reads drain
 * opportunistically and never wait; a committed write waits up to {@link #WRITE_WAIT_SECONDS} for
 * the lock so its own entry is indexed before the response, which keeps lists read-your-writes.
 */
@Slf4j
public final class GovernanceOutboxRunner {
  public static final long WRITE_WAIT_SECONDS = 5;

  private final ReentrantLock lock = new ReentrantLock();
  private final AtomicBoolean rebuilding = new AtomicBoolean();
  private final AtomicBoolean workerStarted = new AtomicBoolean();
  private final ScheduledExecutorService worker;

  public GovernanceOutboxRunner(final String threadName) {
    worker =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              final Thread thread = new Thread(runnable, threadName);
              thread.setDaemon(true);
              return thread;
            });
  }

  /** Drains when the lock is free; used by reads and the worker. */
  public void process(
      final int maxBatches,
      final BooleanSupplier processBatch,
      final Consumer<JdbiException> databaseFailure) {
    if (!rebuilding.get() && lock.tryLock()) {
      processHoldingLock(maxBatches, processBatch, databaseFailure);
    }
  }

  /** Waits for the lock after a committed write so the written entry is processed now. */
  public void processAfterWrite(
      final int maxBatches,
      final BooleanSupplier processBatch,
      final Consumer<JdbiException> databaseFailure) {
    if (!rebuilding.get() && acquireForWrite()) {
      processHoldingLock(maxBatches, processBatch, databaseFailure);
    }
  }

  private boolean acquireForWrite() {
    boolean acquired = false;
    try {
      acquired = lock.tryLock(WRITE_WAIT_SECONDS, TimeUnit.SECONDS);
      if (!acquired) {
        LOG.warn(
            "Outbox lock busy for {}s; the write is indexed by the next drain", WRITE_WAIT_SECONDS);
      }
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted while waiting for the outbox lock", exception);
    }
    return acquired;
  }

  private void processHoldingLock(
      final int maxBatches,
      final BooleanSupplier processBatch,
      final Consumer<JdbiException> databaseFailure) {
    try {
      processLocked(maxBatches, processBatch);
    } catch (JdbiException exception) {
      databaseFailure.accept(exception);
    } finally {
      lock.unlock();
    }
  }

  public void start(final Runnable task, final long periodSeconds) {
    if (workerStarted.compareAndSet(false, true)) {
      worker.scheduleWithFixedDelay(task, periodSeconds, periodSeconds, TimeUnit.SECONDS);
    }
  }

  public void execute(final Runnable task) {
    worker.execute(task);
  }

  public void markRebuilding(final boolean value) {
    if (value) {
      rebuilding.set(true);
      lock.lock();
    } else {
      lock.unlock();
      rebuilding.set(false);
    }
  }

  private static void processLocked(final int maxBatches, final BooleanSupplier processBatch) {
    boolean more = true;
    for (int batch = 0; batch < maxBatches && more; batch++) {
      more = processBatch.getAsBoolean();
    }
  }
}
