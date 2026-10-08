/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The business fields that differ between two Approved contents of one CDE or DQ rule business
 * version, as {@code [{field, oldValue, newValue}]} with display strings.
 *
 * <p>Fields are the top-level business fields, {@code tags.<Classification>} for each tag group
 * and {@code extension.<key>} for every Custom Property. Publication metadata is never compared.
 */
public final class GlossaryCorrectionChanges {
  private static final List<String> TOP_LEVEL_FIELDS =
      List.of(
          "displayName",
          "description",
          "synonyms",
          "domains",
          "owners",
          "reviewers",
          "relatedTerms");
  private static final List<String> NAME_KEYS =
      List.of("displayName", "name", "tagFQN", "fullyQualifiedName");
  private static final String TAGS = "tags";
  private static final String TAG_FQN = "tagFQN";
  private static final String EXTENSION = "extension";
  private static final String RELATED_TERM = "term";

  private GlossaryCorrectionChanges() {}

  public static List<Map<String, Object>> between(String oldPayload, String newPayload) {
    final Map<String, String> before = fields(read(oldPayload));
    final Map<String, String> after = fields(read(newPayload));
    final List<Map<String, Object>> changes = new ArrayList<>();
    final Map<String, Boolean> keys = new LinkedHashMap<>();
    before.keySet().forEach(key -> keys.put(key, true));
    after.keySet().forEach(key -> keys.put(key, true));
    for (String key : keys.keySet()) {
      final String oldValue = before.get(key);
      final String newValue = after.get(key);
      if (!Objects.equals(oldValue, newValue)) {
        final Map<String, Object> change = new LinkedHashMap<>();
        change.put("field", key);
        change.put("oldValue", oldValue);
        change.put("newValue", newValue);
        changes.add(change);
      }
    }
    return changes;
  }

  private static Map<String, Object> read(String payload) {
    if (payload == null) {
      return Map.of();
    }
    final Object parsed = JsonUtils.readValue(payload, Object.class);
    return parsed instanceof Map<?, ?> map ? stringKeys(map) : Map.of();
  }

  private static Map<String, String> fields(Map<String, Object> payload) {
    final Map<String, String> fields = new LinkedHashMap<>();
    TOP_LEVEL_FIELDS.forEach(field -> put(fields, field, display(payload.get(field))));
    tagGroups(payload.get(TAGS)).forEach((group, tags) -> put(fields, TAGS + "." + group, tags));
    if (payload.get(EXTENSION) instanceof Map<?, ?> extension) {
      new TreeMap<>(stringKeys(extension))
          .forEach((key, value) -> put(fields, EXTENSION + "." + key, display(value)));
    }
    return fields;
  }

  /** Tags shown per classification, as each group is its own field on the detail page. */
  private static Map<String, String> tagGroups(Object tags) {
    final Map<String, List<String>> groups = new TreeMap<>();
    if (tags instanceof Collection<?> labels) {
      for (Object label : labels) {
        if (label instanceof Map<?, ?> tag && tag.get(TAG_FQN) instanceof String fqn) {
          final int dot = fqn.indexOf('.');
          final String group = dot < 0 ? fqn : fqn.substring(0, dot);
          groups.computeIfAbsent(group, key -> new ArrayList<>()).add(display(tag));
        }
      }
    }
    final Map<String, String> displayed = new TreeMap<>();
    groups.forEach((group, names) -> displayed.put(group, String.join(", ", names)));
    return displayed;
  }

  private static void put(Map<String, String> fields, String field, String value) {
    if (value != null) {
      fields.put(field, value);
    }
  }

  private static String display(Object value) {
    final String displayed;
    if (value == null) {
      displayed = null;
    } else if (value instanceof Collection<?> values) {
      displayed =
          values.stream()
              .map(GlossaryCorrectionChanges::display)
              .filter(Objects::nonNull)
              .collect(Collectors.joining(", "));
    } else if (value instanceof Map<?, ?> map) {
      displayed = displayObject(map);
    } else {
      displayed = String.valueOf(value).trim();
    }
    return displayed == null || displayed.isEmpty() ? null : displayed;
  }

  /** Entity references, tag labels and term relations by name; anything else as JSON. */
  private static String displayObject(Map<?, ?> map) {
    final String displayed;
    if (map.get(RELATED_TERM) instanceof Map<?, ?> term) {
      displayed = displayObject(term);
    } else {
      displayed =
          NAME_KEYS.stream()
              .map(map::get)
              .filter(value -> value instanceof String text && !text.isBlank())
              .map(value -> ((String) value).trim())
              .findFirst()
              .orElse(map.isEmpty() ? null : JsonUtils.pojoToJson(map));
    }
    return displayed;
  }

  private static Map<String, Object> stringKeys(Map<?, ?> map) {
    final Map<String, Object> result = new LinkedHashMap<>();
    map.forEach((key, value) -> result.put(String.valueOf(key), value));
    return result;
  }
}
