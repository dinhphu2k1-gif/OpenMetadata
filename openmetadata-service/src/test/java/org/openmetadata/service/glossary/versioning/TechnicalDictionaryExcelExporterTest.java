/* Copyright 2026 Collate. Licensed under the Apache License, Version 2.0. */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class TechnicalDictionaryExcelExporterTest {
  @Test
  void neutralizesSpreadsheetFormulaPrefixes() {
    assertEquals("'=SUM(A1:A2)", TechnicalDictionaryExcelExporter.safeText("=SUM(A1:A2)"));
    assertEquals("'+cmd", TechnicalDictionaryExcelExporter.safeText("+cmd"));
    assertEquals("plain", TechnicalDictionaryExcelExporter.safeText("plain"));
  }
}
