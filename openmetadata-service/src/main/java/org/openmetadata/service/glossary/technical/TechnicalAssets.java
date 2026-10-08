/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchService;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.SnapshotRow;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * The Columns a CDE is bound to, for the Assets tab. The binding is to the CDE identity, so every
 * version of the CDE in its Data Dictionary version shows the same list: the current records while
 * that version is active, the snapshot frozen at the cutover once it was replaced, and nothing
 * while it is still being drafted.
 */
public final class TechnicalAssets {
  public static final String CURRENT = "CURRENT";
  public static final String SNAPSHOT = "SNAPSHOT";
  public static final String NONE = "NONE";

  private TechnicalAssets() {}

  public static Map<String, Object> forCde(UUID cdeId, int limit, int offset) {
    final GlossaryTerm cde =
        Entity.getEntity(
            new EntityReference().withId(cdeId).withType(Entity.GLOSSARY_TERM), "", Include.ALL);
    final String scope = cde.getParentBusinessVersion();
    final Optional<String> active = TechnicalDictionaryState.activeVersion();
    final String source = sourceOf(scope, active);
    final Map<String, Object> result = new LinkedHashMap<>();
    result.put("source", source);
    result.put("dataDictionaryVersion", scope);
    switch (source) {
      case CURRENT -> {
        TechnicalOutbox.drainBeforeRead();
        result.putAll(new TechnicalSearchService().rowsOfCde(scope, cdeId, limit, offset));
      }
      case SNAPSHOT -> result.putAll(snapshot(cdeId, scope, limit, offset));
      default -> result.putAll(empty(limit, offset));
    }
    return result;
  }

  private static String sourceOf(String scope, Optional<String> active) {
    final boolean isActive = active.map(scope::equals).orElse(false);
    final boolean isReplaced =
        active.map(version -> GlossaryBusinessVersion.compare(scope, version) < 0).orElse(false);
    final boolean wasFrozenWithoutSuccessor = active.isEmpty() && hasSnapshot(scope);
    return isActive ? CURRENT : isReplaced || wasFrozenWithoutSuccessor ? SNAPSHOT : NONE;
  }

  private static boolean hasSnapshot(String scope) {
    return dao().listSnapshotSummaries().stream()
        .anyMatch(summary -> summary.dataDictionaryVersion().equals(scope));
  }

  private static Map<String, Object> snapshot(UUID cdeId, String scope, int limit, int offset) {
    final List<SnapshotRow> rows = dao().listSnapshotsByCde(cdeId.toString(), scope, limit, offset);
    final Map<String, Object> result = new LinkedHashMap<>();
    result.put(
        "data",
        rows.stream()
            .map(
                row ->
                    JsonUtils.readValue(row.payload(), new TypeReference<Map<String, Object>>() {}))
            .toList());
    result.put("frozenAt", rows.isEmpty() ? null : rows.getFirst().frozenAt());
    result.put("paging", paging(dao().countSnapshotsByCde(cdeId.toString(), scope), limit, offset));
    return result;
  }

  private static Map<String, Object> empty(int limit, int offset) {
    return Map.of("data", List.of(), "paging", paging(0, limit, offset));
  }

  private static Map<String, Object> paging(long total, int limit, int offset) {
    final Map<String, Object> paging = new LinkedHashMap<>();
    paging.put("total", total);
    paging.put("limit", limit);
    paging.put("offset", offset);
    return paging;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
