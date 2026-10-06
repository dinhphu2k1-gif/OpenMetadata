/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;

class TechnicalImportPlannerTest {
  private static final List<String> LOCATION =
      List.of("Tên cơ sở dữ liệu", "Tên Schema", "Tên Bảng", "Tên cột");
  private static final String CDE = TechnicalImportTestSupport.CDE_ID.toString();

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
      List<TechnicalRecord> records,
      TechnicalImportLookups lookups,
      List<String> headers,
      List<List<String>> rows) {
    TechnicalImportPlanner planner =
        new TechnicalImportPlanner(
            TechnicalImportPlanner.indexRecords(records),
            lookups,
            TechnicalImportTestSupport.validator());
    return planner.plan(
        TechnicalImportSheet.parse(TechnicalImportTestSupport.workbook(headers, rows)));
  }

  private static List<PlannedRow> plan(
      List<TechnicalRecord> records, List<String> headers, List<List<String>> rows) {
    return plan(records, TechnicalImportTestSupport.lookups(), headers, rows);
  }

  private static List<PlannedRow> plan(
      List<TechnicalRecord> records,
      Map<String, TechnicalRecordChangeRequest> changes,
      List<String> headers,
      List<List<String>> rows) {
    return new TechnicalImportPlanner(
            TechnicalImportPlanner.indexRecords(records),
            changes,
            TechnicalImportTestSupport.lookups(),
            TechnicalImportTestSupport.validator())
        .plan(TechnicalImportSheet.parse(TechnicalImportTestSupport.workbook(headers, rows)));
  }

  @Test
  void updatesDeclaredColumnsAndDeclaresColumnsWithoutARecord() {
    TechnicalRecord declared = TechnicalImportTestSupport.record("T", "NAME");
    TechnicalImportLookups lookups =
        TechnicalImportTestSupport.lookups(
            Map.of(), List.of(TechnicalImportTestSupport.undeclared("T", "NEW")));

    List<PlannedRow> planned =
        plan(
            List.of(declared),
            lookups,
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "CDE1", "1"), cells("T", "NEW", "CDE1", "2")));

    assertEquals(TechnicalImportPlan.UPDATE, planned.get(0).action());
    assertEquals(declared.id(), planned.get(0).recordId());
    assertEquals(3L, planned.get(0).expectedRevision());
    assertEquals(TechnicalImportPlan.CREATE_RECORD, planned.get(1).action());
    assertEquals("NEW", planned.get(1).column().columnName());
    assertTrue(planned.stream().allMatch(PlannedRow::mutates));
  }

  @Test
  void approvedImportPinsDraftProposalRevisionAndRejectsInReviewProposal() {
    final TechnicalRecord approved = TechnicalImportTestSupport.record("T", "NAME");
    final TechnicalRecordChangeRequest draft =
        TechnicalRecordChangeRequest.builder()
            .recordId(approved.id())
            .status(TechnicalRecordChangeRequest.STATUS_DRAFT)
            .revision(7)
            .build();
    final List<String> importHeaders = headers("Mã CDE quy chiếu", "Thứ hạng");
    final List<List<String>> importRows = List.of(cells("T", "NAME", "CDE1", "1"));

    final PlannedRow planned =
        plan(List.of(approved), Map.of(approved.id(), draft), importHeaders, importRows).getFirst();
    assertEquals(7L, planned.expectedChangeRevision());

    final TechnicalRecordChangeRequest inReview =
        draft.toBuilder().status(TechnicalRecordChangeRequest.STATUS_IN_REVIEW).build();
    final PlannedRow rejected =
        plan(List.of(approved), Map.of(approved.id(), inReview), importHeaders, importRows)
            .getFirst();
    assertEquals(TechnicalImportPlan.ERROR, rejected.action());
    assertEquals(
        TechnicalDictionaryErrors.CHANGE_REQUEST_EXISTS, rejected.errors().getFirst().code());
  }

  @Test
  void reportsUnmatchedAndDuplicateRows() {
    List<PlannedRow> planned =
        plan(
            List.of(TechnicalImportTestSupport.record("T", "NAME")),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(
                cells("T", "MISSING", "CDE1", "1"),
                cells("T", "NAME", "CDE1", "1"),
                cells("T", "NAME", "CDE1", "1")));

    assertEquals(
        TechnicalDictionaryErrors.IMPORT_ROW_NOT_MATCHED,
        planned.get(0).errors().getFirst().code());
    assertEquals(TechnicalImportPlan.UPDATE, planned.get(1).action());
    assertEquals("DUPLICATE_ROW", planned.get(2).errors().getFirst().code());
  }

  @Test
  void aServiceColumnDisambiguatesSameLocations() {
    TechnicalRecord ipcas = TechnicalImportTestSupport.record("T", "NAME");
    TechnicalRecord crm = TechnicalImportTestSupport.record("T", "NAME", "crm");

    List<PlannedRow> ambiguous =
        plan(
            List.of(ipcas, crm),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "CDE1", "1")));
    List<PlannedRow> resolved =
        plan(
            List.of(ipcas, crm),
            headers("Nguồn", "Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "CRM", "CDE1", "1")));

    assertTrue(ambiguous.getFirst().hasErrors());
    assertEquals(TechnicalImportPlan.UPDATE, resolved.getFirst().action());
    assertEquals(crm.id(), resolved.getFirst().recordId());
  }

  @Test
  void onlyColumnsPresentInTheFileAreApplied() {
    List<PlannedRow> planned =
        plan(
            List.of(
                TechnicalImportTestSupport.withCde(
                    TechnicalImportTestSupport.record("T", "NAME"), 1)),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "", "")));

    TechnicalImportPlan.RowPatch patch = planned.getFirst().patch();
    assertTrue(patch.cde().specified());
    assertEquals(null, patch.cde().value());
    assertFalse(patch.systemOwner().specified());
    assertEquals(TechnicalImportPlan.UPDATE, planned.getFirst().action());
  }

  @Test
  void identicalValuesAreNoChange() {
    List<PlannedRow> planned =
        plan(
            List.of(
                TechnicalImportTestSupport.withCde(
                    TechnicalImportTestSupport.record("T", "NAME"), 2)),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "NAME", "CDE1", "2")));

    assertEquals(TechnicalImportPlan.NO_CHANGE, planned.getFirst().action());
  }

  @Test
  void invalidReferencesAndRanksAreRowErrorsWithTheirColumn() {
    List<PlannedRow> planned =
        plan(
            List.of(TechnicalImportTestSupport.record("T", "NAME")),
            headers("Mã CDE quy chiếu", "Thứ hạng", "Thời gian", "Chủ sở hữu hệ thống"),
            List.of(cells("T", "NAME", "CDE9", "1000", "T+9", "Ai đó")));

    List<String> columns =
        planned.getFirst().errors().stream().map(TechnicalImportPlan.ImportError::column).toList();
    assertEquals(
        List.of("Mã CDE quy chiếu", "Thứ hạng", "Thời gian", "Chủ sở hữu hệ thống"), columns);
    assertEquals(TechnicalImportPlan.ERROR, planned.getFirst().action());
  }

  @Test
  void aCdeWithoutARankIsAValidationError() {
    List<PlannedRow> planned =
        plan(
            List.of(TechnicalImportTestSupport.record("T", "NAME")),
            headers("Mã CDE quy chiếu"),
            List.of(cells("T", "NAME", "CDE1")));

    assertEquals(
        TechnicalDictionaryErrors.RANK_REQUIRED, planned.getFirst().errors().getFirst().code());
  }

  @Test
  void aRankRepeatedInsideTheFileIsAnError() {
    List<PlannedRow> planned =
        plan(
            List.of(
                TechnicalImportTestSupport.record("T", "A"),
                TechnicalImportTestSupport.record("T", "B")),
            headers("Mã CDE quy chiếu", "Thứ hạng"),
            List.of(cells("T", "A", "CDE1", "1"), cells("T", "B", "CDE1", "1")));

    assertFalse(planned.get(0).hasErrors());
    assertEquals(
        TechnicalDictionaryErrors.RANK_DUPLICATE, planned.get(1).errors().getFirst().code());
  }

  @Test
  void aRankHeldOutsideTheFileIsAnErrorButHoldersInTheFileMayMove() {
    TechnicalRecord outsider =
        TechnicalImportTestSupport.withCde(TechnicalImportTestSupport.record("T", "OUT"), 5);
    TechnicalRecord first =
        TechnicalImportTestSupport.withCde(TechnicalImportTestSupport.record("T", "A"), 1);
    TechnicalRecord second =
        TechnicalImportTestSupport.withCde(TechnicalImportTestSupport.record("T", "B"), 2);
    Map<String, TechnicalRecord> holders =
        Map.of(CDE + "#5", outsider, CDE + "#1", first, CDE + "#2", second);
    TechnicalImportLookups lookups = TechnicalImportTestSupport.lookups(holders, List.of());
    List<TechnicalRecord> records = List.of(outsider, first, second);
    List<String> headers = headers("Mã CDE quy chiếu", "Thứ hạng");

    List<PlannedRow> swapped =
        plan(
            records,
            lookups,
            headers,
            List.of(cells("T", "A", "CDE1", "2"), cells("T", "B", "CDE1", "1")));
    List<PlannedRow> taken = plan(records, lookups, headers, List.of(cells("T", "A", "CDE1", "5")));

    assertTrue(swapped.stream().noneMatch(PlannedRow::hasErrors));
    assertEquals(
        TechnicalDictionaryErrors.RANK_DUPLICATE, taken.getFirst().errors().getFirst().code());
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
