/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CdeReleaseVersionTypeTest {
  @Test
  void derivesReleaseTypeFromCanonicalBusinessVersion() {
    assertEquals(CdeReleaseVersionType.MAIN, CdeReleaseVersionType.fromBusinessVersion("2.0"));
    assertEquals(CdeReleaseVersionType.SECONDARY, CdeReleaseVersionType.fromBusinessVersion("2.1"));
  }

  @Test
  void rejectsClientOwnedReleaseType() {
    assertThrows(
        BadRequestException.class,
        () ->
            CdeReleaseVersionType.rejectClientValue(
                Map.of(CdeReleaseVersionType.PROPERTY, CdeReleaseVersionType.MAIN)));
  }

  @Test
  void overwritesLegacyOrDriftedStoredValue() {
    Object normalized =
        CdeReleaseVersionType.apply(
            Map.of(
                "extension",
                Map.of(CdeReleaseVersionType.PROPERTY, CdeReleaseVersionType.SECONDARY)),
            "3.0");

    assertEquals(
        List.of(CdeReleaseVersionType.MAIN),
        ((Map<?, ?>) ((Map<?, ?>) normalized).get("extension"))
            .get(CdeReleaseVersionType.PROPERTY));
  }
}
