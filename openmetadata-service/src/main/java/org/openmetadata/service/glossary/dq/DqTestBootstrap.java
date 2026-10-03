/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/** Startup of Data Quality Rule test execution: keeps the application configuration, starts the outbox worker. */
@Slf4j
public final class DqTestBootstrap {
  private static final AtomicReference<OpenMetadataApplicationConfig> CONFIG =
      new AtomicReference<>();

  private DqTestBootstrap() {}

  public static void initialize(OpenMetadataApplicationConfig config) {
    CONFIG.set(config);
    DqTestOutbox.startWorker();
    LOG.info(
        "Data Quality Rule test execution is {}",
        DqTestExecutionSettings.isEnabled() ? "enabled" : "disabled");
  }

  public static OpenMetadataApplicationConfig config() {
    final OpenMetadataApplicationConfig config = CONFIG.get();
    if (config == null) {
      throw new IllegalStateException("Data Quality Rule test execution is not initialized");
    }
    return config;
  }
}
