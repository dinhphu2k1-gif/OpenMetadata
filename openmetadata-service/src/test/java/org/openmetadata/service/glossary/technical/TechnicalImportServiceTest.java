/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalImportService.PreviewScope;

class TechnicalImportServiceTest {
  private static final List<String> HEADERS =
      List.of(
          "Tên cơ sở dữ liệu", "Tên Schema", "Tên Bảng", "Tên cột", "Mã CDE quy chiếu", "Thứ hạng");

  private final TechnicalImportService service = new TechnicalImportService();

  private Map<String, Object> preview(String actor, List<String> row) {
    byte[] file = TechnicalImportTestSupport.workbook(HEADERS, List.of(row));
    return service.preview(
        file,
        new PreviewScope("1", actor),
        sheet -> List.of(TechnicalImportTestSupport.record("T", "NAME")),
        TechnicalImportTestSupport.lookups());
  }

  @Test
  void previewSummarizesActionsAndAllowsCommitWhenThereAreNoErrors() {
    Map<String, Object> preview =
        preview("proposer", List.of("core", "dbo", "T", "NAME", "CDE1", "1"));

    @SuppressWarnings("unchecked")
    Map<String, Long> summary = (Map<String, Long>) preview.get("summary");
    assertEquals(1L, summary.get("UPDATE"));
    assertEquals(0L, summary.get("error"));
    assertEquals(true, preview.get("canCommit"));
    assertEquals(64, String.valueOf(preview.get("fileHash")).length());
  }

  @Test
  void aSessionCommitsOnceAndOnlyForItsActor() {
    UUID id =
        (UUID)
            preview("proposer", List.of("core", "dbo", "T", "NAME", "CDE1", "1"))
                .get("importSessionId");

    assertThrows(
        WebApplicationException.class, () -> service.commit(id, "someone-else", session -> "x"));
    assertEquals("done", service.commit(id, "proposer", session -> "done"));
    assertThrows(
        WebApplicationException.class, () -> service.commit(id, "proposer", session -> "again"));
  }

  @Test
  void aSessionWithRowErrorsCannotBeCommitted() {
    Map<String, Object> preview =
        preview("proposer", List.of("core", "dbo", "T", "MISSING", "CDE1", "1"));
    UUID id = (UUID) preview.get("importSessionId");

    assertEquals(false, preview.get("canCommit"));
    assertThrows(BadRequestException.class, () -> service.commit(id, "proposer", session -> "x"));
    assertTrue(service.owns(id));
  }

  @Test
  void unknownSessionsAreRejectedAndTemplateHasEditableHeaders() {
    assertThrows(
        WebApplicationException.class,
        () -> service.commit(UUID.randomUUID(), "proposer", session -> "x"));
    TechnicalImportSheet template = TechnicalImportSheet.parse(service.template());
    assertTrue(template.headers().containsAll(HEADERS));
  }
}
