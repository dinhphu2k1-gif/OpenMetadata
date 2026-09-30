/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.NotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/** Resolves the Technical Dictionary glossary identity and its open scopes. */
public final class TechnicalCatalog {
  public static final String SYSTEM_ACTOR = Entity.ADMIN_USER_NAME;

  private TechnicalCatalog() {}

  public static Optional<Glossary> findGlossary() {
    Glossary glossary = null;
    try {
      glossary =
          Entity.getJdbi()
              .onDemand(CollectionDAO.class)
              .glossaryDAO()
              .findEntityByName(
                  FullyQualifiedName.quoteName(
                      GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY.glossaryName()),
                  Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      glossary = null;
    }
    return Optional.ofNullable(glossary);
  }

  public static boolean isTechnicalGlossary(UUID glossaryId) {
    return glossaryId != null
        && findGlossary().map(glossary -> glossary.getId().equals(glossaryId)).orElse(false);
  }

  public static Glossary requireGlossary() {
    return findGlossary()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.conflict(
                    TechnicalDictionaryErrors.NOT_INITIALIZED,
                    "Technical Dictionary glossary has not been initialized"));
  }

  /** Hash prefix matching every record identity FQN below the glossary. */
  public static String recordHashPrefix(Glossary technical) {
    return FullyQualifiedName.buildHash(technical.getFullyQualifiedName()) + ".%";
  }

  /** Catalog versions that still accept records: the working version and the active one. */
  public static List<String> openScopes(UUID glossaryId) {
    final GlossaryVersioningService versions = new GlossaryVersioningService();
    final List<String> scopes = new ArrayList<>();
    workingVersion(versions, glossaryId).ifPresent(scopes::add);
    activeVersion(versions, glossaryId)
        .filter(version -> !scopes.contains(version))
        .ifPresent(scopes::add);
    return List.copyOf(scopes);
  }

  private static Optional<String> workingVersion(
      GlossaryVersioningService versions, UUID glossaryId) {
    String version = null;
    try {
      version =
          versions.getWorking(GlossaryVersioningService.GLOSSARY, glossaryId).businessVersion();
    } catch (NotFoundException exception) {
      version = null;
    }
    return Optional.ofNullable(version);
  }

  private static Optional<String> activeVersion(
      GlossaryVersioningService versions, UUID glossaryId) {
    String version = null;
    try {
      final PublishedSnapshotRecord latest =
          versions.getLatestPublished(GlossaryVersioningService.GLOSSARY, glossaryId);
      version = latest.archivedAt() == null ? latest.businessVersion() : null;
    } catch (NotFoundException exception) {
      version = null;
    }
    return Optional.ofNullable(version);
  }
}
