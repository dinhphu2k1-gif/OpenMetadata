/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.openmetadata.service.glossary.versioning.GlossaryVersioningService.GLOSSARY_TERM;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.dq.DqCatalog;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * Refuses to delete a CDE that is still referenced, so an approved deletion never leaves Technical
 * Dictionary records, Data Quality Rules, other CDEs or tagged assets pointing at a CDE that is no
 * longer effective. The references must be removed first.
 */
public final class CdeDeletionGuard {
  private static final String RELATED_TERMS = "relatedTerms";

  private CdeDeletionGuard() {}

  public static void requireNoDependents(GlossaryTerm cde, String parentBusinessVersion) {
    final List<String> dependents = new ArrayList<>();
    addCount(dependents, "Technical Dictionary records", technicalRecordCount(cde.getId()));
    addNames(
        dependents,
        "Data Quality Rules",
        referencingTermNames(dataQualityGlossaryId(), cde, parentBusinessVersion));
    addNames(
        dependents,
        "CDEs",
        referencingTermNames(cde.getGlossary().getId(), cde, parentBusinessVersion));
    addCount(dependents, "tagged assets", taggedAssetCount(cde.getFullyQualifiedName()));
    if (!dependents.isEmpty()) {
      throw new BadRequestException(
          String.format(
              "CDE '%s' cannot be deleted while it is referenced by %s",
              cde.getName(), String.join("; ", dependents)));
    }
  }

  private static int technicalRecordCount(UUID cdeId) {
    return Entity.getJdbi()
        .onDemand(TechnicalDictionaryDAO.class)
        .listIdsByCde(List.of(cdeId.toString()))
        .size();
  }

  private static int taggedAssetCount(String cdeFqn) {
    return Entity.getCollectionDAO()
        .tagUsageDAO()
        .getTagCount(TagSource.GLOSSARY.ordinal(), cdeFqn);
  }

  private static UUID dataQualityGlossaryId() {
    UUID glossaryId = null;
    try {
      glossaryId = DqCatalog.requireGlossary().getId();
    } catch (EntityNotFoundException exception) {
      // Without a Data Quality glossary there are no Rules that can reference the CDE.
    }
    return glossaryId;
  }

  /** Approved and working terms of one glossary scope whose relations point at the CDE. */
  private static List<String> referencingTermNames(
      UUID glossaryId, GlossaryTerm cde, String parentBusinessVersion) {
    final List<String> names = new ArrayList<>();
    if (glossaryId != null) {
      final GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
      Stream.concat(
              dao
                  .listActiveLatestTermsForGlossaryAndParent(glossaryId, parentBusinessVersion)
                  .stream()
                  .map(GlossaryVersionDAO.PublishedSnapshotRecord::payload),
              dao
                  .listWorkingByGlossaryAndParent(GLOSSARY_TERM, glossaryId, parentBusinessVersion)
                  .stream()
                  .map(GlossaryVersionDAO.WorkingVersionRecord::payload))
          .map(JsonUtils::readTree)
          .filter(payload -> referencesTerm(payload, cde.getId()))
          .map(payload -> payload.path("name").asText())
          .distinct()
          .forEach(names::add);
    }
    return names;
  }

  private static boolean referencesTerm(JsonNode payload, UUID termId) {
    final String id = termId.toString();
    boolean references = false;
    if (!id.equals(payload.path("id").asText())) {
      for (JsonNode relation : payload.path(RELATED_TERMS)) {
        references |= id.equals(relation.path("term").path("id").asText());
      }
    }
    return references;
  }

  private static void addCount(List<String> dependents, String label, int count) {
    if (count > 0) {
      dependents.add(String.format("%d %s", count, label));
    }
  }

  private static void addNames(List<String> dependents, String label, List<String> names) {
    if (!names.isEmpty()) {
      dependents.add(String.format("%s %s", label, String.join(", ", names)));
    }
  }
}
