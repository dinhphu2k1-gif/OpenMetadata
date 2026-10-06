/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexFields;

/**
 * Refreshes the steward names of rows read from the search index, which holds the names as they
 * were when the record was indexed: a renamed team or user shows its current name, and one that was
 * deleted is left out.
 */
public final class TechnicalOwnerLabels {
  private TechnicalOwnerLabels() {}

  /** A copy of the page with every row's stewards refreshed. */
  public static Map<String, Object> refreshPage(Map<String, Object> page) {
    final Map<String, Object> refreshed = new LinkedHashMap<>(page);
    if (page.get("data") instanceof List<?> rows) {
      final Map<String, Optional<String>> names = new HashMap<>();
      final List<Object> result = new ArrayList<>();
      for (Object row : rows) {
        result.add(row instanceof Map<?, ?> map ? refreshRow(map, names) : row);
      }
      refreshed.put("data", result);
    }
    return refreshed;
  }

  /** A copy of the row with its stewards refreshed. */
  public static Map<String, Object> refreshRow(Map<?, ?> row) {
    return refreshRow(row, new HashMap<>());
  }

  private static Map<String, Object> refreshRow(
      Map<?, ?> row, Map<String, Optional<String>> names) {
    final Map<String, Object> refreshed = new LinkedHashMap<>();
    row.forEach((key, value) -> refreshed.put(String.valueOf(key), value));
    if (refreshed.get(TechnicalIndexFields.SYSTEM_OWNERS) instanceof List<?> owners) {
      final List<Map<String, Object>> current = new ArrayList<>();
      for (Object owner : owners) {
        if (owner instanceof Map<?, ?> map) {
          final String id = String.valueOf(map.get(TechnicalIndexFields.ID));
          final String type = String.valueOf(map.get(TechnicalIndexFields.TYPE));
          names
              .computeIfAbsent(type + ":" + id, key -> currentName(type, id))
              .ifPresent(
                  name -> {
                    final Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put(TechnicalIndexFields.ID, id);
                    entry.put(TechnicalIndexFields.NAME, name);
                    entry.put(TechnicalIndexFields.TYPE, type);
                    current.add(entry);
                  });
        }
      }
      if (current.isEmpty()) {
        refreshed.remove(TechnicalIndexFields.SYSTEM_OWNERS);
      } else {
        refreshed.put(TechnicalIndexFields.SYSTEM_OWNERS, current);
      }
    }
    return refreshed;
  }

  private static Optional<String> currentName(String type, String id) {
    Optional<String> name = Optional.empty();
    try {
      final EntityReference owner =
          Entity.getEntityReferenceById(
              TechnicalOwnerRef.USER.equals(type) ? Entity.USER : Entity.TEAM,
              java.util.UUID.fromString(id),
              Include.NON_DELETED);
      name = Optional.of(owner.getDisplayName() == null ? owner.getName() : owner.getDisplayName());
    } catch (EntityNotFoundException | IllegalArgumentException exception) {
      name = Optional.empty();
    }
    return name;
  }
}
