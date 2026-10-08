/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.service.jdbi3.GovernedGlossarySearchDAO;

class GovernedGlossaryOutboxTest {
  @Test
  void enqueuesTheChangedScopeOnTheCallersDao() {
    final GovernedGlossarySearchDAO dao = Mockito.mock(GovernedGlossarySearchDAO.class);
    final UUID glossaryId = UUID.randomUUID();

    GovernedGlossaryOutbox.enqueue(dao, glossaryId, "4");

    verify(dao)
        .enqueue(
            org.mockito.ArgumentMatchers.eq(glossaryId),
            org.mockito.ArgumentMatchers.eq("4"),
            anyLong());
  }

  @Test
  void ignoresEntitiesThatHaveNoGovernedParentScope() {
    final GovernedGlossarySearchDAO dao = Mockito.mock(GovernedGlossarySearchDAO.class);

    GovernedGlossaryOutbox.enqueue(dao, UUID.randomUUID(), null);

    verify(dao, never())
        .enqueue(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), anyLong());
  }
}
