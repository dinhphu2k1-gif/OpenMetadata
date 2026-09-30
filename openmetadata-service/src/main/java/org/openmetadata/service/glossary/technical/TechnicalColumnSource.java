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
import org.openmetadata.service.util.FullyQualifiedName;

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
        .map(TechnicalColumnSource::of)
        .toList();
  }

  public static TechnicalColumnSource of(Column column) {
    return new TechnicalColumnSource(
        columnKey(column.getFullyQualifiedName()),
        column.getFullyQualifiedName(),
        column.getName(),
        column.getDescription(),
        sourceExtension(column));
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

  private static Map<String, Object> sourceExtension(Column column) {
    return sourceExtension(
        column.getFullyQualifiedName(),
        dataType(column),
        column.getDataLength(),
        column.getPrecision(),
        column.getScale());
  }

  /**
   * Source snapshot of one Column. Service, database, schema and table are taken from the Column
   * FQN: the persisted Table JSON and the Column search document do not both carry them.
   */
  public static Map<String, Object> sourceExtension(
      String columnFqn, String dataType, Integer dataLength, Integer precision, Integer scale) {
    final String[] parts = FullyQualifiedName.split(columnFqn);
    final Map<String, Object> values = new LinkedHashMap<>();
    values.put(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, columnFqn);
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SERVICE, part(parts, 0));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATABASE, part(parts, 1));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SCHEMA, part(parts, 2));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_TABLE, part(parts, 3));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_COLUMN, part(parts, 4));
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATA_TYPE, dataType);
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_DATA_LENGTH, dataLength);
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_PRECISION, precision);
    putIfPresent(values, TechnicalDictionaryProfile.SOURCE_SCALE, scale);
    return values;
  }

  private static String part(String[] parts, int index) {
    return index < parts.length ? FullyQualifiedName.unquoteName(parts[index]) : null;
  }

  private static String dataType(Column column) {
    final String display = column.getDataTypeDisplay();
    return display != null
        ? display
        : column.getDataType() == null ? null : column.getDataType().value();
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
