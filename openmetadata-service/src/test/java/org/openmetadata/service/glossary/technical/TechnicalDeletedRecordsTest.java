/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.DeletedRow;

class TechnicalDeletedRecordsTest {

  @Test
  void keptPayloadReadsBackTheApprovedRecord() {
    final TechnicalRecord approved =
        TechnicalRecord.builder()
            .id("record-1")
            .columnKey("column-1")
            .columnFqn("ipcas.core.dbo.CUSTOMER.NAME")
            .sourceStatus(TechnicalDictionaryProfile.SOURCE_AVAILABLE)
            .cdeTermId("cde-1")
            .rank(2)
            .status(TechnicalRecord.STATUS_APPROVED)
            .revision(4)
            .createdBy("maker")
            .updatedBy("checker")
            .build();
    final DeletedRow kept =
        new DeletedRow(
            approved.id(),
            approved.columnFqn(),
            approved.cdeTermId(),
            "1",
            JsonUtils.pojoToJson(approved),
            1_700_000_000_000L,
            "checker");

    assertEquals(approved, TechnicalDeletedRecords.record(kept));
  }
}
