/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/**
 * Applies a validated import plan in one database transaction. Every row re-verifies the revision
 * or published version captured by the preview, so a stale preview fails as a whole.
 */
public final class TechnicalImportCommitter {

  private final TechnicalRecordWriter writer = new TechnicalRecordWriter();

  /**
   * Returns the number of records written. Updates of existing records are atomic; Columns
   * declared by the file are created afterwards, each in its own transaction. Every record written
   * is synchronized to the Technical Dictionary index, even when a later declaration fails.
   */
  public int commit(UUID glossaryId, String scope, List<PlannedRow> rows, String actor) {
    final List<PlannedRow> updates =
        rows.stream()
            .filter(PlannedRow::mutates)
            .filter(row -> !isDeclaration(row))
            .sorted(Comparator.comparing(row -> row.termId().toString()))
            .toList();
    final List<PlannedRow> declarations = rows.stream().filter(this::isDeclaration).toList();
    final List<UUID> written = new ArrayList<>();
    try {
      updateAtomically(glossaryId, scope, updates, actor);
      updates.forEach(row -> written.add(row.termId()));
      declarations.forEach(row -> written.add(declare(scope, row, actor)));
    } finally {
      TechnicalIndexSync.refresh(written);
    }
    return updates.size() + declarations.size();
  }

  private boolean isDeclaration(PlannedRow row) {
    return TechnicalImportPlan.CREATE_RECORD.equals(row.action());
  }

  private void updateAtomically(
      UUID glossaryId, String scope, List<PlannedRow> updates, String actor) {
    try {
      Entity.getJdbi()
          .useTransaction(
              handle -> {
                final GlossaryVersionDAO versions = handle.attach(GlossaryVersionDAO.class);
                if (versions.lockGlossaryIdentity(glossaryId) == null) {
                  throw conflict("Technical Dictionary identity was not found");
                }
                for (PlannedRow row : updates) {
                  write(versions, glossaryId, scope, row, actor);
                }
              });
    } catch (UnableToExecuteStatementException exception) {
      throw conflict("A record was changed concurrently while the import was committing");
    }
  }

  private UUID declare(String scope, PlannedRow row, String actor) {
    final UUID created =
        writer.createDraft(
            TechnicalCatalog.requireGlossary(),
            scope,
            row.column(),
            term -> TechnicalImportPatch.apply(term, row.patch()),
            actor);
    if (created == null) {
      throw conflict("Column " + row.location() + " was declared by another user after the preview");
    }
    return created;
  }

  private void write(
      GlossaryVersionDAO versions, UUID glossaryId, String scope, PlannedRow row, String actor) {
    if (TechnicalImportPlan.CREATE_VERSION.equals(row.action())) {
      createVersion(versions, glossaryId, scope, row, actor);
    } else {
      updateWorking(versions, scope, row, actor);
    }
  }

  private void updateWorking(
      GlossaryVersionDAO versions, String scope, PlannedRow row, String actor) {
    final WorkingVersionRecord current = versions.lockWorking(GLOSSARY_TERM, row.termId(), scope);
    if (current == null
        || current.revision() != row.expectedRevision()
        || !expectedStatus(row).value().equals(current.entityStatus())) {
      throw conflict("Record " + row.location() + " changed after the preview");
    }
    final GlossaryTerm payload =
        TechnicalImportPatch.apply(
            JsonUtils.readValue(current.payload(), GlossaryTerm.class), row.patch());
    final int updated =
        versions.updateWorking(
            GLOSSARY_TERM,
            row.termId(),
            scope,
            row.expectedRevision(),
            EntityStatus.DRAFT.value(),
            current.nativeVersion(),
            JsonUtils.pojoToJson(payload),
            System.currentTimeMillis(),
            actor);
    if (updated != 1) {
      throw conflict("Record " + row.location() + " changed while the import was committing");
    }
  }

  private void createVersion(
      GlossaryVersionDAO versions, UUID glossaryId, String scope, PlannedRow row, String actor) {
    final PublishedSnapshotRecord latest =
        versions.lockLatestPublishedByParent(GLOSSARY_TERM, row.termId(), scope);
    if (versions.lockWorking(GLOSSARY_TERM, row.termId(), scope) != null
        || latest == null
        || !latest.businessVersion().equals(row.expectedPublishedVersion())) {
      throw conflict("Record " + row.location() + " changed after the preview");
    }
    final GlossaryTerm payload =
        TechnicalImportPatch.apply(
            GlossaryVersioningService.nextDraftFromPublished(
                latest.payload(), row.newBusinessVersion(), scope),
            row.patch());
    versions.insertWorking(
        UUID.randomUUID(),
        GLOSSARY_TERM,
        row.termId(),
        glossaryId,
        scope,
        row.newBusinessVersion(),
        EntityStatus.DRAFT.value(),
        latest.nativeVersion(),
        JsonUtils.pojoToJson(payload),
        System.currentTimeMillis(),
        actor);
  }

  private static EntityStatus expectedStatus(PlannedRow row) {
    return switch (row.action()) {
      case TechnicalImportPlan.REPLACE_IN_REVIEW_AND_REOPEN -> EntityStatus.IN_REVIEW;
      case TechnicalImportPlan.REPLACE_REJECTED_AND_REOPEN -> EntityStatus.REJECTED;
      default -> EntityStatus.DRAFT;
    };
  }

  private static RuntimeException conflict(String message) {
    return TechnicalDictionaryErrors.conflict(TechnicalDictionaryErrors.IMPORT_CONFLICT, message);
  }
}
