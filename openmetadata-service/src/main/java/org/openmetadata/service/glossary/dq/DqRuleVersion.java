/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * A published version of a Rule that is no longer the applied one, with the period it was applied:
 * from its publication until it was archived or replaced by the next published version.
 */
public record DqRuleVersion(DqRuleContext context, long appliedFrom, long appliedUntil) {

  /** Empty when the version was never published or is still the applied one. */
  static Optional<DqRuleVersion> loadReplaced(UUID ruleId, String businessVersion) {
    final List<PublishedSnapshotRecord> published =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .listPublished(Entity.GLOSSARY_TERM, ruleId)
            .stream()
            .sorted(Comparator.comparingLong(PublishedSnapshotRecord::publicationSequence))
            .toList();
    return published.stream()
        .filter(snapshot -> snapshot.businessVersion().equals(businessVersion))
        .findFirst()
        .flatMap(snapshot -> replaced(snapshot, published));
  }

  static Optional<DqRuleVersion> replaced(
      PublishedSnapshotRecord snapshot, List<PublishedSnapshotRecord> published) {
    final Optional<Long> until =
        Optional.ofNullable(snapshot.archivedAt()).or(() -> nextPublication(snapshot, published));
    return until.map(
        end ->
            new DqRuleVersion(
                DqRuleContext.of(
                    snapshot, JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class)),
                snapshot.publishedAt(),
                end));
  }

  private static Optional<Long> nextPublication(
      PublishedSnapshotRecord snapshot, List<PublishedSnapshotRecord> published) {
    return published.stream()
        .filter(other -> other.publicationSequence() > snapshot.publicationSequence())
        .map(PublishedSnapshotRecord::publishedAt)
        .findFirst();
  }

  boolean coversBinding(Long activatedAt, Long retiredAt) {
    return (activatedAt == null || activatedAt <= appliedUntil)
        && (retiredAt == null || retiredAt > appliedFrom);
  }
}
