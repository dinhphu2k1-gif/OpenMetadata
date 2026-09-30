/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TechnicalRecordQueryDAO;
import org.openmetadata.service.jdbi3.TechnicalRecordQueryDAO.RankedRecord;

/**
 * Enforces that Approved records with an available source have a unique survivorship rank per
 * CDE identity inside one Technical Dictionary catalog version.
 */
public final class TechnicalRankGuard {

  private TechnicalRankGuard() {}

  /** Checks one record; with a handle the CDE identity is locked for the current transaction. */
  public static void requireUnique(Handle handle, GlossaryTerm payload) {
    requireUnique(handle, payload, Set.of());
  }

  /**
   * Like {@link #requireUnique(Handle, GlossaryTerm)} but ignores Approved records that are part of
   * the same bulk approval; the batch as a whole was validated with {@link #finalStateConflicts}.
   */
  public static void requireUnique(Handle handle, GlossaryTerm payload, Set<UUID> batchTermIds) {
    final RankKey key = RankKey.of(payload);
    if (key != null) {
      final TechnicalRecordQueryDAO dao =
          handle == null
              ? Entity.getJdbi().onDemand(TechnicalRecordQueryDAO.class)
              : handle.attach(TechnicalRecordQueryDAO.class);
      if (handle != null) {
        dao.lockTermIdentity(UUID.fromString(key.cdeId()));
      }
      final List<RankedRecord> conflicts =
          conflictsWith(key, payload, approvedFor(dao, payload, List.of(key.cdeId()))).stream()
              .filter(record -> !batchTermIds.contains(record.termId()))
              .toList();
      if (!conflicts.isEmpty()) {
        throw duplicate(key, conflicts.getFirst().columnFqn());
      }
    }
  }

  /**
   * Returns the candidate term ids that would violate rank uniqueness if every candidate were
   * approved together; used by bulk approval so that rank swaps inside one batch stay valid.
   */
  public static List<UUID> finalStateConflicts(
      UUID glossaryId, String parentBusinessVersion, Collection<GlossaryTerm> candidates) {
    final List<String> cdeIds =
        candidates.stream()
            .map(RankKey::of)
            .filter(Objects::nonNull)
            .map(RankKey::cdeId)
            .distinct()
            .toList();
    final Map<UUID, RankKey> finalState = approvedState(glossaryId, parentBusinessVersion, cdeIds);
    candidates.forEach(candidate -> finalState.put(candidate.getId(), RankKey.of(candidate)));
    return duplicatedCandidates(finalState, candidates);
  }

  private static Map<UUID, RankKey> approvedState(
      UUID glossaryId, String parentBusinessVersion, List<String> cdeIds) {
    final Map<UUID, RankKey> state = new HashMap<>();
    if (!cdeIds.isEmpty()) {
      final Map<String, String> sources =
          TechnicalSourceStates.statusesOf(glossaryId, parentBusinessVersion);
      Entity.getJdbi()
          .onDemand(TechnicalRecordQueryDAO.class)
          .listApprovedByCde(glossaryId, parentBusinessVersion, cdeIds)
          .stream()
          .filter(
              record ->
                  record.survivorshipRank() != null && isAvailable(sources, record.columnKey()))
          .forEach(
              record ->
                  state.put(
                      record.termId(), new RankKey(record.cdeId(), record.survivorshipRank())));
    }
    return state;
  }

  static List<UUID> duplicatedCandidates(
      Map<UUID, RankKey> finalState, Collection<GlossaryTerm> candidates) {
    final Map<RankKey, Long> counts =
        finalState.values().stream()
            .filter(Objects::nonNull)
            .collect(Collectors.groupingBy(key -> key, LinkedHashMap::new, Collectors.counting()));
    return candidates.stream()
        .filter(candidate -> counts.getOrDefault(finalState.get(candidate.getId()), 0L) > 1)
        .map(GlossaryTerm::getId)
        .toList();
  }

  private static List<RankedRecord> approvedFor(
      TechnicalRecordQueryDAO dao, GlossaryTerm payload, List<String> cdeIds) {
    return dao.listApprovedByCde(
        payload.getGlossary().getId(), payload.getParentBusinessVersion(), cdeIds);
  }

  private static List<RankedRecord> conflictsWith(
      RankKey key, GlossaryTerm payload, List<RankedRecord> approved) {
    final Map<String, String> states =
        TechnicalSourceStates.statusesOf(
            payload.getGlossary().getId(), payload.getParentBusinessVersion());
    return approved.stream()
        .filter(record -> !record.termId().equals(payload.getId()))
        .filter(record -> key.rank().equals(record.survivorshipRank()))
        .filter(record -> isAvailable(states, record.columnKey()))
        .toList();
  }

  private static boolean isAvailable(Map<String, String> states, String columnKey) {
    return !TechnicalDictionaryProfile.SOURCE_UNAVAILABLE.equals(states.get(columnKey));
  }

  private static RuntimeException duplicate(RankKey key, String conflictingColumn) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.RANK_DUPLICATE,
        String.format(
            "Rank %d of CDE %s is already held by Approved column '%s'",
            key.rank(), key.cdeId(), conflictingColumn));
  }

  record RankKey(String cdeId, Integer rank) {
    static RankKey of(GlossaryTerm payload) {
      final Integer rank =
          TechnicalRecordValidator.rank(TechnicalRecordValidator.extension(payload.getExtension()));
      final boolean mapped =
          !nullOrEmpty(payload.getRelatedTerms())
              && payload.getRelatedTerms().getFirst().getTerm() != null
              && payload.getRelatedTerms().getFirst().getTerm().getId() != null;
      return mapped && rank != null
          ? new RankKey(payload.getRelatedTerms().getFirst().getTerm().getId().toString(), rank)
          : null;
    }
  }
}
