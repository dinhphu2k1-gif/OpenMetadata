/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.zip.ZipFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter.ExportedWorkbook;
import org.openmetadata.service.glossary.versioning.CdeReleaseVersionType;

/** Bounded-memory, formula-safe XLSX export of authorized Technical Dictionary rows. */
public final class TechnicalExcelExporter {
  public static final List<String> HEADERS =
      List.of(
          "Tên cơ sở dữ liệu",
          "Tên Schema",
          "Tên Bảng",
          "Tên cột",
          "Chủ sở hữu dữ liệu",
          "Nguồn",
          "Mã CDE quy chiếu",
          "Tên thành tố CDE",
          "Thứ hạng",
          "Loại dữ liệu",
          "Loại thành tố",
          "Loại trường dữ liệu",
          "Phương thức tạo",
          "Thời gian",
          "Chủ sở hữu hệ thống",
          "Mô tả",
          "Phiên bản",
          "Loại phiên bản phát hành",
          "Trạng thái");

  private static final int ROW_WINDOW = 100;
  private static final int SHEET_NAME_LIMIT = 31;
  private static final int COLUMN_WIDTH_CHARS = 26;
  private static final Map<String, String> STATUS_LABELS =
      Map.of(
          "Draft", "Bản nháp",
          "In Review", "Đang xem xét",
          "Rejected", "Bị từ chối",
          "Approved", "Đã phê duyệt",
          "Archived", "Đã lưu trữ");

  private TechnicalExcelExporter() {}

  /** Rows visited in export order; lets the caller stream them instead of holding a list. */
  @FunctionalInterface
  public interface RowSource {
    void forEach(Consumer<Map<String, Object>> visitor);
  }

  public static ExportedWorkbook write(List<Map<String, Object>> rows, String version)
      throws IOException {
    return write(rows::forEach, version);
  }

  public static ExportedWorkbook write(RowSource rows, String version) throws IOException {
    final Path directory =
        Path.of(System.getProperty("java.io.tmpdir"), "openmetadata", "td-exports");
    Files.createDirectories(directory);
    final Path file =
        Files.createTempFile(directory, "technical-dictionary-v" + version + "-", ".xlsx");
    boolean complete = false;
    int written = 0;
    try (SXSSFWorkbook workbook = new SXSSFWorkbook(ROW_WINDOW)) {
      workbook.setCompressTempFiles(true);
      written = writeSheets(workbook, rows, version);
      try (OutputStream output = Files.newOutputStream(file)) {
        workbook.write(output);
      }
      workbook.dispose();
      validate(file);
      complete = true;
    } finally {
      if (!complete) {
        Files.deleteIfExists(file);
      }
    }
    return new ExportedWorkbook(file, written);
  }

  public static List<String> values(Map<String, Object> row) {
    final List<String> values = new ArrayList<>();
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_DATABASE));
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_SCHEMA));
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_TABLE));
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_COLUMN));
    values.add(references(row.get(TechnicalRowFields.DATA_OWNERS)));
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_SERVICE));
    values.add(TechnicalRowFields.text(row, TechnicalRowFields.CDE_CODE));
    values.add(TechnicalRowFields.text(row, TechnicalRowFields.CDE_NAME));
    values.add(extension(row, TechnicalDictionaryProfile.SURVIVORSHIP_RANK));
    values.add(extension(row, TechnicalDictionaryProfile.SOURCE_DATA_TYPE));
    TechnicalDictionaryProfile.CLASSIFICATIONS.stream()
        .map(classification -> tagLabel(row, classification))
        .forEach(values::add);
    values.add(
        reference(TechnicalRowFields.extension(row).get(TechnicalDictionaryProfile.SYSTEM_OWNER)));
    values.add(TechnicalRowFields.text(row, "description"));
    values.add(TechnicalRowFields.text(row, "businessVersion"));
    values.add(
        CdeReleaseVersionType.fromBusinessVersion(TechnicalRowFields.text(row, "businessVersion")));
    values.add(STATUS_LABELS.getOrDefault(TechnicalRowFields.text(row, "entityStatus"), ""));
    return values;
  }

  private static int writeSheets(SXSSFWorkbook workbook, RowSource rows, String version) {
    final SheetWriter writer = new SheetWriter(workbook, version);
    rows.forEach(writer::write);
    return writer.total;
  }

  /** Appends rows and starts a new sheet when one reaches the Excel row limit. */
  private static final class SheetWriter {
    private final SXSSFWorkbook workbook;
    private final String version;
    private final CellStyle header;
    private final CellStyle wrapped;
    private Sheet sheet;
    private int sheetIndex = 1;
    private int written;
    private int total;

    private SheetWriter(SXSSFWorkbook workbook, String version) {
      this.workbook = workbook;
      this.version = version;
      this.header = headerStyle(workbook);
      this.wrapped = wrappedStyle(workbook);
      this.sheet = newSheet(workbook, version, sheetIndex, header);
    }

    private void write(Map<String, Object> row) {
      if (written == CdeExcelExporter.EXCEL_MAX_DATA_ROWS) {
        sheet = newSheet(workbook, version, ++sheetIndex, header);
        written = 0;
      }
      writeRow(sheet.createRow(++written), values(row), wrapped);
      total++;
    }
  }

  private static void writeRow(Row row, List<String> values, CellStyle style) {
    for (int index = 0; index < values.size(); index++) {
      final Cell cell = row.createCell(index);
      cell.setCellValue(CdeExcelExporter.safeText(values.get(index)));
      cell.setCellStyle(style);
    }
  }

  private static Sheet newSheet(
      SXSSFWorkbook workbook, String version, int index, CellStyle header) {
    final String suffix = index == 1 ? "" : " (" + index + ")";
    final String base = "Technical Dictionary v" + version;
    final Sheet sheet =
        workbook.createSheet(
            base.substring(0, Math.min(base.length(), SHEET_NAME_LIMIT - suffix.length()))
                + suffix);
    final Row headerRow = sheet.createRow(0);
    for (int column = 0; column < HEADERS.size(); column++) {
      final Cell cell = headerRow.createCell(column);
      cell.setCellValue(HEADERS.get(column));
      cell.setCellStyle(header);
      sheet.setColumnWidth(column, COLUMN_WIDTH_CHARS * 256);
    }
    sheet.createFreezePane(0, 1);
    sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.size() - 1));
    return sheet;
  }

  private static String extension(Map<String, Object> row, String key) {
    return TechnicalRowFields.extensionText(row, key);
  }

  private static String tagLabel(Map<String, Object> row, String classification) {
    String label = "";
    if (row.get("tags") instanceof List<?> tags) {
      for (Object raw : tags) {
        if (raw instanceof Map<?, ?> tag
            && String.valueOf(tag.get("tagFQN")).startsWith(classification + ".")) {
          label =
              firstNonBlank(
                  tag.get("displayName"),
                  tag.get("name"),
                  lastSegment(String.valueOf(tag.get("tagFQN"))));
        }
      }
    }
    return label;
  }

  private static String references(Object raw) {
    final List<String> names = new ArrayList<>();
    if (raw instanceof List<?> list) {
      list.forEach(item -> names.add(reference(item)));
    }
    return String.join("\n", names.stream().filter(name -> !name.isEmpty()).distinct().toList());
  }

  private static String reference(Object raw) {
    return raw instanceof Map<?, ?> reference
        ? firstNonBlank(reference.get("displayName"), reference.get("name"), "")
        : "";
  }

  private static String firstNonBlank(Object first, Object second, String fallback) {
    final String primary = first == null ? "" : String.valueOf(first);
    final String secondary = second == null ? "" : String.valueOf(second);
    return !primary.isBlank() ? primary : !secondary.isBlank() ? secondary : fallback;
  }

  private static String lastSegment(String fqn) {
    return fqn.substring(fqn.lastIndexOf('.') + 1);
  }

  private static CellStyle headerStyle(SXSSFWorkbook workbook) {
    final CellStyle style = workbook.createCellStyle();
    final Font font = workbook.createFont();
    font.setBold(true);
    style.setFont(font);
    style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
    style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
    style.setWrapText(true);
    return style;
  }

  private static CellStyle wrappedStyle(SXSSFWorkbook workbook) {
    final CellStyle style = workbook.createCellStyle();
    style.setWrapText(true);
    return style;
  }

  private static void validate(Path file) throws IOException {
    boolean valid = Files.size(file) > 0;
    if (valid) {
      try (ZipFile archive = new ZipFile(file.toFile())) {
        valid =
            archive.getEntry("[Content_Types].xml") != null
                && archive.getEntry("xl/workbook.xml") != null;
      }
    }
    if (!valid) {
      throw new IOException("Generated Technical Dictionary workbook is invalid");
    }
  }
}
