/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.jsoup.Jsoup;

/** Writes the authorized F11 presentation rows to a bounded-memory XLSX workbook. */
public final class CdeExcelExporter {
  public static final String XLSX_MEDIA_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  static final int EXCEL_MAX_DATA_ROWS = 1_048_575;
  private static final int ROW_WINDOW = 100;
  private static final String[] HEADERS = {
    "Mã CDE",
    "Khối/Miền nghiệp vụ",
    "Tên thuật ngữ nghiệp vụ",
    "Hệ thống nguồn",
    "Ý nghĩa nghiệp vụ",
    "Mối quan hệ với thực thể",
    "Chủ sở hữu dữ liệu",
    "Phân loại dữ liệu",
    "Dữ liệu cá nhân",
    "Văn bản quy định liên quan",
    "Quy định chất lượng dữ liệu",
    "Phiên bản",
    "Ngày hiệu lực",
    "Ngày hết hiệu lực"
  };
  private static final int[] COLUMN_WIDTHS = {
    20, 28, 36, 28, 55, 50, 32, 28, 22, 50, 26, 16, 18, 18
  };

  private CdeExcelExporter() {}

  public static ExportedWorkbook write(
      List<Map<String, Object>> authorizedRows, String parentBusinessVersion) throws IOException {
    Path directory =
        Path.of(System.getProperty("java.io.tmpdir"), "openmetadata", "cde-exports");
    Files.createDirectories(directory);
    Path file = Files.createTempFile(directory, "cde-v" + parentBusinessVersion + "-", ".xlsx");
    boolean complete = false;
    try (SXSSFWorkbook workbook = new SXSSFWorkbook(ROW_WINDOW)) {
      workbook.setCompressTempFiles(true);
      CellStyle headerStyle = headerStyle(workbook);
      CellStyle wrappedStyle = wrappedStyle(workbook);
      SheetState sheetState = newSheet(workbook, parentBusinessVersion, 1, headerStyle);
      int exported = 0;
      for (Map<String, Object> row : authorizedRows) {
        if (sheetState.dataRows() == EXCEL_MAX_DATA_ROWS) {
          sheetState = newSheet(workbook, parentBusinessVersion, sheetState.index() + 1, headerStyle);
        }
        writeRow(sheetState.sheet(), sheetState.dataRows() + 1, row, wrappedStyle);
        sheetState = new SheetState(sheetState.sheet(), sheetState.index(), sheetState.dataRows() + 1);
        exported++;
      }
      try (OutputStream output = Files.newOutputStream(file)) {
        workbook.write(output);
      }
      workbook.dispose();
      validate(file);
      complete = true;
      return new ExportedWorkbook(file, exported);
    } finally {
      if (!complete) {
        Files.deleteIfExists(file);
      }
    }
  }

  private static SheetState newSheet(
      SXSSFWorkbook workbook, String version, int index, CellStyle headerStyle) {
    String base = "Data Dictionary v" + version;
    String suffix = index == 1 ? "" : " (" + index + ")";
    String name = base.substring(0, Math.min(base.length(), 31 - suffix.length())) + suffix;
    Sheet sheet = workbook.createSheet(name);
    Row header = sheet.createRow(0);
    for (int i = 0; i < HEADERS.length; i++) {
      Cell cell = header.createCell(i);
      cell.setCellValue(HEADERS[i]);
      cell.setCellStyle(headerStyle);
      sheet.setColumnWidth(i, Math.min(COLUMN_WIDTHS[i] * 256, 255 * 256));
    }
    sheet.createFreezePane(0, 1);
    sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));
    return new SheetState(sheet, index, 0);
  }

  @SuppressWarnings("unchecked")
  private static void writeRow(
      Sheet sheet, int rowIndex, Map<String, Object> source, CellStyle wrappedStyle) {
    Map<String, Object> presentationPayload = new java.util.LinkedHashMap<>(source);
    // F11 adds these read-model envelope fields after deserializing the business payload.
    // They are useful for row identity/routing but are deliberately not GlossaryTerm fields
    // and must never be mapped into, or exported from, the presentation workbook.
    presentationPayload.remove("termId");
    presentationPayload.remove("recordType");
    presentationPayload.remove("rowKey");
    presentationPayload.remove("scopeType");
    GlossaryTerm term = JsonUtils.convertValue(presentationPayload, GlossaryTerm.class);
    Map<String, Object> extension =
        term.getExtension() instanceof Map<?, ?> values
            ? (Map<String, Object>) values
            : Map.of();
    List<String> values =
        List.of(
            text(term.getName()),
            references(term.getDomains()),
            firstNonBlank(term.getDisplayName(), term.getName()),
            tags(term.getTags(), "DataSource"),
            markdown(term.getDescription()),
            markdown(extensionValue(extension, "entityRelationship", "moi_quan_he_voi_thuc_the")),
            references(term.getOwners()),
            tags(term.getTags(), "DataClassification"),
            tags(term.getTags(), "PersonalData"),
            markdown(
                extensionValue(
                    extension,
                    "relatedRegulatoryDocuments",
                    "van_ban_quy_dinh_lien_quan")),
            quality(
                extensionValue(
                    extension, "dataQualityRules", "quy_dinh_chat_luong_du_lieu")),
            text(source.get("businessVersion")),
            date(extension.get("effectiveDate")),
            date(extension.get("expirationDate")));
    Row row = sheet.createRow(rowIndex);
    for (int i = 0; i < values.size(); i++) {
      Cell cell = row.createCell(i);
      cell.setCellValue(safeText(values.get(i)));
      cell.setCellStyle(wrappedStyle);
    }
  }

  private static CellStyle headerStyle(SXSSFWorkbook workbook) {
    CellStyle style = workbook.createCellStyle();
    Font font = workbook.createFont();
    font.setBold(true);
    style.setFont(font);
    style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
    style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
    style.setWrapText(true);
    return style;
  }

  private static CellStyle wrappedStyle(SXSSFWorkbook workbook) {
    CellStyle style = workbook.createCellStyle();
    style.setWrapText(true);
    return style;
  }

  private static String references(List<EntityReference> references) {
    if (references == null) return "";
    return references.stream()
        .filter(Objects::nonNull)
        .map(reference -> firstNonBlank(reference.getDisplayName(), reference.getName()))
        .filter(value -> !value.isBlank())
        .distinct()
        .reduce((left, right) -> left + "\n" + right)
        .orElse("");
  }

  private static String tags(List<TagLabel> tags, String classification) {
    if (tags == null) return "";
    List<String> values = new ArrayList<>();
    for (TagLabel tag : tags) {
      if (tag == null || tag.getTagFQN() == null) continue;
      String fqn = tag.getTagFQN();
      if (!fqn.equals(classification) && !fqn.startsWith(classification + ".")) continue;
      String label = firstNonBlank(tag.getDisplayName(), tag.getName());
      if (label.isBlank()) {
        int separator = fqn.lastIndexOf('.');
        label = separator < 0 ? fqn : fqn.substring(separator + 1);
      }
      if (!values.contains(label)) values.add(label);
    }
    return String.join("\n", values);
  }

  private static String extensionValue(Map<String, Object> extension, String... keys) {
    for (String key : keys) {
      Object value = extension.get(key);
      if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value);
    }
    return "";
  }

  private static String markdown(Object value) {
    String source = text(value);
    if (source.isBlank()) return "";
    String lineBreak = "__OPENMETADATA_CDE_LINE_BREAK__";
    String withBreaks =
        source
            .replaceAll("(?i)<br\\s*/?>", lineBreak)
            .replaceAll("(?i)</(p|div|li|h[1-6])>", lineBreak);
    return Jsoup.parse(withBreaks).text().replace(lineBreak, "\n").trim();
  }

  private static String quality(Object value) {
    if (value == null || String.valueOf(value).isBlank()) return "";
    Object candidate = value;
    if (value instanceof List<?> list && !list.isEmpty()) candidate = list.get(0);
    String normalized = String.valueOf(candidate).trim().toUpperCase(Locale.ROOT);
    return List.of("TRUE", "1", "Y", "YES", "CO", "CÓ").contains(normalized)
        ? "Có"
        : "Không";
  }

  private static String date(Object value) {
    String raw = text(value).trim();
    if (raw.isEmpty()) return "";
    try {
      LocalDate parsed =
          raw.matches("\\d{2}/\\d{2}/\\d{4}")
              ? LocalDate.parse(raw, DateTimeFormatter.ofPattern("dd/MM/yyyy"))
              : LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE);
      return parsed.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    } catch (RuntimeException ignored) {
      return "";
    }
  }

  static String safeText(String value) {
    if (value == null || value.isEmpty()) return "";
    char first = value.charAt(0);
    return first == '=' || first == '+' || first == '-' || first == '@' || first == '\t'
            || first == '\r' || first == '\n'
        ? "'" + value
        : value;
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : text(second);
  }

  private static String text(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private static void validate(Path file) throws IOException {
    if (Files.size(file) == 0) throw new IOException("Generated CDE workbook is empty");
    try (ZipFile archive = new ZipFile(file.toFile())) {
      if (archive.getEntry("[Content_Types].xml") == null
          || archive.getEntry("xl/workbook.xml") == null) {
        throw new IOException("Generated CDE workbook is invalid");
      }
    }
  }

  private record SheetState(Sheet sheet, int index, int dataRows) {}

  public record ExportedWorkbook(Path path, int rowCount) {}
}
