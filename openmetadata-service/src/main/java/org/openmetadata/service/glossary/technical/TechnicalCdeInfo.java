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

/**
 * Display data of the CDE referenced by a Technical Dictionary record: code, name and data owners
 * of its newest Approved version in the record's catalog version.
 */
public record TechnicalCdeInfo(String code, String name, List<EntityReference> owners) {
  public static final TechnicalCdeInfo NONE = new TechnicalCdeInfo("", "", List.of());

  public TechnicalCdeInfo {
    owners = List.copyOf(owners);
  }

  public static TechnicalCdeInfo resolve(UUID cdeId, String parentBusinessVersion) {
    TechnicalCdeInfo info = NONE;
    try {
      info =
          of(
              JsonUtils.readValue(
                  new GlossaryVersioningService()
                      .getLatestPublishedInScope(GLOSSARY_TERM, cdeId, parentBusinessVersion)
                      .payload(),
                  GlossaryTerm.class));
    } catch (NotFoundException exception) {
      info = NONE;
    }
    return info;
  }

  static TechnicalCdeInfo of(GlossaryTerm cde) {
    return new TechnicalCdeInfo(
        Objects.toString(cde.getName(), ""),
        Objects.toString(cde.getDisplayName(), ""),
        listOrEmpty(cde.getOwners()));
  }
}
