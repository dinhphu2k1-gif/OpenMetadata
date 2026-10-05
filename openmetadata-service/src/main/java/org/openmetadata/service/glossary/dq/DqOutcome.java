/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestResultValue;

/**
 * Result of a testcase measured against a threshold, and the aggregation of testcase results into
 * the result of a declaration or a Rule.
 */
public enum DqOutcome {
  PASSED,
  FAILED,
  ABORTED,
  NO_RESULT;

  public static final String NOT_DECLARED = "NOT_DECLARED";

  /** The outcome of one native result under a threshold; a null threshold uses the native status. */
  public static DqOutcome evaluate(DqThreshold threshold, TestCaseResult result) {
    DqOutcome outcome = NO_RESULT;
    if (result != null && result.getTestCaseStatus() != null) {
      outcome =
          switch (result.getTestCaseStatus()) {
            case Aborted -> ABORTED;
            case Queued -> NO_RESULT;
            default -> evaluateFinished(threshold, result);
          };
    }
    return outcome;
  }

  /** Overall status of a set of testcase outcomes: Failed, Aborted, no result, then Passed. */
  public static DqOutcome aggregate(Collection<DqOutcome> outcomes) {
    DqOutcome aggregate = PASSED;
    if (outcomes.isEmpty() || outcomes.contains(NO_RESULT)) {
      aggregate = NO_RESULT;
    }
    if (outcomes.contains(ABORTED)) {
      aggregate = ABORTED;
    }
    if (outcomes.contains(FAILED)) {
      aggregate = FAILED;
    }
    return aggregate;
  }

  private static DqOutcome evaluateFinished(DqThreshold threshold, TestCaseResult result) {
    final boolean nativePassed = result.getTestCaseStatus() == TestCaseStatus.Success;
    DqOutcome outcome = nativePassed ? PASSED : FAILED;
    if (threshold != null) {
      final Optional<BigDecimal> measured = measuredValue(threshold, result);
      if (measured.isPresent()) {
        outcome = threshold.isSatisfiedBy(measured.get()) ? PASSED : FAILED;
      }
    }
    return outcome;
  }

  private static Optional<BigDecimal> measuredValue(DqThreshold threshold, TestCaseResult result) {
    return threshold.isPercentage()
        ? Optional.ofNullable(result.getPassedRowsPercentage()).map(BigDecimal::valueOf)
        : violations(result);
  }

  /** Number of violating records: the failed rows, else the first numeric result value. */
  static Optional<BigDecimal> violations(TestCaseResult result) {
    Optional<BigDecimal> violations =
        Optional.ofNullable(result.getFailedRows()).map(BigDecimal::valueOf);
    final List<TestResultValue> values = result.getTestResultValue();
    if (violations.isEmpty() && values != null && !values.isEmpty()) {
      violations = parse(values.getFirst().getValue());
    }
    return violations;
  }

  private static Optional<BigDecimal> parse(String text) {
    Optional<BigDecimal> value = Optional.empty();
    try {
      value = text == null ? Optional.empty() : Optional.of(new BigDecimal(text.trim()));
    } catch (NumberFormatException ignored) {
      value = Optional.empty();
    }
    return value;
  }
}
