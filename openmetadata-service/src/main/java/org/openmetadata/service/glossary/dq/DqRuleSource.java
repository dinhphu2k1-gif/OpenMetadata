/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * The newest published snapshot of a Data Quality Rule and whether it is effective, that is
 * approved, not archived and in the scope bound to the Technical Dictionary.
 */
public record DqRuleSource(DqRuleContext context, boolean effective) {

  /** Null when the Rule was never published. */
  public static DqRuleSource load(UUID ruleId) {
    final List<PublishedSnapshotRecord> published =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .listPublished(Entity.GLOSSARY_TERM, ruleId);
    return published.stream()
        .max(Comparator.comparingLong(PublishedSnapshotRecord::publicationSequence))
        .map(DqRuleSource::of)
        .orElse(null);
  }

  /** Ids of the Rules published in the scope bound to the Technical Dictionary. */
  public static List<UUID> effectiveRuleIds() {
    final String version = TechnicalDictionaryState.activeVersion().orElse(null);
    List<UUID> ids = List.of();
    if (version != null) {
      final Glossary glossary =
          Entity.getEntityByName(
              Entity.GLOSSARY,
              GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY.glossaryName(),
              "",
              Include.NON_DELETED);
      ids =
          Entity.getJdbi()
              .onDemand(GlossaryVersionDAO.class)
              .listActiveLatestTermsForGlossaryAndParent(glossary.getId(), version)
              .stream()
              .map(PublishedSnapshotRecord::entityId)
              .toList();
    }
    return ids;
  }

  private static DqRuleSource of(PublishedSnapshotRecord snapshot) {
    final GlossaryTerm payload = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
    final boolean inScope =
        TechnicalDictionaryState.activeVersion()
            .map(snapshot.parentBusinessVersion()::equals)
            .orElse(false);
    final boolean effective = snapshot.archivedAt() == null && inScope;
    return new DqRuleSource(DqRuleContext.of(snapshot, payload), effective);
  }
}
