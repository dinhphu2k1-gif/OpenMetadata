/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.NotFoundException;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;

/**
 * Adds the derived Technical Dictionary read-model fields to authorized flat rows: operational
 * source state, the CDE code/name/owners resolved once per distinct CDE, a lowercase search text
 * and a stable sort key.
 */
public final class TechnicalRowDecorator {
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  public void decorate(List<Map<String, Object>> rows, UUID glossaryId, String scope) {
    final Map<String, String> states = TechnicalSourceStates.statusesOf(glossaryId, scope);
    final Map<String, CdeInfo> cdes = new HashMap<>();
    for (Map<String, Object> row : rows) {
      final String cdeId = TechnicalRowFields.cdeId(row);
      final CdeInfo cde =
          cdeId == null ? CdeInfo.NONE : cdes.computeIfAbsent(cdeId, id -> resolveCde(id, scope));
      row.put(
          TechnicalRowFields.SOURCE_STATUS,
          states.getOrDefault(
              String.valueOf(row.get("name")), TechnicalDictionaryProfile.SOURCE_AVAILABLE));
      row.put(TechnicalRowFields.CDE_CODE, cde.code());
      row.put(TechnicalRowFields.CDE_NAME, cde.name());
      row.put(TechnicalRowFields.DATA_OWNERS, cde.owners());
      row.put(TechnicalRowFields.SEARCH_TEXT, searchText(row, cde));
      row.put(TechnicalRowFields.SORT_KEY, sortKey(row));
    }
  }

  static String searchText(Map<String, Object> row, CdeInfo cde) {
    final StringBuilder text = new StringBuilder();
    for (String key : TechnicalDictionaryProfile.SOURCE_EXTENSION_KEYS) {
      text.append(TechnicalRowFields.extensionText(row, key)).append(' ');
    }
    text.append(cde.code()).append(' ').append(cde.name());
    return normalize(text.toString());
  }

  static String sortKey(Map<String, Object> row) {
    return normalize(
        TechnicalRowFields.extensionText(row, TechnicalDictionaryProfile.SOURCE_COLUMN_FQN));
  }

  static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  }

  private CdeInfo resolveCde(String cdeId, String scope) {
    CdeInfo info = CdeInfo.NONE;
    try {
      final GlossaryTerm cde =
          JsonUtils.readValue(
              versioningService
                  .getLatestPublishedInScope(GLOSSARY_TERM, UUID.fromString(cdeId), scope)
                  .payload(),
              GlossaryTerm.class);
      info =
          new CdeInfo(
              text(cde.getName()),
              text(cde.getDisplayName()),
              cde.getOwners() == null ? List.of() : cde.getOwners());
    } catch (NotFoundException exception) {
      info = CdeInfo.NONE;
    }
    return info;
  }

  private static String text(String value) {
    return value == null ? "" : value;
  }

  record CdeInfo(String code, String name, List<EntityReference> owners) {
    static final CdeInfo NONE = new CdeInfo("", "", List.of());
  }
}
