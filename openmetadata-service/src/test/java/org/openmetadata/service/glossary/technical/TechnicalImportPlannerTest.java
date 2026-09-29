/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.UpdatePolicy;

class TechnicalImportPlannerTest {
  private static final List<String> LOCATION =
      List.of("Tên cơ sở dữ liệu", "Tên Schema", "Tên Bảng", "Tên cột");

  private static List<String> headers(String... extra) {
    List<String> headers = new ArrayList<>(LOCATION);
    headers.addAll(List.of(extra));
    return headers;
  }

  private static List<String> cells(String table, String column, String... extra) {
    List<String> cells = new ArrayList<>(List.of("core", "dbo", table, column));
    cells.addAll(List.of(extra));
    return cells;
  }

  private static List<PlannedRow> plan(
      UpdatePolicy policy,
      List<Map<String, Object>> records,
      List<String> headers,
      List<List<String>> rows) {
    TechnicalImportPlanner planner =
        new TechnicalImportPlanner(
            TechnicalImportPlanner.indexRows(records),
            TechnicalImportTestSupport.lookups(),
            policy);
    return planner.plan(
        TechnicalImportSheet.parse(TechnicalImportTestSupport.workbook(headers, rows)));
  }

  @Test
  void mapsEachStatusAndPolicyToTheDocumentedAction() {
    List<Map<String, Object>> records =
        List.of(
            TechnicalImportTestSupport.record("T", "DRAFT", "Draft", "working"),
            TechnicalImportTestSupport.record("T", "REVIEW", "In Review", "working"),
            TechnicalImportTestSupport.record("T", "REJECTED", "Rejected", "working"),
            TechnicalImportTestSupport.record("T", "APPROVED", "Approved", "published"));
    List<String> headers = headers("Mã CDE quy chiếu", "Thứ hạng");
    List<List<String>> rows =
        List.of(
            cells("T", "DRAFT", "CDE1", "1"),
            cells("T", "REVIEW", "CDE1", "2"),
            cells("T", "REJECTED", "CDE1", "3"),
            cells("T", "APPROVED", "CDE1", "4"));

    List<String> draftOnly =
        plan(UpdatePolicy.DRAFT_ONLY, records, headers, rows).stream()
            .map(PlannedRow::action)
            .toList();
    List<PlannedRow> all = plan(UpdatePolicy.ALL_EDITABLE, records, headers, rows);

    assertEquals(List.of("UPDATE_DRAFT", "SKIP", "SKIP", "SKIP"), draftOnly);
    assertEquals(
        List.of(
            "UPDATE_DRAFT",
            "REPLACE_IN_REVIEW_AND_REOPEN",
            "REPLACE_REJECTED_AND_REOPEN",
            "CREATE_VERSION"),
        all.stream().map(PlannedRow::action).toList());
    assertEquals(3L, all.get(1).expectedRevision());
    assertEquals("1.1", all.get(3).newBusinessVersion());
    assertEquals("1.0", all.get(3).expectedPublishedVersion());
  }

  @Test
  void reportsUnmatchedAndAmbiguousColumnsWithoutCreatingRecords() {
    Map<String, Object> first = TechnicalImportTestSupport.record("T", "NAME", "Draft", "working");
    List<PlannedRow> planned =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(first),
            headers("Mã CDE quy chiếu"),
            List.of(
                cells("T", "MISSING", "CDE1"),
                cells("T", "NAME", "CDE1"),
                cells("T", "NAME", "CDE1")));

    assertEquals(
        TechnicalDictionaryErrors.IMPORT_ROW_NOT_MATCHED,
        planned.get(0).errors().getFirst().code());
    assertEquals("UPDATE_DRAFT", planned.get(1).action());
    assertEquals("DUPLICATE_ROW", planned.get(2).errors().getFirst().code());
  }

  @Test
  void aServiceColumnDisambiguatesSameLocations() {
    Map<String, Object> ipcas = TechnicalImportTestSupport.record("T", "NAME", "Draft", "working");
    Map<String, Object> crm = TechnicalImportTestSupport.record("T", "NAME", "Draft", "working");
    crm.put(
        "extension",
        Map.of(
            TechnicalDictionaryProfile.SOURCE_DATABASE, "core",
            TechnicalDictionaryProfile.SOURCE_SCHEMA, "dbo",
            TechnicalDictionaryProfile.SOURCE_TABLE, "T",
            TechnicalDictionaryProfile.SOURCE_COLUMN, "NAME",
            TechnicalDictionaryProfile.SOURCE_SERVICE, "crm"));
    crm.put("termId", java.util.UUID.randomUUID().toString());

    List<PlannedRow> ambiguous =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(ipcas, crm),
            headers("Mã CDE quy chiếu"),
            List.of(cells("T", "NAME", "CDE1")));
    List<PlannedRow> resolved =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(ipcas, crm),
            headers("Nguồn", "Mã CDE quy chiếu"),
            List.of(cells("T", "NAME", "CRM", "CDE1")));

    assertTrue(ambiguous.getFirst().hasErrors());
    assertEquals("UPDATE_DRAFT", resolved.getFirst().action());
    assertEquals(crm.get("termId"), resolved.getFirst().termId().toString());
  }

  @Test
  void onlyColumnsPresentInTheFileAreApplied() {
    List<PlannedRow> planned =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(TechnicalImportTestSupport.record("T", "NAME", "Draft", "working")),
            headers("Mã CDE quy chiếu"),
            List.of(cells("T", "NAME", "")));

    TechnicalImportPlan.RowPatch patch = planned.getFirst().patch();
    assertTrue(patch.cde().specified());
    assertEquals(null, patch.cde().value());
    assertEquals(false, patch.rank().specified());
    assertEquals(false, patch.systemOwner().specified());
  }

  @Test
  void identicalValuesAreNoChange() {
    Map<String, Object> current =
        TechnicalImportTestSupport.record("T", "NAME", "Draft", "working");
    current.put(
        "relatedTerms",
        List.of(Map.of("term", Map.of("id", TechnicalImportTestSupport.CDE_ID.toString()))));
    @SuppressWarnings("unchecked")
    Map<String, Object> extension =
        new java.util.LinkedHashMap<>((Map<String, Object>) current.get("extension"));
    extension.put(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, 2);
    current.put("extension", extension);

    List<PlannedRow> planned =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(current),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "CDE1", "2")));

    assertEquals("NO_CHANGE", planned.getFirst().action());
  }

  @Test
  void invalidReferencesAndRanksAreRowErrorsWithTheirColumn() {
    List<PlannedRow> planned =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(TechnicalImportTestSupport.record("T", "NAME", "Draft", "working")),
            headers("Mã CDE quy chiếu", "Thứ hạng", "Thời gian", "Chủ sở hữu hệ thống"),
            List.of(cells("T", "NAME", "CDE9", "1000", "T+9", "Ai đó")));

    List<String> columns =
        planned.getFirst().errors().stream().map(TechnicalImportPlan.ImportError::column).toList();
    assertEquals(
        List.of("Mã CDE quy chiếu", "Thứ hạng", "Thời gian", "Chủ sở hữu hệ thống"), columns);
    assertEquals("ERROR", planned.getFirst().action());
  }

  @Test
  void duplicateRankForTheSameCdeInsideTheFileIsAWarning() {
    List<PlannedRow> planned =
        plan(
            UpdatePolicy.DRAFT_ONLY,
            List.of(
                TechnicalImportTestSupport.record("T", "A", "Draft", "working"),
                TechnicalImportTestSupport.record("T", "B", "Draft", "working")),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "A", "CDE1", "1"), cells("T", "B", "CDE1", "1")));

    assertEquals(1, planned.get(0).warnings().size());
    assertEquals(1, planned.get(1).warnings().size());
    assertTrue(planned.stream().noneMatch(PlannedRow::hasErrors));
  }

  @Test
  void requiresTheFourLocationColumnsAndAtLeastOneEditableColumn() {
    assertThrows(
        BadRequestException.class,
        () -> TechnicalImportPlanner.requireHeaders(List.of("Tên cột", "Thứ hạng")));
    assertThrows(BadRequestException.class, () -> TechnicalImportPlanner.requireHeaders(LOCATION));
    TechnicalImportPlanner.requireHeaders(headers("Thứ hạng"));
  }
}
