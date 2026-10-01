/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.NotFoundException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * Checks that a CDE may be assigned to a Technical Dictionary record: it must be an element of the
 * Data Dictionary version the Technical Dictionary is bound to and have an Approved, not archived
 * version there.
 */
public class TechnicalCdeReferenceResolver {
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  /** The newest Approved representation of the CDE in the bound version, or an error. */
  public TechnicalCdeInfo requireAssignable(UUID cdeId, String dataDictionaryVersion) {
    return TechnicalCdeInfo.of(requireActiveCde(cdeId, dataDictionaryVersion));
  }

  /** Active Approved CDEs of Data Dictionary version {@code scope}, keyed by lowercase code. */
  public Map<String, PublishedSnapshotRecord> activeCdesByCode(String scope) {
    final Map<String, PublishedSnapshotRecord> byCode = new HashMap<>();
    Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listActiveLatestTermsForGlossaryAndParent(
            TechnicalDictionaryState.dataDictionary().getId(), scope)
        .forEach(
            snapshot ->
                byCode.put(
                    JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class)
                        .getName()
                        .toLowerCase(Locale.ROOT),
                    snapshot));
    return byCode;
  }

  /**
   * The snapshot lookup is scoped to the Data Dictionary version, so a CDE of another version is
   * simply not found; the glossary check rejects a term that is not a Data Dictionary element.
   */
  private PublishedSnapshotRecord requireActiveCde(UUID cdeId, String scope) {
    PublishedSnapshotRecord snapshot = null;
    try {
      snapshot = versioningService.getLatestPublishedInScope(GLOSSARY_TERM, cdeId, scope);
    } catch (NotFoundException exception) {
      throw notActive(scope);
    }
    if (snapshot.archivedAt() != null
        || !TechnicalDictionaryState.dataDictionary().getId().equals(snapshot.glossaryId())) {
      throw notActive(scope);
    }
    return snapshot;
  }

  private static RuntimeException notActive(String scope) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.CDE_SCOPE_NOT_ACTIVE,
        String.format(
            "The CDE is not an Approved element of the active Data Dictionary version %s", scope));
  }
}
