/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.io.ByteArrayInputStream;
import java.util.List;
import org.junit.jupiter.api.Test;

class TechnicalImportSheetTest {

  @Test
  void readsRowsByHeaderRegardlessOfColumnOrderAndSkipsBlankRows() {
    byte[] file =
        TechnicalImportTestSupport.workbook(
            List.of("Mã CDE quy chiếu", "Tên cột", "Cột lạ"),
            List.of(List.of("CDE1", "NAME", "x"), List.of("", "", ""), List.of("", "ID", "")));

    TechnicalImportSheet sheet = TechnicalImportSheet.parse(file);

    assertEquals(List.of("Mã CDE quy chiếu", "Tên cột", "Cột lạ"), sheet.headers());
    assertEquals(2, sheet.rows().size());
    assertEquals(2, sheet.rows().get(0).rowNumber());
    assertEquals("NAME", sheet.rows().get(0).value("Tên cột"));
    assertEquals(4, sheet.rows().get(1).rowNumber());
    assertTrue(sheet.rows().get(1).has("Mã CDE quy chiếu"));
    assertEquals("", sheet.rows().get(1).value("Mã CDE quy chiếu"));
    assertFalse(sheet.rows().get(1).has("Không có"));
  }

  @Test
  void rejectsFormulaLikeCells() {
    byte[] file =
        TechnicalImportTestSupport.workbook(
            List.of("Tên cột"), List.of(List.of("=HYPERLINK(\"http://x\")")));
    assertThrows(BadRequestException.class, () -> TechnicalImportSheet.parse(file));
  }

  @Test
  void rejectsFilesThatAreNotWorkbooks() {
    assertThrows(BadRequestException.class, () -> TechnicalImportSheet.parse(new byte[] {1, 2, 3}));
  }

  @Test
  void rejectsOversizedUploadsBeforeParsing() {
    assertThrows(
        jakarta.ws.rs.ClientErrorException.class,
        () ->
            TechnicalImportSheet.readBytes(
                new ByteArrayInputStream(new byte[0]), TechnicalImportSheet.MAX_FILE_BYTES + 1));
    assertThrows(BadRequestException.class, () -> TechnicalImportSheet.readBytes(null, 0));
  }
}
