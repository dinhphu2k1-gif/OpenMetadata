/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.NotFoundException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityVersionContext;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Resolves the CDE reference of a Technical Dictionary record. A record of catalog version N may
 * only reference a CDE of Data Dictionary version N; new references require Data Dictionary N to
 * be the active Approved version.
 */
public class TechnicalCdeReferenceResolver {
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  /**
   * Normalizes the requested relation of a Save Draft. An unchanged relation is kept as is so that
   * historical references survive a Data Dictionary cutover; a new relation must target an active
   * Approved CDE of the same version.
   */
  public List<TermRelation> resolveForDraft(List<TermRelation> requested, GlossaryTerm current) {
    final List<TermRelation> result;
    if (nullOrEmpty(requested)) {
      result = List.of();
    } else if (isSameCde(requested, current.getRelatedTerms())) {
      result = current.getRelatedTerms();
    } else {
      final String scope = current.getParentBusinessVersion();
      requireActiveDataDictionary(scope);
      result = List.of(relationTo(requireActiveCde(cdeId(requested), scope), scope));
    }
    return result;
  }

  /** Verifies at Submit/Approve that the referenced CDE still belongs to the record's version. */
  public void requireInScope(GlossaryTerm payload) {
    if (!nullOrEmpty(payload.getRelatedTerms())) {
      final String scope = payload.getParentBusinessVersion();
      final EntityVersionContext context = payload.getRelatedTerms().getFirst().getVersionContext();
      if (context == null || !scope.equals(context.getParentBusinessVersion())) {
        throw mismatch(scope);
      }
      latestInScope(cdeId(payload.getRelatedTerms()), scope);
    }
  }

  /** Active Approved CDEs of Data Dictionary version `scope`, keyed by lowercase code. */
  public Map<String, PublishedSnapshotRecord> activeCdesByCode(String scope) {
    requireActiveDataDictionary(scope);
    final Map<String, PublishedSnapshotRecord> byCode = new HashMap<>();
    Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listActiveLatestTermsForGlossaryAndParent(dataDictionary().getId(), scope)
        .forEach(
            snapshot ->
                byCode.put(
                    JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class)
                        .getName()
                        .toLowerCase(Locale.ROOT),
                    snapshot));
    return byCode;
  }

  private void requireActiveDataDictionary(String scope) {
    PublishedSnapshotRecord active = null;
    try {
      active =
          versioningService.getLatestPublished(
              GlossaryVersioningService.GLOSSARY, dataDictionary().getId());
    } catch (NotFoundException exception) {
      active = null;
    }
    if (active == null || active.archivedAt() != null || !scope.equals(active.businessVersion())) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.CDE_SCOPE_NOT_ACTIVE,
          String.format("Data Dictionary version %s is not the active Approved version", scope));
    }
  }

  private PublishedSnapshotRecord requireActiveCde(UUID cdeId, String scope) {
    final PublishedSnapshotRecord snapshot = latestInScope(cdeId, scope);
    if (snapshot.archivedAt() != null || !dataDictionary().getId().equals(snapshot.glossaryId())) {
      throw mismatch(scope);
    }
    return snapshot;
  }

  private PublishedSnapshotRecord latestInScope(UUID cdeId, String scope) {
    PublishedSnapshotRecord snapshot = null;
    try {
      snapshot = versioningService.getLatestPublishedInScope(GLOSSARY_TERM, cdeId, scope);
    } catch (NotFoundException exception) {
      throw mismatch(scope);
    }
    return snapshot;
  }

  static TermRelation relationTo(PublishedSnapshotRecord snapshot, String scope) {
    final GlossaryTerm cde = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
    return new TermRelation()
        .withTerm(
            new EntityReference()
                .withId(snapshot.entityId())
                .withType(GLOSSARY_TERM)
                .withName(cde.getName())
                .withDisplayName(cde.getDisplayName())
                .withFullyQualifiedName(cde.getFullyQualifiedName()))
        .withVersionContext(
            new EntityVersionContext()
                .withParentBusinessVersion(scope)
                .withBusinessVersion(snapshot.businessVersion())
                .withSnapshotId(snapshot.snapshotId()));
  }

  private static boolean isSameCde(List<TermRelation> requested, List<TermRelation> current) {
    return !nullOrEmpty(current) && Objects.equals(cdeId(requested), cdeId(current));
  }

  private static UUID cdeId(List<TermRelation> relations) {
    final EntityReference term = relations.getFirst().getTerm();
    if (term == null || term.getId() == null) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "A CDE reference must provide the CDE id");
    }
    return term.getId();
  }

  private static Glossary dataDictionary() {
    try {
      return Entity.getJdbi()
          .onDemand(CollectionDAO.class)
          .glossaryDAO()
          .findEntityByName(
              FullyQualifiedName.quoteName(DataDictionaryResolver.DATA_DICTIONARY_NAME),
              Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.CDE_SCOPE_NOT_ACTIVE,
          "Data Dictionary has not been initialized");
    }
  }

  private static RuntimeException mismatch(String scope) {
    return TechnicalDictionaryErrors.badRequest(
        TechnicalDictionaryErrors.CDE_SCOPE_MISMATCH,
        String.format("The CDE is not an Approved element of Data Dictionary version %s", scope));
  }
}
