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
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/** Creates the system-owned Technical Dictionary governed glossary on a clean environment. */
public final class TechnicalDictionaryBootstrap {
  public static final String DISPLAY_NAME = "Từ điển kỹ thuật";
  private static final String INITIAL_VERSION = "1";

  private TechnicalDictionaryBootstrap() {}

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

              Glossary payload = JsonUtils.readValue(JsonUtils.pojoToJson(glossary), Glossary.class);
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
    ensureInitialScopeFromLatestDataDictionaryVersion();
  }

  /** Creates the first private catalog binding and starts bootstrap on a clean environment. */
  public static synchronized void ensureInitialScope(
      UUID dataDictionaryVersionId, String actor) {
    TechnicalDictionaryService service = new TechnicalDictionaryService();
    java.util.List<org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ScopeRecord> bindings =
        service.listScopes();
    if (!bindings.isEmpty()) {
      org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ScopeRecord current = bindings.get(0);
      if ("Building".equals(current.scopeStatus())) {
        org.openmetadata.service.util.AsyncService.getInstance()
            .execute(() -> service.bootstrap(current.scopeId(), actor));
      } else {
        org.openmetadata.service.util.AsyncService.getInstance()
            .execute(() -> service.reconcile(current.scopeId(), actor));
      }
      return;
    }
    try {
      service.createScope(dataDictionaryVersionId, actor);
    } catch (jakarta.ws.rs.WebApplicationException exception) {
      // Concurrent startup/cutover can race after the empty check. The database uniqueness
      // constraint is authoritative; an existing scope means bootstrap already succeeded.
      if (service.listScopes().isEmpty()) {
        throw exception;
      }
    }
  }

  private static void ensureInitialScopeFromLatestDataDictionaryVersion() {
    CollectionDAO collectionDAO = Entity.getJdbi().onDemand(CollectionDAO.class);
    Glossary dataDictionary;
    try {
      dataDictionary =
          collectionDAO
              .glossaryDAO()
              .findEntityByName(
                  FullyQualifiedName.quoteName(DataDictionaryResolver.DATA_DICTIONARY_NAME),
                  Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return;
    }
    PublishedSnapshotRecord published =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .findLatestPublished("glossary", dataDictionary.getId());
    if (published != null && published.archivedAt() == null) {
      ensureInitialScope(published.snapshotId(), ADMIN_USER_NAME);
    }
  }

  private static Glossary findIdentity(CollectionDAO dao) {
    try {
      String name =
          GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY.glossaryName();
      return dao.glossaryDAO().findEntityByName(FullyQualifiedName.quoteName(name), Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }
}
