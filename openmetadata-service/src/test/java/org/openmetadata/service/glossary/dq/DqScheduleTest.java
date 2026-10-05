/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.WebApplicationException;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class DqScheduleTest {
  @Test
  void acceptsCronAndNoSchedule() {
    DqSchedule.validate("0 2 * * *", "Asia/Ho_Chi_Minh");
    DqSchedule.validate("0 2 1 1,4,7,10 *", null);
    DqSchedule.validate(null, null);
  }

  @Test
  void rejectsBadCronAndBadZone() {
    assertThrows(WebApplicationException.class, () -> DqSchedule.validate("not a cron", null));
    assertThrows(WebApplicationException.class, () -> DqSchedule.validate("   ", null));
    assertThrows(
        WebApplicationException.class, () -> DqSchedule.validate("0 2 * * *", "Mars/Base"));
  }

  @Test
  void previewsTheNextRuns() {
    assertEquals(
        DqSchedule.PREVIEW_RUNS,
        DqSchedule.nextRuns("0 2 * * *", null, DqSchedule.PREVIEW_RUNS).size());
    assertTrue(DqSchedule.nextRuns(null, null, 5).isEmpty());
  }

  @Test
  void intervalIsTheGapBetweenRuns() {
    assertEquals(
        Duration.ofDays(1), DqSchedule.interval("0 2 * * *", "Asia/Ho_Chi_Minh").orElseThrow());
    assertTrue(DqSchedule.interval(null, null).isEmpty());
  }
}
