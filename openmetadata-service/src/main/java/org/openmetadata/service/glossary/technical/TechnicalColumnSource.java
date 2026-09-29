/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;

/**
 * Snapshot of one top-level physical Column used to create or refresh a Technical Dictionary
 * record.
 */
public record TechnicalColumnSource(
    String columnKey,
    String columnFqn,
    String columnName,
    String description,
    Map<String, Object> sourceExtension) {

  public TechnicalColumnSource {
    sourceExtension = Map.copyOf(sourceExtension);
  }

  /** Same derivation as the Column search document id (`ColumnSearchIndex.generateColumnId`). */
  public static String columnKey(String columnFqn) {
    return UUID.nameUUIDFromBytes(columnFqn.getBytes(StandardCharsets.UTF_8)).toString();
  }

  /** Top-level Columns of a table; nested struct/array/map children are out of scope. */
  public static List<TechnicalColumnSource> columnsOf(Table table) {
    return listOrEmpty(table.getColumns()).stream()
        .filter(column -> column.getFullyQualifiedName() != null)
        .map(column -> of(table, column))
        .toList();
  }

  public static TechnicalColumnSource of(Table table, Column column) {
    return new TechnicalColumnSource(
        columnKey(column.getFullyQualifiedName()),
        column.getFullyQualifiedName(),
        column.getName(),
        column.getDescription(),
        sourceExtension(table, column));
  }

  /** True when the given payload already carries this Column snapshot. */
  public boolean isSnapshotOf(Map<String, Object> extension, String payloadDescription) {
    final boolean sameDescription =
        Objects.equals(emptyToNull(description), emptyToNull(payloadDescription));
    return sameDescription
        && sourceExtension.entrySet().stream()
            .allMatch(
                entry ->
                    Objects.equals(
                        normalize(entry.getValue()), normalize(extension.get(entry.getKey()))));
  }

  private static Map<String, Object> sourceExtension(Table table, Column column) {
    final Map<String, Object> values = new LinkedHashMap<>();
    values.put(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, column.getFullyQualifiedName());
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SERVICE, name(table.getService()));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATABASE, name(table.getDatabase()));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SCHEMA, name(table.getDatabaseSchema()));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_TABLE, table.getName());
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_COLUMN, column.getName());
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATA_TYPE, dataType(column));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATA_LENGTH, column.getDataLength());
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_PRECISION, column.getPrecision());
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SCALE, column.getScale());
    return values;
  }

  private static String dataType(Column column) {
    final String display = column.getDataTypeDisplay();
    return display != null
        ? display
        : column.getDataType() == null ? null : column.getDataType().value();
  }

  private static String name(EntityReference reference) {
    return reference == null ? null : reference.getName();
  }

  private static void putIfPresent(Map<String, Object> values, String key, Object value) {
    if (value != null) {
      values.put(key, value);
    }
  }

  private static Object normalize(Object value) {
    return value instanceof Number number ? number.longValue() : value;
  }

  private static String emptyToNull(String value) {
    return value == null || value.isEmpty() ? null : value;
  }
}
