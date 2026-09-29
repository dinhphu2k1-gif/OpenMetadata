/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.NotFoundException;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;

/** Creates and refreshes system-owned Technical Dictionary records for physical Columns. */
public class TechnicalRecordWriter {
  private static final String INTEGRITY_CONSTRAINT_STATE_PREFIX = "23";

  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  /** Creates identity and working `N.0 Draft`; returns false when the record already exists. */
  public boolean createDraft(
      Glossary technical,
      String parentBusinessVersion,
      TechnicalColumnSource column,
      String actor) {
    boolean created = true;
    try {
      repository()
          .createInitialDraft(
              newTerm(technical, parentBusinessVersion, column), parentBusinessVersion, actor);
    } catch (UnableToExecuteStatementException exception) {
      if (!isConstraintViolation(exception)) {
        throw exception;
      }
      created = false;
    }
    return created;
  }

  /**
   * Refreshes the source snapshot of a Draft working version. Returns true when the record is in
   * sync afterwards, false when there is no Draft to refresh.
   */
  public boolean refreshDraftSource(
      UUID termId, String parentBusinessVersion, TechnicalColumnSource column, String actor) {
    final WorkingVersionRecord working = findWorking(termId, parentBusinessVersion);
    final boolean isDraft =
        working != null && EntityStatus.DRAFT.value().equals(working.entityStatus());
    if (isDraft && !isInSync(working.payload(), column)) {
      versioningService.saveWorking(
          GlossaryVersioningService.GLOSSARY_TERM,
          termId,
          parentBusinessVersion,
          working.revision(),
          working.nativeVersion(),
          withSource(JsonUtils.readValue(working.payload(), GlossaryTerm.class), column),
          actor);
    }
    return isDraft;
  }

  /**
   * True when the current representation in scope (working if any, otherwise the latest published
   * snapshot) carries the given Column snapshot.
   */
  public boolean isRepresentationInSync(
      UUID termId, String parentBusinessVersion, TechnicalColumnSource column) {
    final WorkingVersionRecord working = findWorking(termId, parentBusinessVersion);
    return working != null
        ? isInSync(working.payload(), column)
        : isPublishedInSync(termId, parentBusinessVersion, column);
  }

  private boolean isPublishedInSync(
      UUID termId, String parentBusinessVersion, TechnicalColumnSource column) {
    boolean inSync = true;
    try {
      final PublishedSnapshotRecord published =
          versioningService.getLatestPublishedInScope(GLOSSARY_TERM, termId, parentBusinessVersion);
      inSync = isInSync(published.payload(), column);
    } catch (NotFoundException exception) {
      inSync = true;
    }
    return inSync;
  }

  public static GlossaryTerm withSource(GlossaryTerm payload, TechnicalColumnSource column) {
    final Map<String, Object> extension =
        TechnicalRecordValidator.extension(payload.getExtension());
    TechnicalDictionaryProfile.SOURCE_EXTENSION_KEYS.forEach(extension::remove);
    extension.putAll(column.sourceExtension());
    return payload.withExtension(extension).withDescription(column.description());
  }

  static boolean isConstraintViolation(Throwable exception) {
    Throwable current = exception;
    boolean violation = false;
    while (current != null && !violation) {
      violation =
          current instanceof SQLException sql
              && sql.getSQLState() != null
              && sql.getSQLState().startsWith(INTEGRITY_CONSTRAINT_STATE_PREFIX);
      current = current.getCause();
    }
    return violation;
  }

  private static GlossaryTerm newTerm(
      Glossary technical, String parentBusinessVersion, TechnicalColumnSource column) {
    final GlossaryTerm term =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName(column.columnKey())
            .withDisplayName(column.columnName())
            .withGlossary(glossaryReference(technical))
            .withParentBusinessVersion(parentBusinessVersion)
            .withEntityStatus(EntityStatus.DRAFT)
            .withProvider(ProviderType.SYSTEM)
            .withDeleted(false);
    return withSource(term, column);
  }

  private static EntityReference glossaryReference(Glossary technical) {
    return new EntityReference()
        .withId(technical.getId())
        .withType(GLOSSARY)
        .withName(technical.getName())
        .withFullyQualifiedName(technical.getFullyQualifiedName());
  }

  private static boolean isInSync(String payloadJson, TechnicalColumnSource column) {
    final GlossaryTerm payload = JsonUtils.readValue(payloadJson, GlossaryTerm.class);
    return column.isSnapshotOf(
        TechnicalRecordValidator.extension(payload.getExtension()), payload.getDescription());
  }

  private WorkingVersionRecord findWorking(UUID termId, String parentBusinessVersion) {
    WorkingVersionRecord working = null;
    try {
      working = versioningService.getWorking(GLOSSARY_TERM, termId, parentBusinessVersion);
    } catch (NotFoundException exception) {
      working = null;
    }
    return working;
  }

  private static GlossaryTermRepository repository() {
    return (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
  }
}
