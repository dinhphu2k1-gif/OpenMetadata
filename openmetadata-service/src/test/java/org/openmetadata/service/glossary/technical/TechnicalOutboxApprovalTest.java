/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

class TechnicalOutboxApprovalTest {
  @Test
  void pendingAndRejectedRecordsAreIndexedWithoutProjection() {
    final TechnicalDictionaryDAO dao = mock(TechnicalDictionaryDAO.class);
    final TechnicalRecord base = TechnicalImportTestSupport.record("CUSTOMER", "NAME");

    TechnicalOutbox.enqueueRecord(
        dao, base.toBuilder().status(TechnicalRecord.STATUS_IN_REVIEW).build());
    TechnicalOutbox.enqueueRecord(
        dao, base.toBuilder().status(TechnicalRecord.STATUS_REJECTED).build());

    verify(dao, times(2)).enqueue(eq(TechnicalOutbox.INDEX), eq(base.id()), isNull(), anyLong());
    verify(dao, never())
        .enqueue(
            eq(TechnicalOutbox.PROJECTION), eq(base.columnKey()), eq(base.columnFqn()), anyLong());
  }

  @Test
  void approvedRecordIsIndexedAndProjected() {
    final TechnicalDictionaryDAO dao = mock(TechnicalDictionaryDAO.class);
    final TechnicalRecord approved = TechnicalImportTestSupport.record("CUSTOMER", "NAME");

    TechnicalOutbox.enqueueRecord(dao, approved);

    verify(dao).enqueue(eq(TechnicalOutbox.INDEX), eq(approved.id()), isNull(), anyLong());
    verify(dao)
        .enqueue(
            eq(TechnicalOutbox.PROJECTION),
            eq(approved.columnKey()),
            eq(approved.columnFqn()),
            anyLong());
  }
}
