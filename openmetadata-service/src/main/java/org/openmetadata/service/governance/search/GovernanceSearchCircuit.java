/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/**
 * Remembers that the search engine was just unreachable so callers fail fast instead of waiting on
 * it again. After {@code retryAfterMillis} one call is let through to probe; a success closes it.
 */
public final class GovernanceSearchCircuit {
  private static final long CLOSED = 0;

  private final long retryAfterMillis;
  private final LongSupplier clock;
  private final AtomicLong openedAt = new AtomicLong(CLOSED);

  public GovernanceSearchCircuit(final long retryAfterMillis, final LongSupplier clock) {
    this.retryAfterMillis = retryAfterMillis;
    this.clock = clock;
  }

  public boolean allowsRequests() {
    final long opened = openedAt.get();
    return opened == CLOSED || clock.getAsLong() - opened >= retryAfterMillis;
  }

  public void record(final boolean reachable) {
    openedAt.set(reachable ? CLOSED : Math.max(1, clock.getAsLong()));
  }
}
