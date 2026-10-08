/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.glossary.search.GovernedGlossaryIndexRebuilder;
import org.openmetadata.service.glossary.search.GovernedGlossaryOutbox;

/** Initializes governed glossary list search without making application startup depend on it. */
@Slf4j
public final class GovernedGlossarySearchBootstrap {
  private GovernedGlossarySearchBootstrap() {}

  public static void initialize() {
    try {
      GovernedGlossaryIndexRebuilder.ensureIndex();
      GovernedGlossaryOutbox.drainPending();
    } catch (RuntimeException exception) {
      LOG.error("Governed glossary search index could not be initialized", exception);
    }
    GovernedGlossaryOutbox.startWorker();
  }
}
