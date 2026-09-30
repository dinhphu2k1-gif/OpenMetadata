/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.util.ArrayList;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.handlers.TechnicalDictionaryColumnHandler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryProperties;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexRebuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/** Creates the system-owned Technical Dictionary governed glossary on a clean environment. */
@Slf4j
public final class TechnicalDictionaryBootstrap {
  public static final String DISPLAY_NAME = "Từ điển kỹ thuật";
  private static final String INITIAL_VERSION = "1";

  private TechnicalDictionaryBootstrap() {}

  public static void initialize() {
    TechnicalDictionaryProperties.ensureRegistered();
    createIdentity();
    final EntityLifecycleEventDispatcher dispatcher = EntityLifecycleEventDispatcher.getInstance();
    dispatcher.unregisterHandler(TechnicalDictionaryColumnHandler.HANDLER_NAME);
    dispatcher.registerHandler(new TechnicalDictionaryColumnHandler());
    initializeIndex();
  }

  private static void initializeIndex() {
    try {
      TechnicalIndexRebuilder.ensureIndex();
      TechnicalIndexSync.drainPending();
    } catch (RuntimeException exception) {
      // The derived search index must not prevent startup; reads report TD_INDEX_UNAVAILABLE and
      // the outbox worker retries.
      LOG.error("Technical Dictionary search index could not be initialized", exception);
    }
    TechnicalIndexSync.startWorker();
  }

  private static void createIdentity() {
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
              String name =
                  GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY.glossaryName();
              Glossary glossary =
                  new Glossary()
                      .withId(id)
                      .withName(name)
                      .withFullyQualifiedName(name)
                      .withDisplayName(DISPLAY_NAME)
                      .withDescription(
                          "Danh mục các trường kỹ thuật và liên kết phiên bản chính xác tới CDE")
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
      String name = GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY.glossaryName();
      return dao.glossaryDAO().findEntityByName(FullyQualifiedName.quoteName(name), Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }
}
