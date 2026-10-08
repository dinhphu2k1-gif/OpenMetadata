/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class GovernanceSearchCircuitTest {
  private static final long RETRY_AFTER = 15_000;

  private final AtomicLong now = new AtomicLong(1_000_000);
  private final GovernanceSearchCircuit circuit =
      new GovernanceSearchCircuit(RETRY_AFTER, now::get);

  @Test
  void allowsRequestsUntilTheEngineFails() {
    assertTrue(circuit.allowsRequests());
    circuit.record(false);
    assertFalse(circuit.allowsRequests());
  }

  @Test
  void letsOneProbeThroughAfterTheRetryWindow() {
    circuit.record(false);
    now.addAndGet(RETRY_AFTER - 1);
    assertFalse(circuit.allowsRequests());
    now.incrementAndGet();
    assertTrue(circuit.allowsRequests());
  }

  @Test
  void aFailedProbeRestartsTheWindowAndASuccessClosesIt() {
    circuit.record(false);
    now.addAndGet(RETRY_AFTER);
    circuit.record(false);
    assertFalse(circuit.allowsRequests());
    circuit.record(true);
    assertTrue(circuit.allowsRequests());
  }
}
