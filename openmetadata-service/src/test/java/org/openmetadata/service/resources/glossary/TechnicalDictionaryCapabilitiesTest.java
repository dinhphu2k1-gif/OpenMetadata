/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.glossary.TechnicalDictionaryAccess.Capabilities;

class TechnicalDictionaryCapabilitiesTest {
  @Test
  void anEditorSeesDrafts() {
    assertTrue(new Capabilities(true, true, false, true, true).canSeeWorkingRecords());
  }

  @Test
  void anApproverSeesDrafts() {
    assertTrue(new Capabilities(true, false, true, false, true).canSeeWorkingRecords());
  }

  @Test
  void aConsumerWhoOnlyViewsDoesNotSeeDrafts() {
    assertFalse(new Capabilities(true, false, false, false, true).canSeeWorkingRecords());
  }
}
