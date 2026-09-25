/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter.ExportedWorkbook;

class CdeExcelExporterTest {
  @Test
  void writesPresentationColumnsAndNeutralizesFormulaInjection() throws Exception {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("termId", "00000000-0000-0000-0000-000000000001");
    row.put("recordType", "published");
    row.put("name", "=SUM(1,1)");
    row.put("displayName", "Tên tiếng Việt");
    row.put("description", "<p>Dòng một</p><p>Dòng hai</p>");
    row.put("businessVersion", "2.1");
    row.put("entityStatus", "Approved");
    row.put("domains", List.of(Map.of("name", "Retail", "displayName", "Bán lẻ")));
    row.put("owners", List.of(Map.of("name", "owner", "displayName", "Chủ sở hữu")));
    row.put(
        "tags",
        List.of(
            Map.of("tagFQN", "DataSource.Core", "name", "Core", "displayName", "Core Banking"),
            Map.of(
                "tagFQN",
                "DataClassification.Internal",
                "name",
                "Internal",
                "displayName",
                "Nội bộ")));
    row.put(
        "extension",
        Map.of(
            "dataQualityRules", true,
            "effectiveDate", "2026-09-25",
            "expirationDate", "2027-09-25"));

    ExportedWorkbook exported = CdeExcelExporter.write(List.of(row), "2");
    try (XSSFWorkbook workbook = new XSSFWorkbook(Files.newInputStream(exported.path()))) {
      assertEquals(1, exported.rowCount());
      assertEquals(15, workbook.getSheetAt(0).getRow(0).getLastCellNum());
      assertEquals("Mã CDE", workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
      assertEquals("'=SUM(1,1)", workbook.getSheetAt(0).getRow(1).getCell(0).getStringCellValue());
      assertEquals("Bán lẻ", workbook.getSheetAt(0).getRow(1).getCell(1).getStringCellValue());
      assertEquals(
          "Dòng một\nDòng hai",
          workbook.getSheetAt(0).getRow(1).getCell(4).getStringCellValue());
      assertEquals("Có", workbook.getSheetAt(0).getRow(1).getCell(10).getStringCellValue());
      assertEquals(
          "25/09/2026", workbook.getSheetAt(0).getRow(1).getCell(13).getStringCellValue());
      assertFalse(workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue().contains("termId"));
    } finally {
      Files.deleteIfExists(exported.path());
    }
  }

  @Test
  void safeTextProtectsEverySpreadsheetFormulaPrefix() {
    for (String value : List.of("=x", "+x", "-x", "@x", "\tx", "\rx", "\nx")) {
      assertTrue(CdeExcelExporter.safeText(value).startsWith("'"));
    }
    assertEquals("text", CdeExcelExporter.safeText("text"));
  }
}
