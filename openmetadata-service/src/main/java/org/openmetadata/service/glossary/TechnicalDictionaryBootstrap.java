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
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.handlers.TechnicalDictionaryColumnHandler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.glossary.technical.TechnicalOutbox;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexRebuilder;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/** Creates the system-owned Technical Dictionary governed glossary on a clean environment. */
@Slf4j
public final class TechnicalDictionaryBootstrap {
  public static final String DISPLAY_NAME = "Từ điển kỹ thuật";

  private TechnicalDictionaryBootstrap() {}

  public static void initialize() {
    createIdentity();
    bindToDataDictionary();
    final EntityLifecycleEventDispatcher dispatcher = EntityLifecycleEventDispatcher.getInstance();
    dispatcher.unregisterHandler(TechnicalDictionaryColumnHandler.HANDLER_NAME);
    dispatcher.registerHandler(new TechnicalDictionaryColumnHandler());
    initializeIndex();
  }

  private static void initializeIndex() {
    try {
      TechnicalIndexRebuilder.ensureIndex();
      TechnicalOutbox.drainPending();
    } catch (RuntimeException exception) {
      // The derived search index must not prevent startup; reads report TD_INDEX_UNAVAILABLE and
      // the outbox worker retries.
      LOG.error("Technical Dictionary search index could not be initialized", exception);
    }
    TechnicalOutbox.startWorker();
  }

  private static void bindToDataDictionary() {
    try {
      TechnicalDictionaryState.syncWithDataDictionary();
    } catch (RuntimeException exception) {
      LOG.warn("Technical Dictionary could not be bound to the Data Dictionary", exception);
    }
  }

  private static void createIdentity() {
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              CollectionDAO collectionDAO = handle.attach(CollectionDAO.class);
              Glossary existing = findIdentity(collectionDAO);
              if (existing != null) {
                return;
              }

              long now = System.currentTimeMillis();
              UUID id = UUID.randomUUID();
              String name = TechnicalCatalog.GLOSSARY_NAME;
              Glossary glossary =
                  new Glossary()
                      .withId(id)
                      .withName(name)
                      .withFullyQualifiedName(name)
                      .withDisplayName(DISPLAY_NAME)
                      .withDescription(
                          "Từ điển kỹ thuật: các cột vật lý được gán với CDE của Từ điển dữ liệu dùng chung đang hiệu lực")
                      .withVersion(0.1)
                      .withEntityStatus(EntityStatus.DRAFT)
                      .withProvider(ProviderType.SYSTEM)
                      .withMutuallyExclusive(false)
                      .withDeleted(false)
                      .withUpdatedAt(now)
                      .withUpdatedBy(ADMIN_USER_NAME)
                      .withTermRevisions(new ArrayList<>());
              collectionDAO.glossaryDAO().insert(glossary, glossary.getFullyQualifiedName());
            });
  }

  private static Glossary findIdentity(CollectionDAO dao) {
    try {
      String name = TechnicalCatalog.GLOSSARY_NAME;
      return dao.glossaryDAO().findEntityByName(FullyQualifiedName.quoteName(name), Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }
}
