/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.regex.Pattern;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Bounded XLSX parsing and single-use server-side sessions for atomic CDE import. */
public final class CdeImportService {
  public enum ExistingCodePolicy {
    SKIP_EXISTING,
    OVERWRITE_EXISTING;

    public static ExistingCodePolicy from(String value) {
      try {
        return valueOf(value);
      } catch (RuntimeException exception) {
        throw new BadRequestException(
            "existingCodePolicy must be SKIP_EXISTING or OVERWRITE_EXISTING");
      }
    }
  }

  public static final String XLSX_MEDIA_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  public static final long MAX_FILE_BYTES = 5L * 1024 * 1024;
  public static final int MAX_ROWS = 5_000;
  public static final int MAX_CELL_LENGTH = 32_000;
  public static final long SESSION_TTL_MILLIS = 30L * 60 * 1000;
  private static final int MAX_ACTIVE_SESSIONS = 1_000;
  private static final Pattern FORMULA_PREFIX = Pattern.compile("^[=+@].*|^-.*");
  public static final List<String> HEADERS =
      List.of(
          "Mã CDE",
          "Khối/Miền nghiệp vụ",
          "Tên thuật ngữ nghiệp vụ",
          "Hệ thống nguồn",
          "Ý nghĩa nghiệp vụ",
          "Mối quan hệ với thực thể",
          "Chủ sở hữu dữ liệu",
          "Cấp phát hành",
          "Phân loại dữ liệu",
          "Dữ liệu cá nhân",
          "Văn bản quy định liên quan",
          "Quy định chất lượng dữ liệu",
          "Ngày hiệu lực",
          "Ngày hết hiệu lực");

  private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

  public byte[] template() {
    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      Sheet sheet = workbook.createSheet("Import CDE");
      Row header = sheet.createRow(0);
      for (int index = 0; index < HEADERS.size(); index++) {
        header.createCell(index, CellType.STRING).setCellValue(HEADERS.get(index));
        sheet.setColumnWidth(index, Math.min(48, Math.max(18, HEADERS.get(index).length() + 4)) * 256);
      }
      sheet.createFreezePane(0, 1);
      workbook.createSheet("Hướng dẫn").createRow(0).createCell(0).setCellValue(
          "Mỗi dòng là trạng thái mong muốn đầy đủ của một CDE. Ô trống sẽ xóa giá trị hiện tại khi cập nhật. Ngày dùng định dạng dd/MM/yyyy.");
      workbook.write(output);
      return output.toByteArray();
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to create CDE import template", exception);
    }
  }

  public Preview preview(
      InputStream input,
      long contentLength,
      String actor,
      UUID glossaryId,
      String parentBusinessVersion,
      ExistingCodePolicy existingCodePolicy,
      Function<RowData, PlannedRow> planner) {
    expireSessions();
    if (sessions.size() >= MAX_ACTIVE_SESSIONS) {
      throw new ClientErrorException(
          "Too many active import sessions", Response.Status.SERVICE_UNAVAILABLE);
    }
    byte[] bytes = readBounded(input, contentLength);
    List<RowData> rows = parse(bytes);
    List<PlannedRow> planned = new ArrayList<>(rows.size());
    Set<String> names = new HashSet<>();
    for (RowData row : rows) {
      String normalized = normalizeName(row.value(0));
      if (normalized.isBlank()) {
        planned.add(PlannedRow.error(row.rowNumber(), "Mã CDE", "CDE_NAME_REQUIRED", "Mã CDE là bắt buộc"));
      } else if (!names.add(normalized)) {
        planned.add(PlannedRow.error(row.rowNumber(), "Mã CDE", "DUPLICATE_CDE_NAME", "Mã CDE bị trùng trong file"));
      } else {
        planned.add(planner.apply(row));
      }
    }
    UUID id = UUID.randomUUID();
    long expiresAt = System.currentTimeMillis() + SESSION_TTL_MILLIS;
    Session session =
        new Session(
            id,
            actor,
            glossaryId,
            parentBusinessVersion,
            existingCodePolicy,
            sha256(bytes),
            expiresAt,
            List.copyOf(planned));
    sessions.put(id, session);
    return toPreview(session);
  }

  public <T> T commit(UUID sessionId, String actor, Function<Session, T> committer) {
    expireSessions();
    Session session = sessions.get(sessionId);
    if (session == null || session.expiresAt() <= System.currentTimeMillis()) {
      throw conflict("Import session is missing or expired; preview the file again");
    }
    if (!session.actor().equals(actor)) {
      throw conflict("Import session belongs to another actor");
    }
    if (session.rows().stream().anyMatch(row -> !row.errors().isEmpty())) {
      throw new BadRequestException("Import session contains validation errors");
    }
    if (!sessions.remove(sessionId, session)) {
      throw conflict("Import session has already been committed");
    }
    try {
      return committer.apply(session);
    } catch (RuntimeException exception) {
      // A failed commit is intentionally not reusable: a new preview must capture fresh revisions.
      throw exception;
    }
  }

  private static Preview toPreview(Session session) {
    Map<String, Long> summary = new LinkedHashMap<>();
    summary.put("total", (long) session.rows().size());
    for (String action : List.of("CREATE", "SKIP", "CREATE_VERSION", "UPDATE_DRAFT", "REPLACE_IN_REVIEW_AND_REOPEN", "REPLACE_REJECTED_AND_REOPEN")) {
      summary.put(action, session.rows().stream().filter(row -> action.equals(row.action())).count());
    }
    long errors = session.rows().stream().filter(row -> !row.errors().isEmpty()).count();
    summary.put("error", errors);
    summary.put("warning", session.rows().stream().mapToLong(row -> row.warnings().size()).sum());
    return new Preview(
        session.id(),
        Instant.ofEpochMilli(session.expiresAt()).toString(),
        session.fileHash(),
        Map.of("glossaryId", session.glossaryId(), "parentBusinessVersion", session.parentBusinessVersion()),
        session.existingCodePolicy(),
        summary,
        session.rows(),
        errors == 0);
  }

  private static byte[] readBounded(InputStream input, long contentLength) {
    if (input == null) throw new BadRequestException("file is required");
    if (contentLength > MAX_FILE_BYTES) throw tooLarge();
    try {
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      input.transferTo(new java.io.OutputStream() {
        private long count;
        @Override public void write(int value) throws IOException {
          if (++count > MAX_FILE_BYTES) throw new FileTooLargeException();
          output.write(value);
        }
        @Override public void write(byte[] value, int offset, int length) throws IOException {
          count += length;
          if (count > MAX_FILE_BYTES) throw new FileTooLargeException();
          output.write(value, offset, length);
        }
      });
      return output.toByteArray();
    } catch (FileTooLargeException exception) {
      throw tooLarge();
    } catch (IOException exception) {
      throw new BadRequestException("Unable to read XLSX file", exception);
    }
  }

  private static List<RowData> parse(byte[] bytes) {
    double previousRatio = ZipSecureFile.getMinInflateRatio();
    ZipSecureFile.setMinInflateRatio(0.01d);
    try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
      boolean unsafePackage =
          workbook.getPackage().getParts().stream()
              .map(part -> part.getPartName().getName().toLowerCase(Locale.ROOT))
              .anyMatch(name -> name.contains("vbaproject") || name.contains("/embeddings/"));
      if (unsafePackage || !workbook.getExternalLinksTable().isEmpty() || !workbook.getAllPictures().isEmpty()) {
        throw new BadRequestException(
            "Macros, external links and embedded objects are not allowed");
      }
      if (workbook.getNumberOfSheets() < 1 || workbook.getNumberOfSheets() > 2) {
        throw new BadRequestException("Workbook must contain the data sheet and optional instruction sheet only");
      }
      Sheet sheet = workbook.getSheetAt(0);
      requireHeaders(sheet.getRow(0));
      if (sheet.getLastRowNum() > MAX_ROWS) throw tooLarge();
      List<RowData> rows = new ArrayList<>();
      for (int index = 1; index <= sheet.getLastRowNum(); index++) {
        Row row = sheet.getRow(index);
        if (row == null) continue;
        List<String> values = new ArrayList<>(HEADERS.size());
        boolean nonBlank = false;
        for (int column = 0; column < HEADERS.size(); column++) {
          Cell cell = row.getCell(column, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
          if (cell != null && cell.getCellType() == CellType.FORMULA) {
            throw new BadRequestException("Formula is not allowed at row " + (index + 1));
          }
          String value = cell == null ? "" : cell.toString().trim();
          if (value.length() > MAX_CELL_LENGTH || FORMULA_PREFIX.matcher(value).matches()) {
            throw new BadRequestException("Unsafe or oversized value at row " + (index + 1));
          }
          nonBlank |= !value.isBlank();
          values.add(value);
        }
        if (nonBlank) rows.add(new RowData(index + 1, List.copyOf(values)));
      }
      return rows;
    } catch (BadRequestException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new BadRequestException("Malformed or unsafe XLSX workbook", exception);
    } finally {
      ZipSecureFile.setMinInflateRatio(previousRatio);
    }
  }

  private static void requireHeaders(Row row) {
    if (row == null || row.getLastCellNum() != HEADERS.size()) {
      throw new BadRequestException("Import template must contain exactly 14 columns");
    }
    for (int index = 0; index < HEADERS.size(); index++) {
      if (!HEADERS.get(index).equals(row.getCell(index).toString().trim())) {
        throw new BadRequestException("Invalid import header at column " + (index + 1));
      }
    }
  }

  public static String normalizeName(String value) {
    return java.text.Normalizer.normalize(value == null ? "" : value.trim(), java.text.Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT);
  }

  private void expireSessions() {
    long now = System.currentTimeMillis();
    sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= now);
  }

  private static String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static ClientErrorException tooLarge() {
    return new ClientErrorException("XLSX exceeds the import limit", Response.Status.REQUEST_ENTITY_TOO_LARGE);
  }

  private static ClientErrorException conflict(String message) {
    return new ClientErrorException(message, Response.Status.CONFLICT);
  }

  private static final class FileTooLargeException extends IOException {}

  public record RowData(int rowNumber, List<String> values) {
    public String value(int index) { return values.get(index); }
  }

  public record ImportError(int rowNumber, String column, String code, String message) {}

  public record PlannedRow(
      int rowNumber,
      String cdeCode,
      String action,
      UUID termId,
      String businessVersion,
      String expectedPublishedVersion,
      Long expectedRevision,
      Map<String, Object> payload,
      List<String> warnings,
      List<ImportError> errors) {
    public static PlannedRow error(int row, String column, String code, String message) {
      return new PlannedRow(row, "", "ERROR", null, null, null, null, Map.of(), List.of(), List.of(new ImportError(row, column, code, message)));
    }
  }

  public record Session(
      UUID id,
      String actor,
      UUID glossaryId,
      String parentBusinessVersion,
      ExistingCodePolicy existingCodePolicy,
      String fileHash,
      long expiresAt,
      List<PlannedRow> rows) {}

  public record Preview(
      UUID importSessionId,
      String expiresAt,
      String fileHash,
      Map<String, Object> scope,
      ExistingCodePolicy existingCodePolicy,
      Map<String, Long> summary,
      List<PlannedRow> rows,
      boolean canCommit) {}
}
