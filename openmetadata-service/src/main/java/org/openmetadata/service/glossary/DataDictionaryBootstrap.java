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
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/** Atomically creates the one system-owned Data Dictionary and its initial working draft. */
public final class DataDictionaryBootstrap {
  public static final String DISPLAY_NAME = "Từ điển dữ liệu dùng chung";
  private static final String INITIAL_VERSION = "1.0";

  private DataDictionaryBootstrap() {}

  public static void initialize() {
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              CollectionDAO collectionDAO = handle.attach(CollectionDAO.class);
              GlossaryVersionDAO versionDAO = handle.attach(GlossaryVersionDAO.class);
              Glossary identity = findIdentity(collectionDAO);
              WorkingVersionRecord working = findDataDictionaryWorking(versionDAO);

              // A deleted identity is intentional. Restore behavior belongs to F16.
              if (identity != null && Boolean.TRUE.equals(identity.getDeleted())) {
                return;
              }
              if ((identity == null) != (working == null)) {
                throw inconsistent(identity == null ? "working record only" : "identity only");
              }
              if (identity != null) {
                if (!identity.getId().equals(working.entityId())) {
                  throw inconsistent("identity and working record IDs do not match");
                }
                return;
              }

              long now = System.currentTimeMillis();
              UUID id = UUID.randomUUID();
              Glossary glossary =
                  new Glossary()
                      .withId(id)
                      .withName(DataDictionaryResolver.DATA_DICTIONARY_NAME)
                      .withFullyQualifiedName(DataDictionaryResolver.DATA_DICTIONARY_NAME)
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
  }

  private static Glossary findIdentity(CollectionDAO dao) {
    try {
      return dao.glossaryDAO().findEntityByName(
          FullyQualifiedName.quoteName(DataDictionaryResolver.DATA_DICTIONARY_NAME), Include.ALL);
    } catch (EntityNotFoundException ignored) {
      return null;
    }
  }

  private static WorkingVersionRecord findDataDictionaryWorking(GlossaryVersionDAO dao) {
    WorkingVersionRecord found = null;
    for (WorkingVersionRecord record : dao.listWorking("glossary")) {
      Glossary payload = JsonUtils.readValue(record.payload(), Glossary.class);
      if (DataDictionaryResolver.DATA_DICTIONARY_NAME.equals(payload.getName())) {
        if (found != null) {
          throw inconsistent("multiple working records");
        }
        found = record;
      }
    }
    return found;
  }

  private static IllegalStateException inconsistent(String detail) {
    return new IllegalStateException(
        "Data Dictionary bootstrap is inconsistent (" + detail + "); refusing automatic repair");
  }
}
