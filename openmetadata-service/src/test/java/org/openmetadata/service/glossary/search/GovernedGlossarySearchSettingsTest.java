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
  void listReadsUseTheIndexUnlessDisabled() {
    assumeTrue(System.getenv(GovernedGlossarySearchSettings.ENVIRONMENT_KEY) == null);

    assertTrue(GovernedGlossarySearchSettings.readFromIndex());
  }

  @Test
  void listReadsStayOnTheDatabaseWhenDisabled() {
    System.setProperty(GovernedGlossarySearchSettings.PROPERTY_KEY, "false");

    assertFalse(GovernedGlossarySearchSettings.readFromIndex());
  }
}
