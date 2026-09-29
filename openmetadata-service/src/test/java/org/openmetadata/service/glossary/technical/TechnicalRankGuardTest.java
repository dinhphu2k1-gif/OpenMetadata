/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.glossary.technical.TechnicalRankGuard.RankKey;

class TechnicalRankGuardTest {
  private static final UUID CDE_A = UUID.randomUUID();
  private static final UUID CDE_B = UUID.randomUUID();

  private static GlossaryTerm term(UUID id, UUID cde, Integer rank) {
    GlossaryTerm term = new GlossaryTerm().withId(id);
    if (cde != null) {
      term.withRelatedTerms(
          List.of(new TermRelation().withTerm(new EntityReference().withId(cde))));
    }
    if (rank != null) {
      term.withExtension(Map.of(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, rank));
    }
    return term;
  }

  @Test
  void keyRequiresBothCdeAndRank() {
    UUID id = UUID.randomUUID();
    assertEquals(new RankKey(CDE_A.toString(), 1), RankKey.of(term(id, CDE_A, 1)));
    assertNull(RankKey.of(term(id, CDE_A, null)));
    assertNull(RankKey.of(term(id, null, 1)));
  }

  @Test
  void swappingRanksInOneBatchIsValidButCollisionIsNot() {
    GlossaryTerm first = term(UUID.randomUUID(), CDE_A, 2);
    GlossaryTerm second = term(UUID.randomUUID(), CDE_A, 1);
    Map<UUID, RankKey> swapped = new HashMap<>();
    swapped.put(first.getId(), RankKey.of(first));
    swapped.put(second.getId(), RankKey.of(second));
    assertEquals(
        List.of(), TechnicalRankGuard.duplicatedCandidates(swapped, List.of(first, second)));

    GlossaryTerm clash = term(UUID.randomUUID(), CDE_A, 1);
    swapped.put(clash.getId(), RankKey.of(clash));
    assertEquals(
        List.of(second.getId(), clash.getId()),
        TechnicalRankGuard.duplicatedCandidates(swapped, List.of(first, second, clash)));
  }

  @Test
  void sameRankOnDifferentCdesDoesNotCollide() {
    GlossaryTerm left = term(UUID.randomUUID(), CDE_A, 1);
    GlossaryTerm right = term(UUID.randomUUID(), CDE_B, 1);
    Map<UUID, RankKey> state = new HashMap<>();
    state.put(left.getId(), RankKey.of(left));
    state.put(right.getId(), RankKey.of(right));
    assertEquals(List.of(), TechnicalRankGuard.duplicatedCandidates(state, List.of(left, right)));
  }
}
