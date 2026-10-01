/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.AuditRow;

/**
 * The change history of a record for the modal: who changed what and when, newest first. Stored
 * changes hold identifiers, so they are given display labels here.
 */
public final class TechnicalHistory {
  private static final String FIELD = "field";

  private final Map<String, String> labels = new HashMap<>();

  public Map<String, Object> page(String recordId, int limit, int offset) {
    final TechnicalDictionaryDAO dao = dao();
    final List<Map<String, Object>> entries =
        dao.listAudit(recordId, limit, offset).stream().map(this::entry).toList();
    final Map<String, Object> paging = new LinkedHashMap<>();
    paging.put("total", dao.countAudit(recordId));
    paging.put("limit", limit);
    paging.put("offset", offset);
    return Map.of("data", entries, "paging", paging);
  }

  private Map<String, Object> entry(AuditRow audit) {
    final Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("id", audit.id());
    entry.put("action", audit.action());
    entry.put("actor", audit.actor());
    entry.put("at", audit.at());
    entry.put("dataDictionaryVersion", audit.dataDictionaryVersion());
    entry.put("changes", labelled(audit));
    return entry;
  }

  private List<Map<String, Object>> labelled(AuditRow audit) {
    final List<Map<String, Object>> changes =
        audit.changes() == null
            ? List.of()
            : JsonUtils.readValue(audit.changes(), new TypeReference<>() {});
    return changes.stream().map(change -> label(change, audit.dataDictionaryVersion())).toList();
  }

  private Map<String, Object> label(Map<String, Object> change, String version) {
    final Map<String, Object> result = new LinkedHashMap<>(change);
    final String field = String.valueOf(change.get(FIELD));
    result.put("oldValue", display(field, change.get("oldValue"), version));
    result.put("newValue", display(field, change.get("newValue"), version));
    return result;
  }

  private String display(String field, Object raw, String version) {
    final String value = raw == null ? null : String.valueOf(raw);
    return value == null ? null : labelOf(field, value, version);
  }

  private String labelOf(String field, String value, String version) {
    return switch (field) {
      case "cde" -> labels.computeIfAbsent("cde:" + value, key -> cdeCode(value, version));
      case "systemOwner" -> labels.computeIfAbsent("team:" + value, key -> teamName(value));
      case "elementType", "generationType", "creationMethod", "timeliness" -> labels
          .computeIfAbsent("tag:" + value, key -> tagLabel(value));
      default -> value;
    };
  }

  private static String cdeCode(String cdeId, String version) {
    final TechnicalCdeInfo info =
        version == null
            ? TechnicalCdeInfo.NONE
            : TechnicalCdeInfo.resolve(UUID.fromString(cdeId), version);
    return info.isPresent() ? info.code() : cdeId;
  }

  private static String teamName(String teamId) {
    String name = teamId;
    try {
      final EntityReference team =
          Entity.getEntityReferenceById(Entity.TEAM, UUID.fromString(teamId), Include.ALL);
      name = team.getDisplayName() == null ? team.getName() : team.getDisplayName();
    } catch (EntityNotFoundException exception) {
      name = teamId;
    }
    return name;
  }

  private static String tagLabel(String tagFqn) {
    String label = tagFqn.substring(tagFqn.lastIndexOf('.') + 1);
    try {
      final EntityReference tag = Entity.getEntityReferenceByName(Entity.TAG, tagFqn, Include.ALL);
      label = tag.getDisplayName() == null ? tag.getName() : tag.getDisplayName();
    } catch (EntityNotFoundException exception) {
      label = tagFqn.substring(tagFqn.lastIndexOf('.') + 1);
    }
    return label;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
