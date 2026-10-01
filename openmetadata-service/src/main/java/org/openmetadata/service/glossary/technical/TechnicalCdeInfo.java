/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * Display data of the CDE a Technical Dictionary record references: code, name, business version,
 * FQN (the Column tag) and data owners of its newest Approved version in the bound Data Dictionary
 * version. Always resolved live from the CDE identity, so it follows the CDE's current version even
 * when the record itself was not saved again.
 */
public record TechnicalCdeInfo(
    String id,
    String code,
    String name,
    String businessVersion,
    String fullyQualifiedName,
    List<EntityReference> owners) {
  public static final TechnicalCdeInfo NONE = new TechnicalCdeInfo("", "", "", "", "", List.of());

  public TechnicalCdeInfo {
    owners = List.copyOf(owners);
  }

  public boolean isPresent() {
    return !id.isEmpty();
  }

  public static TechnicalCdeInfo resolve(UUID cdeId, String dataDictionaryVersion) {
    TechnicalCdeInfo info = NONE;
    try {
      final PublishedSnapshotRecord snapshot =
          new GlossaryVersioningService()
              .getLatestPublishedInScope(GLOSSARY_TERM, cdeId, dataDictionaryVersion);
      info = of(snapshot);
    } catch (NotFoundException exception) {
      info = NONE;
    }
    return info;
  }

  public static TechnicalCdeInfo of(PublishedSnapshotRecord snapshot) {
    final GlossaryTerm cde = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
    return new TechnicalCdeInfo(
        snapshot.entityId().toString(),
        Objects.toString(cde.getName(), ""),
        Objects.toString(cde.getDisplayName(), ""),
        Objects.toString(snapshot.businessVersion(), ""),
        Objects.toString(cde.getFullyQualifiedName(), ""),
        listOrEmpty(cde.getOwners()));
  }
}
