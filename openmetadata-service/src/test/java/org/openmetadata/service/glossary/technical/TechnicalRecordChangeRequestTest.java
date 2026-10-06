/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.AuditRow;

class TechnicalRecordChangeRequestTest {
  @Test
  void proposedValuesRoundTripWithoutChangingTheApprovedRecord() {
    final UUID cde = UUID.randomUUID();
    final TechnicalRecordValues values =
        new TechnicalRecordValues(cde, 7, "DataElementType.Atomic", null, null, null, null);
    final TechnicalRecordChangeRequest request =
        TechnicalRecordChangeRequest.builder()
            .id(UUID.randomUUID().toString())
            .recordId(UUID.randomUUID().toString())
            .operation(TechnicalRecordChangeRequest.OPERATION_UPDATE)
            .baseRevision(4)
            .proposedValues(JsonUtils.pojoToJson(values))
            .status(TechnicalRecordChangeRequest.STATUS_DRAFT)
            .revision(1)
            .createdAt(1)
            .createdBy("maker")
            .updatedAt(1)
            .updatedBy("maker")
            .build();

    assertTrue(request.isUpdate());
    assertTrue(request.isDraft());
    assertEquals(values, TechnicalChangeRequestService.values(request));
    assertEquals(4, request.baseRevision());
  }

  @Test
  void deleteProposalCarriesNoEditablePayload() {
    final TechnicalRecordChangeRequest request =
        TechnicalRecordChangeRequest.builder()
            .operation(TechnicalRecordChangeRequest.OPERATION_DELETE)
            .status(TechnicalRecordChangeRequest.STATUS_IN_REVIEW)
            .build();

    assertTrue(request.isDelete());
    assertTrue(request.isInReview());
    assertEquals(TechnicalRecordValues.EMPTY, TechnicalChangeRequestService.values(request));
  }

  @Test
  void proposalAuditKeepsOperationBaseRevisionAndBeforeAfterValues() {
    final TechnicalDictionaryDAO dao = mock(TechnicalDictionaryDAO.class);
    final TechnicalRecord before = TechnicalImportTestSupport.record("CUSTOMER", "NAME");
    final TechnicalRecord after = before.toBuilder().rank(2).build();
    final TechnicalRecordChangeRequest request =
        TechnicalRecordChangeRequest.builder()
            .id(UUID.randomUUID().toString())
            .recordId(before.id())
            .operation(TechnicalRecordChangeRequest.OPERATION_UPDATE)
            .baseRevision(before.revision())
            .status(TechnicalRecordChangeRequest.STATUS_IN_REVIEW)
            .revision(3)
            .build();

    TechnicalRecordAudit.recordChange(
        dao, TechnicalRecordAudit.APPROVE_CHANGE, request, before, after, "4", "checker");

    final ArgumentCaptor<AuditRow> captured = ArgumentCaptor.forClass(AuditRow.class);
    verify(dao).insertAudit(captured.capture());
    final AuditRow audit = captured.getValue();
    final List<Map<String, Object>> changes =
        JsonUtils.readValue(audit.changes(), new TypeReference<>() {});
    assertEquals(TechnicalRecordAudit.APPROVE_CHANGE, audit.action());
    assertEquals("checker", audit.actor());
    assertTrue(
        changes.stream()
            .anyMatch(
                change ->
                    "operation".equals(change.get("field"))
                        && "UPDATE".equals(change.get("newValue"))));
    assertTrue(changes.stream().anyMatch(change -> "baseRevision".equals(change.get("field"))));
    assertTrue(changes.stream().anyMatch(change -> "rank".equals(change.get("field"))));
  }
}
