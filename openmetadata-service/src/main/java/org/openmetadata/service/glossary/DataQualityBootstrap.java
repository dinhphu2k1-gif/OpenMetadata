/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.util.ArrayList;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/** Creates the system-owned Data Quality governed glossary on a clean environment. */
public final class DataQualityBootstrap {
  public static final String DISPLAY_NAME = "Chất lượng dữ liệu";
  private static final String INITIAL_VERSION = "1";

  private DataQualityBootstrap() {}

  public static void initialize() {
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              CollectionDAO collectionDAO = handle.attach(CollectionDAO.class);
              GlossaryVersionDAO versionDAO = handle.attach(GlossaryVersionDAO.class);
              Glossary existing = findIdentity(collectionDAO);
              if (existing != null) {
                return;
              }

              long now = System.currentTimeMillis();
              UUID id = UUID.randomUUID();
              String name = GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY.glossaryName();
              Glossary glossary =
                  new Glossary()
                      .withId(id)
                      .withName(name)
                      .withFullyQualifiedName(name)
                      .withDisplayName(DISPLAY_NAME)
                      .withDescription(DISPLAY_NAME)
                      .withVersion(0.1)
                      .withVersioningMode(Glossary.VersioningMode.BUSINESS_WORKFLOW)
                      .withEntityStatus(EntityStatus.DRAFT)
                      .withProvider(ProviderType.SYSTEM)
                      .withMutuallyExclusive(false)
                      .withDeleted(false)
                      .withUpdatedAt(now)
                      .withUpdatedBy(ADMIN_USER_NAME)
                      .withTermRevisions(new ArrayList<>());
              collectionDAO.glossaryDAO().insert(glossary, glossary.getFullyQualifiedName());

              Glossary payload =
                  JsonUtils.readValue(JsonUtils.pojoToJson(glossary), Glossary.class);
              payload.withBusinessVersion(INITIAL_VERSION).withWorkingRevision(null);
              versionDAO.insertWorking(
                  UUID.randomUUID(),
                  "glossary",
                  id,
                  null,
                  INITIAL_VERSION,
                  EntityStatus.DRAFT.value(),
                  glossary.getVersion(),
                  JsonUtils.pojoToJson(payload),
                  now,
                  ADMIN_USER_NAME);
            });
  }

  private static Glossary findIdentity(CollectionDAO dao) {
    try {
      String name = GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY.glossaryName();
      return dao.glossaryDAO().findEntityByName(FullyQualifiedName.quoteName(name), Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }
}
