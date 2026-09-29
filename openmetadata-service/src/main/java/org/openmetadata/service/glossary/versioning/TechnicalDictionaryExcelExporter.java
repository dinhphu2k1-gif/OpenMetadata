/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.openmetadata.service.glossary.TechnicalDictionaryService.RecordView;

/** Bounded-memory, formula-safe XLSX exporter for authorized Technical Dictionary rows. */
public final class TechnicalDictionaryExcelExporter {
  public static final String XLSX_MEDIA_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  private static final String[] HEADERS = {
    "Tên đầy đủ cột", "Khả dụng", "Phiên bản", "Trạng thái", "Mã CDE", "Tên CDE",
    "Thứ hạng", "Loại thành tố", "Loại trường dữ liệu", "Phương thức tạo", "Thời gian",
    "Chủ sở hữu hệ thống", "Mô tả"
  };

  private TechnicalDictionaryExcelExporter() {}

  public static ExportedWorkbook write(List<RecordView> rows, String scopeVersion)
      throws IOException {
    Path directory = Path.of(System.getProperty("java.io.tmpdir"), "openmetadata", "td-exports");
    Files.createDirectories(directory);
    Path file = Files.createTempFile(directory, "technical-dictionary-v" + scopeVersion + "-", ".xlsx");
    boolean complete = false;
    try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
      workbook.setCompressTempFiles(true);
      Sheet sheet = workbook.createSheet("Technical Dictionary v" + scopeVersion);
      CellStyle headerStyle = workbook.createCellStyle();
      Font font = workbook.createFont();
      font.setBold(true);
      headerStyle.setFont(font);
      Row header = sheet.createRow(0);
      for (int index = 0; index < HEADERS.length; index++) {
        header.createCell(index).setCellValue(HEADERS[index]);
        header.getCell(index).setCellStyle(headerStyle);
        sheet.setColumnWidth(index, 24 * 256);
      }
      sheet.createFreezePane(0, 1);
      int rowIndex = 1;
      for (RecordView source : rows) {
        Map<String, Object> extension = extension(source.payload());
        List<String> values =
            List.of(
                source.columnFqn(), String.valueOf(source.sourceAvailable()), source.businessVersion(),
                source.status(), text(extension.get("cdeCode")), text(extension.get("cdeName")),
                text(extension.get("survivorshipRank")), text(extension.get("elementType")),
                text(extension.get("generationType")), text(extension.get("creationMethod")),
                text(extension.get("timeliness")), text(extension.get("systemOwner")),
                text(source.payload().get("description")));
        Row row = sheet.createRow(rowIndex++);
        for (int index = 0; index < values.size(); index++) {
          Cell cell = row.createCell(index);
          cell.setCellValue(safeText(values.get(index)));
        }
      }
      try (OutputStream output = Files.newOutputStream(file)) {
        workbook.write(output);
      }
      workbook.dispose();
      try (ZipFile archive = new ZipFile(file.toFile())) {
        if (archive.getEntry("xl/workbook.xml") == null) {
          throw new IOException("Generated Technical Dictionary workbook is invalid");
        }
      }
      complete = true;
      return new ExportedWorkbook(file, rows.size());
    } finally {
      if (!complete) Files.deleteIfExists(file);
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> extension(Map<String, Object> payload) {
    return payload.get("extension") instanceof Map<?, ?> values
        ? (Map<String, Object>) values
        : Map.of();
  }

  static String safeText(String value) {
    if (value == null || value.isEmpty()) return "";
    return "=+-@\t\r\n".indexOf(value.charAt(0)) >= 0 ? "'" + value : value;
  }

  private static String text(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  public record ExportedWorkbook(Path path, int rowCount) {}
}
