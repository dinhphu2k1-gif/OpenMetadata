/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

/**
 * Cancels a mistaken declaration (TDX-06): a record whose working version is Draft and that was
 * never Approved in any catalog version is removed with its identity, relationships and source
 * state in one transaction, then its search document is removed.
 */
public class TechnicalRecordDeletion {

  public void delete(UUID termId, String parentBusinessVersion) {
    final Glossary technical = TechnicalCatalog.requireGlossary();
    final RecordIdentity identity = requireIdentity(technical, termId, parentBusinessVersion);
    final String fullyQualifiedName = identityFqn(termId);
    Entity.getJdbi().useTransaction(handle -> deleteDraft(handle, technical.getId(), identity));
    EntityRepository.invalidateCacheForEntity(GLOSSARY_TERM, termId, fullyQualifiedName);
    TechnicalIndexSync.refresh(termId);
  }

  private static RecordIdentity requireIdentity(
      Glossary technical, UUID termId, String parentBusinessVersion) {
    return Entity.getJdbi()
        .onDemand(TechnicalSourceStateDAO.class)
        .listRecordsByIds(TechnicalCatalog.recordHashPrefix(technical), List.of(termId.toString()))
        .stream()
        .filter(identity -> parentBusinessVersion.equals(identity.parentBusinessVersion()))
        .findFirst()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.notFound(
                    TechnicalDictionaryErrors.DRAFT_NOT_DELETABLE,
                    String.format(
                        "Technical Dictionary record %s was not found in version %s",
                        termId, parentBusinessVersion)));
  }

  private static String identityFqn(UUID termId) {
    final GlossaryTerm identity =
        Entity.getJdbi()
            .onDemand(CollectionDAO.class)
            .glossaryTermDAO()
            .findEntityById(termId, Include.ALL);
    return identity == null ? null : identity.getFullyQualifiedName();
  }

  private static void deleteDraft(Handle handle, UUID glossaryId, RecordIdentity identity) {
    final GlossaryVersionDAO versions = handle.attach(GlossaryVersionDAO.class);
    final WorkingVersionRecord working =
        versions.lockWorking(GLOSSARY_TERM, identity.termId(), identity.parentBusinessVersion());
    requireDeletable(working, versions.listPublished(GLOSSARY_TERM, identity.termId()));
    if (versions.deleteWorking(
            GLOSSARY_TERM, identity.termId(), identity.parentBusinessVersion(), working.revision())
        != 1) {
      throw notDeletable("The record changed while it was being deleted");
    }
    final CollectionDAO collection = handle.attach(CollectionDAO.class);
    collection.relationshipDAO().deleteAll(identity.termId(), GLOSSARY_TERM);
    collection.glossaryTermDAO().delete(identity.termId());
    handle
        .attach(TechnicalSourceStateDAO.class)
        .deleteState(glossaryId, identity.parentBusinessVersion(), identity.columnKey());
  }

  static void requireDeletable(WorkingVersionRecord working, List<PublishedSnapshotRecord> published) {
    if (working == null || !EntityStatus.DRAFT.value().equals(working.entityStatus())) {
      throw notDeletable("Only a Draft record can be deleted");
    }
    if (!published.isEmpty()) {
      throw notDeletable("A record that was Approved in any version cannot be deleted");
    }
  }

  private static RuntimeException notDeletable(String message) {
    return TechnicalDictionaryErrors.conflict(TechnicalDictionaryErrors.DRAFT_NOT_DELETABLE, message);
  }
}
