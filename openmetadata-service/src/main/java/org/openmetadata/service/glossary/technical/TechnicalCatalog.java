/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.Optional;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Resolves the `Technical Dictionary` glossary. It holds no terms: it is only the target of the
 * policies that decide who may view and edit the Technical Dictionary.
 */
public final class TechnicalCatalog {
  public static final String GLOSSARY_NAME = "Technical Dictionary";
  public static final String SYSTEM_ACTOR = Entity.ADMIN_USER_NAME;

  private TechnicalCatalog() {}

  public static Optional<Glossary> findGlossary() {
    Glossary glossary = null;
    try {
      glossary =
          Entity.getJdbi()
              .onDemand(CollectionDAO.class)
              .glossaryDAO()
              .findEntityByName(FullyQualifiedName.quoteName(GLOSSARY_NAME), Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      glossary = null;
    }
    return Optional.ofNullable(glossary);
  }

  public static Glossary requireGlossary() {
    return findGlossary()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.conflict(
                    TechnicalDictionaryErrors.NOT_INITIALIZED,
                    "Technical Dictionary glossary has not been initialized"));
  }
}
