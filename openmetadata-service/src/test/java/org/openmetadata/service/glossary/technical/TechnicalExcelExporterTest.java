/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter.ExportedWorkbook;

class TechnicalExcelExporterTest {

  private static Map<String, Object> row(String description) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("businessVersion", "2.1");
    row.put("entityStatus", "In Review");
    row.put("description", description);
    row.put(
        "extension",
        Map.of(
            TechnicalDictionaryProfile.SOURCE_DATABASE, "core",
            TechnicalDictionaryProfile.SOURCE_SCHEMA, "dbo",
            TechnicalDictionaryProfile.SOURCE_TABLE, "CUSTOMER",
            TechnicalDictionaryProfile.SOURCE_COLUMN, "NAME",
            TechnicalDictionaryProfile.SOURCE_SERVICE, "ipcas",
            TechnicalDictionaryProfile.SURVIVORSHIP_RANK, 1));
    row.put(TechnicalRowFields.CDE_CODE, "CDE1");
    row.put(TechnicalRowFields.CDE_NAME, "Tên khách hàng");
    row.put(
        TechnicalRowFields.DATA_OWNERS, List.of(Map.of("name", "khcl", "displayName", "Ban KHCL")));
    row.put("tags", List.of(Map.of("tagFQN", "DataTimeliness.T1", "displayName", "T+1")));
    return row;
  }

  @Test
  void valuesFollowTheNineteenColumnLayout() {
    List<String> values = TechnicalExcelExporter.values(row("Mô tả"));

    assertEquals(TechnicalExcelExporter.HEADERS.size(), values.size());
    assertEquals("core", values.get(0));
    assertEquals("Ban KHCL", values.get(4));
    assertEquals("CDE1", values.get(6));
    assertEquals("1", values.get(8));
    assertEquals("T+1", values.get(13));
    assertEquals("2.1", values.get(16));
    assertEquals("Bản phụ", values.get(17));
    assertEquals("Đang xem xét", values.get(18));
  }

  @Test
  void writesReadableWorkbookAndNeutralizesFormulas() throws IOException {
    ExportedWorkbook exported =
        TechnicalExcelExporter.write(List.of(row("=HYPERLINK(\"http://x\")"), row("ok")), "2");
    try (InputStream input = Files.newInputStream(exported.path());
        Workbook workbook = new XSSFWorkbook(input)) {
      Sheet sheet = workbook.getSheetAt(0);
      assertEquals("Technical Dictionary v2", sheet.getSheetName());
      assertEquals(2, exported.rowCount());
      List<String> headers = new ArrayList<>();
      sheet.getRow(0).forEach(cell -> headers.add(cell.getStringCellValue()));
      assertEquals(TechnicalExcelExporter.HEADERS, headers);
      Row first = sheet.getRow(1);
      assertEquals("'=HYPERLINK(\"http://x\")", first.getCell(15).getStringCellValue());
      assertFalse(sheet.getRow(2).getCell(15).getStringCellValue().startsWith("'"));
    } finally {
      Files.deleteIfExists(exported.path());
    }
  }
}
