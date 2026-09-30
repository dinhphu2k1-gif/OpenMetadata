/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;

class GovernedGlossaryProfileRegistryTest {
  @Test
  void resolvesOnlyAllowlistedProfiles() {
    assertEquals(
        GovernedGlossaryProfileRegistry.Profile.DATA_DICTIONARY,
        GovernedGlossaryProfileRegistry.require(new Glossary().withName("Data Dictionary")));
    assertEquals(
        GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY,
        GovernedGlossaryProfileRegistry.require(new Glossary().withName("Data Quality")));
    assertEquals(
        GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY,
        GovernedGlossaryProfileRegistry.require(new Glossary().withName("Technical Dictionary")));
    assertEquals(
        GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY,
        GovernedGlossaryProfileRegistry.requireName("Data Quality"));
    assertFalse(
        GovernedGlossaryProfileRegistry.find(new Glossary().withName("Native Glossary"))
            .isPresent());
  }

  @Test
  void rejectsUnknownGlossary() {
    assertThrows(
        BadRequestException.class,
        () -> GovernedGlossaryProfileRegistry.require(new Glossary().withName("Other")));
  }
}
