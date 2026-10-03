/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Server-side feature flag of Data Quality Rule test execution, set by the environment variable
 * {@code DQ_RULE_TEST_EXECUTION_ENABLED} and off by default. While off, no test declaration is
 * accepted, nothing is reconciled and the outbox is not processed.
 */
public final class DqTestExecutionSettings {
  public static final String ENVIRONMENT_VARIABLE = "DQ_RULE_TEST_EXECUTION_ENABLED";

  private static final AtomicReference<Boolean> OVERRIDE = new AtomicReference<>();

  private DqTestExecutionSettings() {}

  public static boolean isEnabled() {
    final Boolean override = OVERRIDE.get();
    return override != null ? override : Boolean.parseBoolean(System.getenv(ENVIRONMENT_VARIABLE));
  }

  public static void requireEnabled() {
    if (!isEnabled()) {
      throw DqTestErrors.forbidden(
          DqTestErrors.FEATURE_DISABLED, "Data Quality Rule test execution is not enabled");
    }
  }

  /** For tests: forces the flag; pass null to read the environment again. */
  public static void overrideForTests(Boolean enabled) {
    OVERRIDE.set(enabled);
  }
}
