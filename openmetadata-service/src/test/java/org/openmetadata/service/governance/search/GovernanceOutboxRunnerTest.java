/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class GovernanceOutboxRunnerTest {
  private static final long WAIT_SECONDS = 10;

  private final GovernanceOutboxRunner runner = new GovernanceOutboxRunner("outbox-runner-test");
  private final CountDownLatch holding = new CountDownLatch(1);
  private final CountDownLatch release = new CountDownLatch(1);
  private CompletableFuture<Void> holder;

  @AfterEach
  void releaseHolder() throws Exception {
    release.countDown();
    if (holder != null) {
      holder.get(WAIT_SECONDS, TimeUnit.SECONDS);
    }
  }

  @Test
  void aReadSkipsTheDrainWhileAnotherThreadHoldsTheLock() throws Exception {
    holdLockOnAnotherThread();
    final AtomicInteger batches = new AtomicInteger();

    runner.process(1, counting(batches), exception -> {});

    assertEquals(0, batches.get());
  }

  @Test
  void aWriteWaitsForTheLockAndThenProcessesItsEntries() throws Exception {
    holdLockOnAnotherThread();
    final AtomicInteger batches = new AtomicInteger();
    final CompletableFuture<Void> write =
        CompletableFuture.runAsync(
            () -> runner.processAfterWrite(1, counting(batches), exception -> {}));

    release.countDown();
    write.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals(1, batches.get());
  }

  @Test
  void nothingIsProcessedWhileTheIndexIsBeingRebuilt() {
    final AtomicInteger batches = new AtomicInteger();
    runner.markRebuilding(true);
    try {
      runner.process(1, counting(batches), exception -> {});
      runner.processAfterWrite(1, counting(batches), exception -> {});
    } finally {
      runner.markRebuilding(false);
    }

    assertEquals(0, batches.get());
  }

  @Test
  void drainingStopsWhenABatchReportsNoMoreWork() {
    final AtomicInteger batches = new AtomicInteger();

    runner.process(10, () -> batches.incrementAndGet() < 3, exception -> {});

    assertEquals(3, batches.get());
  }

  private void holdLockOnAnotherThread() throws InterruptedException {
    holder =
        CompletableFuture.runAsync(
            () -> runner.process(1, this::blockUntilReleased, exception -> {}));
    assertTrue(holding.await(WAIT_SECONDS, TimeUnit.SECONDS));
  }

  private boolean blockUntilReleased() {
    holding.countDown();
    try {
      release.await(WAIT_SECONDS, TimeUnit.SECONDS);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
    return false;
  }

  private static BooleanSupplier counting(final AtomicInteger batches) {
    return () -> {
      batches.incrementAndGet();
      return false;
    };
  }
}
