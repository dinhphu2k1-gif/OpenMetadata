/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.NotFoundException;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.StateRow;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The Data Dictionary version the Technical Dictionary is bound to. The stored value is changed
 * only by the Data Dictionary cutover transaction; the live Data Dictionary head is consulted as
 * well so a revoked or replaced version is never treated as active.
 */
@Slf4j
public final class TechnicalDictionaryState {
  private TechnicalDictionaryState() {}

  public static StateRow row() {
    return dao().findState();
  }

  /** Version bound to the Technical Dictionary that is also the active Approved Data Dictionary. */
  public static Optional<String> activeVersion() {
    final String bound = row().dataDictionaryVersion();
    return Optional.ofNullable(bound).filter(version -> isActiveDataDictionary(version));
  }

  /** Same as {@link #activeVersion()}, for a value already read under the state lock. */
  public static String requireActiveVersion(StateRow locked) {
    final String bound = locked.dataDictionaryVersion();
    if (bound == null || !isActiveDataDictionary(bound)) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.DATA_DICTIONARY_NOT_ACTIVE,
          "There is no active Approved Data Dictionary version to bind the Technical Dictionary to");
    }
    return bound;
  }

  /** Binds an environment that already has an Approved Data Dictionary but no bound version. */
  public static void syncWithDataDictionary() {
    final String bound = row().dataDictionaryVersion();
    final Optional<String> live = liveVersion();
    if (bound == null && live.isPresent()) {
      dao().setActiveVersion(live.get());
      LOG.info("Technical Dictionary bound to Data Dictionary version {}", live.get());
    }
  }

  /** Version of the latest Approved, not archived Data Dictionary, if any. */
  public static Optional<String> liveVersion() {
    Optional<String> version = Optional.empty();
    try {
      final PublishedSnapshotRecord head =
          new GlossaryVersioningService()
              .getLatestPublished(GlossaryVersioningService.GLOSSARY, dataDictionary().getId());
      version = head.archivedAt() == null ? Optional.of(head.businessVersion()) : Optional.empty();
    } catch (NotFoundException | EntityNotFoundException exception) {
      version = Optional.empty();
    }
    return version;
  }

  public static Glossary dataDictionary() {
    return Entity.getJdbi()
        .onDemand(CollectionDAO.class)
        .glossaryDAO()
        .findEntityByName(
            FullyQualifiedName.quoteName(DataDictionaryResolver.DATA_DICTIONARY_NAME),
            Include.NON_DELETED);
  }

  private static boolean isActiveDataDictionary(String version) {
    return liveVersion().map(version::equals).orElse(false);
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
