/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;

class DqOutcomeTest {
  private static TestCaseResult result(TestCaseStatus status) {
    return new TestCaseResult().withTestCaseStatus(status);
  }

  private static DqThreshold threshold(String text) {
    return DqThreshold.parse(text).orElseThrow();
  }

  @Test
  void noResultWhenNothingWasRun() {
    assertEquals(DqOutcome.NO_RESULT, DqOutcome.evaluate(null, null));
    assertEquals(DqOutcome.NO_RESULT, DqOutcome.evaluate(null, result(TestCaseStatus.Queued)));
  }

  @Test
  void abortedIsAnExecutionError() {
    assertEquals(
        DqOutcome.ABORTED, DqOutcome.evaluate(threshold(">= 90%"), result(TestCaseStatus.Aborted)));
  }

  @Test
  void withoutThresholdTheNativeStatusDecides() {
    assertEquals(DqOutcome.PASSED, DqOutcome.evaluate(null, result(TestCaseStatus.Success)));
    assertEquals(DqOutcome.FAILED, DqOutcome.evaluate(null, result(TestCaseStatus.Failed)));
  }

  @Test
  void percentageThresholdOverridesNativeFailure() {
    final TestCaseResult failedButClose =
        result(TestCaseStatus.Failed).withPassedRowsPercentage(99.8).withFailedRows(120L);
    assertEquals(DqOutcome.PASSED, DqOutcome.evaluate(threshold(">= 99.5%"), failedButClose));
    assertEquals(DqOutcome.FAILED, DqOutcome.evaluate(threshold(">= 99.9%"), failedButClose));
  }

  @Test
  void percentageThresholdFallsBackToNativeStatusWithoutPercentage() {
    assertEquals(
        DqOutcome.PASSED,
        DqOutcome.evaluate(threshold(">= 99.5%"), result(TestCaseStatus.Success)));
    assertEquals(
        DqOutcome.FAILED, DqOutcome.evaluate(threshold(">= 99.5%"), result(TestCaseStatus.Failed)));
  }

  @Test
  void countThresholdUsesFailedRows() {
    final TestCaseResult three = result(TestCaseStatus.Failed).withFailedRows(3L);
    assertEquals(DqOutcome.PASSED, DqOutcome.evaluate(threshold("count <= 3"), three));
    assertEquals(DqOutcome.FAILED, DqOutcome.evaluate(threshold("count = 0"), three));
  }

  @Test
  void countThresholdFallsBackToFirstNumericResultValue() {
    final TestCaseResult withValue =
        result(TestCaseStatus.Failed)
            .withTestResultValue(
                List.of(new TestResultValue().withName("Row Count").withValue("2")));
    assertEquals(DqOutcome.PASSED, DqOutcome.evaluate(threshold("count <= 2"), withValue));
    assertEquals(DqOutcome.FAILED, DqOutcome.evaluate(threshold("count = 0"), withValue));
  }

  @Test
  void aggregatePrioritisesFailedThenAbortedThenNoResult() {
    assertEquals(
        DqOutcome.PASSED, DqOutcome.aggregate(List.of(DqOutcome.PASSED, DqOutcome.PASSED)));
    assertEquals(
        DqOutcome.NO_RESULT, DqOutcome.aggregate(List.of(DqOutcome.PASSED, DqOutcome.NO_RESULT)));
    assertEquals(
        DqOutcome.ABORTED,
        DqOutcome.aggregate(List.of(DqOutcome.PASSED, DqOutcome.NO_RESULT, DqOutcome.ABORTED)));
    assertEquals(
        DqOutcome.FAILED,
        DqOutcome.aggregate(List.of(DqOutcome.ABORTED, DqOutcome.FAILED, DqOutcome.PASSED)));
  }

  @Test
  void aggregateOfNothingIsNoResult() {
    assertEquals(DqOutcome.NO_RESULT, DqOutcome.aggregate(List.of()));
  }
}
