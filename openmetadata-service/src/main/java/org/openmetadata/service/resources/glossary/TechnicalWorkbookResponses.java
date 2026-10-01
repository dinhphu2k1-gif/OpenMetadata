/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import jakarta.ws.rs.InternalServerErrorException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter.ExportedWorkbook;

/** Turns a generated Technical Dictionary workbook into a downloadable response. */
@Slf4j
final class TechnicalWorkbookResponses {
  private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd_HHmm");

  private TechnicalWorkbookResponses() {}

  @FunctionalInterface
  interface WorkbookProducer {
    ExportedWorkbook produce() throws IOException;
  }

  /** {@code fileStem} is completed with a timestamp and the xlsx extension. */
  static Response download(String actor, String fileStem, WorkbookProducer producer) {
    ExportedWorkbook workbook = null;
    try {
      workbook = producer.produce();
      final Path file = workbook.path();
      file.toFile().deleteOnExit();
      final long length = Files.size(file);
      final String filename = fileStem + "_" + LocalDateTime.now().format(TIMESTAMP) + ".xlsx";
      final StreamingOutput stream =
          output -> {
            try {
              Files.copy(file, output);
            } finally {
              Files.deleteIfExists(file);
            }
          };
      LOG.info(
          "Technical Dictionary export actor={} file={} rows={}",
          actor,
          filename,
          workbook.rowCount());
      return Response.ok(stream, CdeExcelExporter.XLSX_MEDIA_TYPE)
          .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
          .header("Content-Length", length)
          .build();
    } catch (IOException exception) {
      discard(workbook, exception);
      LOG.error("Technical Dictionary export failed actor={}", actor, exception);
      throw new InternalServerErrorException(
          "Unable to export the Technical Dictionary", exception);
    }
  }

  private static void discard(ExportedWorkbook workbook, IOException failure) {
    if (workbook != null) {
      try {
        Files.deleteIfExists(workbook.path());
      } catch (IOException cleanupException) {
        failure.addSuppressed(cleanupException);
      }
    }
  }
}
