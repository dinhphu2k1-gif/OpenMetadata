/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class GovernedGlossarySearchSettingsTest {
  @AfterEach
  void clearProperty() {
    System.clearProperty(GovernedGlossarySearchSettings.PROPERTY_KEY);
  }

  @Test
  void listReadsStayOnTheDatabaseUnlessEnabled() {
    assumeTrue(System.getenv(GovernedGlossarySearchSettings.ENVIRONMENT_KEY) == null);

    assertFalse(GovernedGlossarySearchSettings.readFromIndex());
  }

  @Test
  void listReadsUseTheIndexWhenEnabled() {
    System.setProperty(GovernedGlossarySearchSettings.PROPERTY_KEY, "true");

    assertTrue(GovernedGlossarySearchSettings.readFromIndex());
  }
}
