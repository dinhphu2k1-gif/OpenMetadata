/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;

class TechnicalImportPatchTest {
  private static final UUID CDE = UUID.randomUUID();
  private static final UUID TEAM = UUID.randomUUID();

  private static TechnicalRecordValues current() {
    return new TechnicalRecordValues(
        CDE, 5, "DataElementType.AtomicDataElement", null, null, "DataTimeliness.T0", null);
  }

  private static TechnicalCdeInfo cde(UUID id) {
    return new TechnicalCdeInfo(
        id.toString(), "CDE2", "Tên", "1.0", "Data Dictionary.CDE2@v1", List.of());
  }

  @Test
  void setsAndClearsOnlySpecifiedFields() {
    UUID other = UUID.randomUUID();
    TechnicalRecordValues merged =
        TechnicalImportPatch.merge(
            current(),
            new RowPatch(
                Field.of(cde(other)),
                Field.of(1),
                Map.of(
                    TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION,
                    Field.of("DataTimeliness.T1")),
                Field.of(TEAM)));

    assertEquals(other, merged.cde());
    assertEquals(1, merged.rank());
    assertEquals("DataTimeliness.T1", merged.timeliness());
    assertEquals("DataElementType.AtomicDataElement", merged.elementType());
    assertEquals(TEAM, merged.systemOwnerId());
  }

  @Test
  void emptyValuesClearTheStoredOnes() {
    TechnicalRecordValues merged =
        TechnicalImportPatch.merge(
            current(),
            new RowPatch(
                Field.of(null),
                Field.of(null),
                Map.of(TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION, Field.of(null)),
                Field.of(null)));

    assertNull(merged.cde());
    assertNull(merged.rank());
    assertNull(merged.elementType());
    assertEquals("DataTimeliness.T0", merged.timeliness());
  }

  @Test
  void absentFieldsKeepTheCurrentValues() {
    TechnicalRecordValues merged =
        TechnicalImportPatch.merge(
            current(), new RowPatch(Field.absent(), Field.absent(), Map.of(), Field.absent()));

    assertEquals(current(), merged);
  }
}
