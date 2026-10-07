/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.GovernedBulkWorkflowService.Action;
import org.openmetadata.service.glossary.versioning.GovernedBulkWorkflowService.Request;

class GovernedBulkWorkflowServiceTest {
  private final GovernedBulkWorkflowService service = new GovernedBulkWorkflowService(ids -> {});

  private static Map<String, Object> row(UUID id, String recordType, String status) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("termId", id.toString());
    row.put("recordType", recordType);
    row.put("entityStatus", status);
    return row;
  }

  private static Map<String, Object> deletionRow(UUID id, String status) {
    Map<String, Object> row = row(id, "working", status);
    row.put("pendingDeletion", true);
    return row;
  }

  private static Request request(boolean dryRun, Integer offset, Integer limit) {
    return new Request(UUID.randomUUID(), "1", null, null, dryRun, offset, limit);
  }

  @Test
  void onlyWorkingRowsInTheRequiredStatusAreEligible() {
    UUID draft = UUID.randomUUID();
    List<Map<String, Object>> rows =
        List.of(
            row(draft, "working", "Draft"),
            row(UUID.randomUUID(), "working", "In Review"),
            row(UUID.randomUUID(), "published", "Approved"));
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> result =
        service.run(
            Action.SUBMIT,
            request(false, null, null),
            rows,
            (r, ids) -> applied.add(GovernedBulkWorkflowService.termId(r)),
            null);

    assertEquals(List.of(draft), applied);
    assertEquals(3, result.get("matched"));
    assertEquals(1, result.get("eligible"));
    assertEquals(2, result.get("ineligible"));
    assertEquals(1, result.get("succeeded"));
    assertEquals(0, result.get("remaining"));
  }

  @Test
  void withdrawOnlyAppliesToInReviewRows() {
    UUID inReview = UUID.randomUUID();
    List<Map<String, Object>> rows =
        List.of(
            row(inReview, "working", "In Review"),
            row(UUID.randomUUID(), "working", "Draft"),
            row(UUID.randomUUID(), "published", "Approved"));
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> result =
        service.run(
            Action.WITHDRAW,
            request(false, null, null),
            rows,
            (r, ids) -> applied.add(GovernedBulkWorkflowService.termId(r)),
            null);

    assertEquals(List.of(inReview), applied);
    assertEquals(1, result.get("eligible"));
    assertEquals(1, result.get("succeeded"));
  }

  @Test
  void dryRunReportsWithoutApplying() {
    List<Map<String, Object>> rows = List.of(row(UUID.randomUUID(), "working", "In Review"));
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> result =
        service.run(
            Action.APPROVE,
            request(true, null, null),
            rows,
            (r, ids) -> applied.add(UUID.randomUUID()),
            null);

    assertTrue(applied.isEmpty());
    assertEquals(true, result.get("dryRun"));
    assertEquals(0, result.get("attempted"));
    assertEquals(1, result.get("eligible"));
    assertEquals(0, result.get("succeeded"));
  }

  @Test
  void approveIncludesLegacyDraftDeletionRequests() {
    UUID legacyDeletion = UUID.randomUUID();
    UUID normalDraft = UUID.randomUUID();
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> result =
        service.run(
            Action.APPROVE,
            request(false, null, null),
            List.of(deletionRow(legacyDeletion, "Draft"), row(normalDraft, "working", "Draft")),
            (row, ids) -> applied.add(GovernedBulkWorkflowService.termId(row)),
            null);

    assertEquals(List.of(legacyDeletion), applied);
    assertEquals(1, result.get("eligible"));
    assertEquals(1, result.get("ineligible"));
  }

  @Test
  void processesOneChunkAndReportsWhatRemains() {
    List<Map<String, Object>> rows = new ArrayList<>();
    for (int index = 0; index < 5; index++) {
      rows.add(row(UUID.randomUUID(), "working", "Draft"));
    }
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> first =
        service.run(
            Action.SUBMIT,
            request(false, 0, 2),
            rows,
            (r, ids) -> applied.add(GovernedBulkWorkflowService.termId(r)),
            null);
    Map<String, Object> second =
        service.run(Action.SUBMIT, request(false, 2, 2), rows, (r, ids) -> {}, null);

    assertEquals(2, first.get("succeeded"));
    assertEquals(3, first.get("remaining"));
    assertEquals(2, second.get("attempted"));
    assertEquals(1, second.get("remaining"));
  }

  @Test
  void aFailingRowIsReportedAndDoesNotStopTheBatch() {
    UUID bad = UUID.randomUUID();
    UUID good = UUID.randomUUID();
    List<Map<String, Object>> rows =
        List.of(row(bad, "working", "Draft"), row(good, "working", "Draft"));

    Map<String, Object> result =
        service.run(
            Action.SUBMIT,
            request(false, null, null),
            rows,
            (r, ids) -> {
              if (bad.equals(GovernedBulkWorkflowService.termId(r))) {
                throw new WebApplicationException(
                    "rank",
                    Response.status(409)
                        .entity(Map.of("code", "TD_RANK_DUPLICATE", "message", "dup"))
                        .build());
              }
            },
            null);

    assertEquals(1, result.get("succeeded"));
    assertEquals(1, result.get("failedCount"));
    @SuppressWarnings("unchecked")
    List<Map<String, String>> failures = (List<Map<String, String>>) result.get("failures");
    assertEquals("TD_RANK_DUPLICATE", failures.getFirst().get("code"));
    assertEquals(bad.toString(), failures.getFirst().get("termId"));
  }

  @Test
  void precheckRejectionsAreNotAttempted() {
    UUID blocked = UUID.randomUUID();
    UUID allowed = UUID.randomUUID();
    List<Map<String, Object>> rows =
        List.of(row(blocked, "working", "In Review"), row(allowed, "working", "In Review"));
    List<UUID> applied = new ArrayList<>();

    Map<String, Object> result =
        service.run(
            Action.APPROVE,
            request(false, null, null),
            rows,
            (r, ids) -> applied.add(GovernedBulkWorkflowService.termId(r)),
            chunk -> Map.of(blocked, "TD_RANK_DUPLICATE"));

    assertEquals(List.of(allowed), applied);
    assertEquals(1, result.get("failedCount"));
  }

  @Test
  void limitsAreBoundedAndActionsValidated() {
    assertEquals(
        GovernedBulkWorkflowService.DEFAULT_LIMIT, request(false, null, null).effectiveLimit());
    assertEquals(
        GovernedBulkWorkflowService.MAX_LIMIT, request(false, null, 100_000).effectiveLimit());
    assertEquals(0, request(false, -5, null).effectiveOffset());
    assertEquals(Action.APPROVE, Action.from("approve"));
    assertEquals(Action.WITHDRAW, Action.from("withdraw"));
    assertThrows(BadRequestException.class, () -> Action.from("delete"));
  }
}
