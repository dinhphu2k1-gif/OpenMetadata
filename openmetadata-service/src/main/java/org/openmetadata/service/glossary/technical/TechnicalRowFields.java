/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;

/** Read-model fields added to Technical Dictionary flat rows, plus typed accessors over them. */
public final class TechnicalRowFields {
  public static final String SOURCE_STATUS = "sourceStatus";
  public static final String CDE_CODE = "cdeCode";
  public static final String CDE_NAME = "cdeName";
  public static final String DATA_OWNERS = "dataOwners";

  private static final String EXTENSION = "extension";
  private static final String RELATED_TERMS = "relatedTerms";
  private static final String TERM = "term";
  private static final String ID = "id";

  private TechnicalRowFields() {}

  public static Map<String, Object> extension(Map<String, Object> row) {
    return row.get(EXTENSION) instanceof Map<?, ?> values
        ? TechnicalRecordValidator.extension(values)
        : Map.of();
  }

  public static String extensionText(Map<String, Object> row, String key) {
    final Object value = extension(row).get(key);
    return value == null ? "" : String.valueOf(value);
  }

  /** Id of the referenced CDE identity, or null when the row is not mapped. */
  public static String cdeId(Map<String, Object> row) {
    String result = null;
    if (row.get(RELATED_TERMS) instanceof List<?> relations
        && !nullOrEmpty(relations)
        && relations.getFirst() instanceof Map<?, ?> relation
        && relation.get(TERM) instanceof Map<?, ?> term
        && term.get(ID) != null) {
      result = String.valueOf(term.get(ID));
    }
    return result;
  }

  public static String systemOwnerId(Map<String, Object> row) {
    final Object owner = extension(row).get(TechnicalDictionaryProfile.SYSTEM_OWNER);
    return owner instanceof Map<?, ?> reference && reference.get(ID) != null
        ? String.valueOf(reference.get(ID))
        : null;
  }

  public static String text(Map<String, Object> row, String key) {
    final Object value = row.get(key);
    return value == null ? "" : String.valueOf(value);
  }
}
