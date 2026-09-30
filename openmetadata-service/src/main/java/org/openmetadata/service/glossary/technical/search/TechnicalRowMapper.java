/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile;
import org.openmetadata.service.glossary.technical.TechnicalRowFields;
import org.openmetadata.service.glossary.versioning.CdeReleaseVersionType;

/**
 * Turns an index document into the flat row the Technical Dictionary page already renders
 * (`TechnicalRecordApiRow`), read from one representation view, plus {@code hasPublished}.
 */
public final class TechnicalRowMapper {
  public static final String TERM_ID = "termId";
  public static final String ID = "id";
  public static final String NAME = "name";
  public static final String TAGS = "tags";
  public static final String RELATED_TERMS = "relatedTerms";
  public static final String EXTENSION = "extension";
  private static final String TAG_FQN = "tagFQN";
  private static final String TERM = "term";
  private static final String VERSION_CONTEXT = "versionContext";
  private static final List<String> TAG_FIELDS =
      List.of(
          TechnicalIndexFields.ELEMENT_TYPE,
          TechnicalIndexFields.GENERATION_TYPE,
          TechnicalIndexFields.CREATION_METHOD,
          TechnicalIndexFields.TIMELINESS);
  private static final Map<String, String> EXTENSION_FIELDS = extensionFields();

  private TechnicalRowMapper() {}

  private static Map<String, String> extensionFields() {
    final Map<String, String> fields = new LinkedHashMap<>();
    fields.put(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, TechnicalIndexFields.COLUMN_FQN);
    fields.put(TechnicalDictionaryProfile.SOURCE_SERVICE, TechnicalIndexFields.SERVICE);
    fields.put(TechnicalDictionaryProfile.SOURCE_DATABASE, TechnicalIndexFields.DATABASE);
    fields.put(TechnicalDictionaryProfile.SOURCE_SCHEMA, TechnicalIndexFields.SCHEMA);
    fields.put(TechnicalDictionaryProfile.SOURCE_TABLE, TechnicalIndexFields.TABLE);
    fields.put(TechnicalDictionaryProfile.SOURCE_COLUMN, TechnicalIndexFields.COLUMN);
    fields.put(TechnicalDictionaryProfile.SOURCE_DATA_TYPE, TechnicalIndexFields.DATA_TYPE);
    fields.put(TechnicalDictionaryProfile.SOURCE_DATA_LENGTH, TechnicalIndexFields.DATA_LENGTH);
    fields.put(TechnicalDictionaryProfile.SOURCE_PRECISION, TechnicalIndexFields.PRECISION);
    fields.put(TechnicalDictionaryProfile.SOURCE_SCALE, TechnicalIndexFields.SCALE);
    return fields;
  }

  /** Row of the given view; falls back to the current view when the record has no such view. */
  public static Map<String, Object> toRow(Map<String, Object> document, String view) {
    final Map<String, Object> selected =
        child(document, view).isEmpty()
            ? child(document, TechnicalIndexFields.CURRENT)
            : child(document, view);
    final Map<String, Object> row = new LinkedHashMap<>();
    putIdentity(row, document);
    putStatus(row, selected);
    row.put(TAGS, tags(selected));
    row.put(RELATED_TERMS, relatedTerms(child(selected, TechnicalIndexFields.CDE)));
    row.put(EXTENSION, extension(document, selected));
    putCde(row, selected);
    row.put(TechnicalRowFields.SOURCE_STATUS, text(document, TechnicalIndexFields.SOURCE_STATUS));
    row.put(TechnicalIndexFields.HAS_PUBLISHED, Boolean.TRUE.equals(document.get(TechnicalIndexFields.HAS_PUBLISHED)));
    return row;
  }

  private static void putIdentity(Map<String, Object> row, Map<String, Object> document) {
    row.put(TERM_ID, document.get(TechnicalIndexFields.TERM_ID));
    row.put(ID, document.get(TechnicalIndexFields.TERM_ID));
    row.put(NAME, document.get(TechnicalIndexFields.COLUMN_KEY));
    row.put(TechnicalIndexFields.DISPLAY_NAME, document.get(TechnicalIndexFields.DISPLAY_NAME));
    row.put(TechnicalIndexFields.DESCRIPTION, document.get(TechnicalIndexFields.DESCRIPTION));
    row.put(
        TechnicalIndexFields.PARENT_BUSINESS_VERSION,
        document.get(TechnicalIndexFields.PARENT_BUSINESS_VERSION));
  }

  private static void putStatus(Map<String, Object> row, Map<String, Object> view) {
    row.put(TechnicalIndexFields.BUSINESS_VERSION, view.get(TechnicalIndexFields.BUSINESS_VERSION));
    row.put(TechnicalIndexFields.ENTITY_STATUS, view.get(TechnicalIndexFields.ENTITY_STATUS));
    row.put(TechnicalIndexFields.RECORD_TYPE, view.get(TechnicalIndexFields.RECORD_TYPE));
    putIfPresent(row, TechnicalIndexFields.WORKING_REVISION, view.get(TechnicalIndexFields.WORKING_REVISION));
    putIfPresent(row, TechnicalIndexFields.SNAPSHOT_ID, view.get(TechnicalIndexFields.SNAPSHOT_ID));
    putIfPresent(row, TechnicalIndexFields.UPDATED_AT, view.get(TechnicalIndexFields.UPDATED_AT));
    putIfPresent(row, TechnicalIndexFields.UPDATED_BY, view.get(TechnicalIndexFields.UPDATED_BY));
  }

  private static List<Map<String, Object>> tags(Map<String, Object> view) {
    final List<Map<String, Object>> tags = new ArrayList<>();
    for (String field : TAG_FIELDS) {
      final Map<String, Object> tag = child(view, field);
      if (!tag.isEmpty()) {
        tags.add(tagLabel(tag));
      }
    }
    return tags;
  }

  private static Map<String, Object> tagLabel(Map<String, Object> tag) {
    final Map<String, Object> label = new LinkedHashMap<>();
    label.put(TAG_FQN, tag.get(TechnicalIndexFields.FQN));
    putIfPresent(label, NAME, tag.get(TechnicalIndexFields.NAME));
    label.put(TechnicalIndexFields.DISPLAY_NAME, tag.get(TechnicalIndexFields.LABEL));
    label.put("source", TagLabel.TagSource.CLASSIFICATION.value());
    label.put("labelType", TagLabel.LabelType.MANUAL.value());
    label.put("state", TagLabel.State.CONFIRMED.value());
    return label;
  }

  private static List<Map<String, Object>> relatedTerms(Map<String, Object> cde) {
    final List<Map<String, Object>> relations = new ArrayList<>();
    if (cde.get(TechnicalIndexFields.ID) != null) {
      final Map<String, Object> term = new LinkedHashMap<>();
      term.put(ID, cde.get(TechnicalIndexFields.ID));
      term.put(TechnicalIndexFields.TYPE, Entity.GLOSSARY_TERM);
      term.put(NAME, cde.get(TechnicalIndexFields.CODE));
      term.put(TechnicalIndexFields.DISPLAY_NAME, cde.get(TechnicalIndexFields.NAME));
      putIfPresent(term, TechnicalIndexFields.FULLY_QUALIFIED_NAME, cde.get(TechnicalIndexFields.FULLY_QUALIFIED_NAME));
      final Map<String, Object> relation = new LinkedHashMap<>();
      relation.put(TERM, term);
      relation.put(VERSION_CONTEXT, versionContext(cde));
      relations.add(relation);
    }
    return relations;
  }

  private static Map<String, Object> versionContext(Map<String, Object> cde) {
    final Map<String, Object> context = new LinkedHashMap<>();
    putIfPresent(context, TechnicalIndexFields.PARENT_BUSINESS_VERSION, cde.get(TechnicalIndexFields.PARENT_BUSINESS_VERSION));
    putIfPresent(context, TechnicalIndexFields.BUSINESS_VERSION, cde.get(TechnicalIndexFields.BUSINESS_VERSION));
    putIfPresent(context, TechnicalIndexFields.SNAPSHOT_ID, cde.get(TechnicalIndexFields.SNAPSHOT_ID));
    return context;
  }

  private static Map<String, Object> extension(Map<String, Object> document, Map<String, Object> view) {
    final Map<String, Object> extension = new LinkedHashMap<>();
    EXTENSION_FIELDS.forEach((key, field) -> putIfPresent(extension, key, document.get(field)));
    putIfPresent(extension, TechnicalDictionaryProfile.SURVIVORSHIP_RANK, view.get(TechnicalIndexFields.RANK));
    final Map<String, Object> owner = child(view, TechnicalIndexFields.SYSTEM_OWNER);
    if (!owner.isEmpty()) {
      extension.put(TechnicalDictionaryProfile.SYSTEM_OWNER, owner);
    }
    putIfPresent(extension, CdeReleaseVersionType.PROPERTY, view.get(TechnicalIndexFields.RELEASE_VERSION_TYPE));
    return extension;
  }

  private static void putCde(Map<String, Object> row, Map<String, Object> view) {
    final Map<String, Object> cde = child(view, TechnicalIndexFields.CDE);
    row.put(TechnicalRowFields.CDE_CODE, text(cde, TechnicalIndexFields.CODE));
    row.put(TechnicalRowFields.CDE_NAME, text(cde, TechnicalIndexFields.NAME));
    final Object owners = view.get(TechnicalIndexFields.DATA_OWNERS);
    row.put(TechnicalRowFields.DATA_OWNERS, owners instanceof List<?> list ? list : List.of());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> child(Map<String, Object> parent, String key) {
    final Object value = parent.get(key);
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  private static String text(Map<String, Object> values, String key) {
    final Object value = values.get(key);
    return value == null ? "" : String.valueOf(value);
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }
}
