/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;

/** Single-use, time-limited preview sessions for the Technical Dictionary import. */
public final class TechnicalImportService {
  public static final long SESSION_TTL_MILLIS = 30L * 60 * 1000;
  public static final int PREVIEW_ROW_LIMIT = 1_000;
  private static final int MAX_ACTIVE_SESSIONS = 5;
  private static final int TEMPLATE_COLUMN_WIDTH = 24;
  private static final List<String> TEMPLATE_HEADERS =
      List.of(
          TechnicalImportPlanner.DATABASE,
          TechnicalImportPlanner.SCHEMA,
          TechnicalImportPlanner.TABLE,
          TechnicalImportPlanner.COLUMN,
          TechnicalImportPlanner.SERVICE,
          TechnicalImportPlanner.CDE_CODE,
          TechnicalImportPlanner.RANK,
          TechnicalImportPlanner.ELEMENT_TYPE,
          TechnicalImportPlanner.GENERATION_TYPE,
          TechnicalImportPlanner.CREATION_METHOD,
          TechnicalImportPlanner.TIMELINESS,
          TechnicalImportPlanner.SYSTEM_OWNER);

  private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

  public boolean owns(UUID sessionId) {
    return sessions.containsKey(sessionId);
  }

  public byte[] template() {
    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      final Sheet sheet = workbook.createSheet("Import Technical Dictionary");
      final Row header = sheet.createRow(0);
      for (int index = 0; index < TEMPLATE_HEADERS.size(); index++) {
        header.createCell(index, CellType.STRING).setCellValue(TEMPLATE_HEADERS.get(index));
        sheet.setColumnWidth(index, TEMPLATE_COLUMN_WIDTH * 256);
      }
      sheet.createFreezePane(0, 1);
      workbook
          .createSheet("Hướng dẫn")
          .createRow(0)
          .createCell(0)
          .setCellValue(
              "Bốn cột đầu xác định cột dữ liệu và bắt buộc. Chỉ các cột có trong file được cập nhật; ô trống sẽ xóa giá trị. Cột chưa được khai báo sẽ được khai báo. File xuất từ Từ điển kỹ thuật hoặc bản chụp có thể dùng trực tiếp.");
      workbook.write(output);
      return output.toByteArray();
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to create the import template", exception);
    }
  }

  /**
   * Plans the file against the records returned by {@code declaredRecords} for the parsed sheet, so
   * only the tables named in the file have to be read.
   */
  public Map<String, Object> preview(
      byte[] fileBytes,
      PreviewScope scope,
      Function<TechnicalImportSheet, List<TechnicalRecord>> declaredRecords,
      TechnicalImportLookups lookups) {
    expireSessions();
    if (sessions.size() >= MAX_ACTIVE_SESSIONS) {
      throw new ClientErrorException(
          "Too many active import sessions", Response.Status.SERVICE_UNAVAILABLE);
    }
    final TechnicalImportSheet sheet = TechnicalImportSheet.parse(fileBytes);
    final List<PlannedRow> planned =
        new TechnicalImportPlanner(
                TechnicalImportPlanner.indexRecords(declaredRecords.apply(sheet)),
                lookups,
                new TechnicalRecordValidator())
            .plan(sheet);
    final Session session =
        new Session(
            UUID.randomUUID(),
            scope.actor(),
            scope.dataDictionaryVersion(),
            sha256(fileBytes),
            System.currentTimeMillis() + SESSION_TTL_MILLIS,
            List.copyOf(planned));
    sessions.put(session.id(), session);
    return toPreview(session);
  }

  public <T> T commit(UUID sessionId, String actor, Function<Session, T> committer) {
    expireSessions();
    final Session session = sessions.get(sessionId);
    if (session == null || session.expiresAt() <= System.currentTimeMillis()) {
      throw invalid("Import session is missing or expired; preview the file again");
    }
    if (!session.actor().equals(actor)) {
      throw invalid("Import session belongs to another actor");
    }
    if (session.rows().stream().anyMatch(PlannedRow::hasErrors)) {
      throw new jakarta.ws.rs.BadRequestException("Import session contains validation errors");
    }
    if (!sessions.remove(sessionId, session)) {
      throw invalid("Import session has already been committed");
    }
    return committer.apply(session);
  }

  private static Map<String, Object> toPreview(Session session) {
    final Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("importSessionId", session.id());
    preview.put("expiresAt", Instant.ofEpochMilli(session.expiresAt()).toString());
    preview.put("fileHash", session.fileHash());
    preview.put("dataDictionaryVersion", session.dataDictionaryVersion());
    preview.put("summary", summary(session.rows()));
    preview.put("rows", sampleRows(session.rows()));
    preview.put("truncated", session.rows().size() > PREVIEW_ROW_LIMIT);
    preview.put("canCommit", session.rows().stream().noneMatch(PlannedRow::hasErrors));
    return preview;
  }

  private static Map<String, Long> summary(List<PlannedRow> rows) {
    final Map<String, Long> summary = new LinkedHashMap<>();
    summary.put("total", (long) rows.size());
    TechnicalImportPlan.ACTIONS.forEach(
        action ->
            summary.put(action, rows.stream().filter(row -> action.equals(row.action())).count()));
    summary.put("error", rows.stream().filter(PlannedRow::hasErrors).count());
    summary.put("warning", rows.stream().mapToLong(row -> row.warnings().size()).sum());
    return summary;
  }

  private static List<Map<String, Object>> sampleRows(List<PlannedRow> rows) {
    return rows.stream()
        .sorted(
            Comparator.comparingInt(TechnicalImportService::severity)
                .thenComparingInt(PlannedRow::rowNumber))
        .limit(PREVIEW_ROW_LIMIT)
        .map(
            row -> {
              final Map<String, Object> view = new LinkedHashMap<>();
              view.put("rowNumber", row.rowNumber());
              view.put("action", row.action());
              view.put("errors", row.errors());
              view.put("warnings", row.warnings());
              return view;
            })
        .toList();
  }

  private static int severity(PlannedRow row) {
    return row.hasErrors() ? 0 : row.warnings().isEmpty() ? 2 : 1;
  }

  private void expireSessions() {
    final long now = System.currentTimeMillis();
    sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= now);
  }

  private static String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static RuntimeException invalid(String message) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.IMPORT_SESSION_INVALID, message);
  }

  public record PreviewScope(String dataDictionaryVersion, String actor) {}

  public record Session(
      UUID id,
      String actor,
      String dataDictionaryVersion,
      String fileHash,
      long expiresAt,
      List<PlannedRow> rows) {}
}
