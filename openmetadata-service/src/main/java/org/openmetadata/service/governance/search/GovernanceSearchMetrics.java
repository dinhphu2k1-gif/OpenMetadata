/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import java.util.concurrent.atomic.AtomicLong;

/** Operational metrics for one self-managed governance search index. */
public final class GovernanceSearchMetrics {
  public static final GovernanceSearchMetrics GOVERNED =
      new GovernanceSearchMetrics("governed_glossary");
  public static final GovernanceSearchMetrics TECHNICAL =
      new GovernanceSearchMetrics("technical_dictionary");

  private final AtomicLong driftRows = new AtomicLong();
  private final Counter fallbackCount;
  private final AtomicLong indexAvailable = new AtomicLong();
  private final AtomicLong oldestPendingAgeSeconds = new AtomicLong();
  private final AtomicLong pendingEvents = new AtomicLong();
  private final Counter retryCount;

  private GovernanceSearchMetrics(final String index) {
    final String tag = "index";
    Gauge.builder("om_governance_search_outbox_pending", pendingEvents, AtomicLong::get)
        .tag(tag, index)
        .register(Metrics.globalRegistry);
    Gauge.builder(
            "om_governance_search_outbox_oldest_age_seconds",
            oldestPendingAgeSeconds,
            AtomicLong::get)
        .tag(tag, index)
        .register(Metrics.globalRegistry);
    Gauge.builder("om_governance_search_drift_rows", driftRows, AtomicLong::get)
        .tag(tag, index)
        .register(Metrics.globalRegistry);
    Gauge.builder("om_governance_search_index_available", indexAvailable, AtomicLong::get)
        .tag(tag, index)
        .register(Metrics.globalRegistry);
    retryCount =
        Counter.builder("om_governance_search_outbox_retries_total")
            .tag(tag, index)
            .register(Metrics.globalRegistry);
    fallbackCount =
        Counter.builder("om_governance_search_database_fallback_total")
            .tag(tag, index)
            .register(Metrics.globalRegistry);
  }

  public void updateOutbox(final long pending, final long oldestAt) {
    pendingEvents.set(pending);
    final long age = oldestAt == 0 ? 0 : Math.max(0, System.currentTimeMillis() - oldestAt) / 1_000;
    oldestPendingAgeSeconds.set(age);
  }

  public void recordRetry() {
    retryCount.increment();
  }

  public void recordFallback() {
    fallbackCount.increment();
  }

  public void setAvailable(final boolean available) {
    indexAvailable.set(available ? 1 : 0);
  }

  public void setDriftRows(final long rows) {
    driftRows.set(rows);
  }
}
