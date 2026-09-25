/* Copyright 2026 Collate. Licensed under the Apache License, Version 2.0. */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ClientErrorException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.CdeImportService.PlannedRow;

class CdeImportServiceTest {
  @Test
  void templateHasTheContractHeaders() throws Exception {
    CdeImportService service = new CdeImportService();
    try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(service.template()))) {
      assertEquals("Import CDE", workbook.getSheetAt(0).getSheetName());
      assertEquals(13, workbook.getSheetAt(0).getRow(0).getLastCellNum());
      assertEquals("Mã CDE", workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
      assertEquals("Ngày hết hiệu lực", workbook.getSheetAt(0).getRow(0).getCell(12).getStringCellValue());
    }
  }

  @Test
  void duplicateNormalizedNamesBlockCommitWithoutMutation() throws Exception {
    CdeImportService service = new CdeImportService();
    byte[] workbook = workbook("CUSTOMER_ID", " customer_id ");
    CdeImportService.Preview preview = service.preview(
        new ByteArrayInputStream(workbook), workbook.length, "maker", UUID.randomUUID(), "2",
        CdeImportService.ExistingCodePolicy.OVERWRITE_EXISTING,
        row -> valid(row.rowNumber(), row.value(0)));
    assertFalse(preview.canCommit());
    assertEquals(1, preview.summary().get("error"));
    assertThrows(
        ClientErrorException.class,
        () -> service.commit(preview.importSessionId(), "maker", ignored -> "mutated"));
  }

  @Test
  void sessionsAreActorBoundAndSingleUse() throws Exception {
    CdeImportService service = new CdeImportService();
    byte[] workbook = workbook("CUSTOMER_ID");
    CdeImportService.Preview preview = service.preview(
        new ByteArrayInputStream(workbook), workbook.length, "maker", UUID.randomUUID(), "2",
        CdeImportService.ExistingCodePolicy.OVERWRITE_EXISTING,
        row -> valid(row.rowNumber(), row.value(0)));
    assertTrue(preview.canCommit());
    assertThrows(
        ClientErrorException.class,
        () -> service.commit(preview.importSessionId(), "other", ignored -> "bad"));
    assertEquals("committed", service.commit(preview.importSessionId(), "maker", ignored -> "committed"));
    assertThrows(
        ClientErrorException.class,
        () -> service.commit(preview.importSessionId(), "maker", ignored -> "again"));
  }

  @Test
  void formulasAreRejectedDuringPreview() throws Exception {
    CdeImportService service = new CdeImportService();
    byte[] workbook = workbook("=HYPERLINK(\"https://example.test\")");
    assertThrows(
        RuntimeException.class,
        () -> service.preview(
            new ByteArrayInputStream(workbook), workbook.length, "maker", UUID.randomUUID(), "2",
            CdeImportService.ExistingCodePolicy.OVERWRITE_EXISTING,
            row -> valid(row.rowNumber(), row.value(0))));
  }

  private static PlannedRow valid(int row, String name) {
    return new PlannedRow(row, name, "CREATE", UUID.randomUUID(), "2.0", null, null, Map.of(), List.of(), List.of());
  }

  private static byte[] workbook(String... names) throws Exception {
    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Import CDE");
      var header = sheet.createRow(0);
      for (int index = 0; index < CdeImportService.HEADERS.size(); index++) {
        header.createCell(index).setCellValue(CdeImportService.HEADERS.get(index));
      }
      for (int row = 0; row < names.length; row++) {
        sheet.createRow(row + 1).createCell(0).setCellValue(names[row]);
      }
      workbook.write(output);
      return output.toByteArray();
    }
  }
}
