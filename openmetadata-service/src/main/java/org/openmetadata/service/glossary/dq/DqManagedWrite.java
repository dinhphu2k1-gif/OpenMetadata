/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.function.Supplier;

/**
 * Marks the current thread as writing testcases and definitions on behalf of a Data Quality Rule.
 * Writes of managed testcases from any other path are refused (see {@link DqManagedGuard}).
 */
public final class DqManagedWrite {
  public static final String ACTOR = "dq-governance-bot";
  private static final ThreadLocal<Boolean> ACTIVE = ThreadLocal.withInitial(() -> Boolean.FALSE);

  private DqManagedWrite() {}

  public static boolean isActive() {
    return Boolean.TRUE.equals(ACTIVE.get());
  }

  public static <T> T run(Supplier<T> action) {
    final boolean previous = isActive();
    ACTIVE.set(Boolean.TRUE);
    try {
      return action.get();
    } finally {
      ACTIVE.set(previous);
    }
  }

  public static void run(Runnable action) {
    run(
        () -> {
          action.run();
          return null;
        });
  }
}
