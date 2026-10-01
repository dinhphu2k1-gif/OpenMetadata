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
    row.put("description", description);
    row.put("database", "core");
    row.put("schema", "dbo");
    row.put("table", "CUSTOMER");
    row.put("column", "NAME");
    row.put("service", "ipcas");
    row.put("dataType", "varchar(10)");
    row.put("rank", 1);
    row.put("cde", Map.of("id", "c1", "code", "CDE1", "name", "Tên khách hàng"));
    row.put("dataOwners", List.of(Map.of("id", "u1", "name", "Ban KHCL")));
    row.put("timeliness", Map.of("fqn", "DataTimeliness.T1", "label", "T+1"));
    row.put("systemOwner", Map.of("id", "t1", "name", "Ban CNTT"));
    return row;
  }

  @Test
  void valuesFollowTheFourteenColumnLayout() {
    List<String> values = TechnicalExcelExporter.values(row("Mô tả"));

    assertEquals(14, TechnicalExcelExporter.HEADERS.size());
    assertEquals(TechnicalExcelExporter.HEADERS.size(), values.size());
    assertEquals("core", values.get(0));
    assertEquals("CDE1", values.get(5));
    assertEquals("Tên khách hàng", values.get(6));
    assertEquals("1", values.get(7));
    assertEquals("T+1", values.get(12));
    assertEquals("Mô tả", values.get(13));
  }

  @Test
  void writesReadableWorkbookAndNeutralizesFormulas() throws IOException {
    ExportedWorkbook exported =
        TechnicalExcelExporter.write(List.of(row("=HYPERLINK(\"http://x\")"), row("ok")), "");
    try (InputStream input = Files.newInputStream(exported.path());
        Workbook workbook = new XSSFWorkbook(input)) {
      Sheet sheet = workbook.getSheetAt(0);
      assertEquals("Technical Dictionary", sheet.getSheetName());
      assertEquals(2, exported.rowCount());
      List<String> headers = new ArrayList<>();
      sheet.getRow(0).forEach(cell -> headers.add(cell.getStringCellValue()));
      assertEquals(TechnicalExcelExporter.HEADERS, headers);
      Row first = sheet.getRow(1);
      assertEquals("'=HYPERLINK(\"http://x\")", first.getCell(13).getStringCellValue());
      assertFalse(sheet.getRow(2).getCell(13).getStringCellValue().startsWith("'"));
    } finally {
      Files.deleteIfExists(exported.path());
    }
  }
}
