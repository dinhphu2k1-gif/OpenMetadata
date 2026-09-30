/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.lifecycle.handlers.TechnicalDictionaryColumnHandlerTestAccess;

class TechnicalColumnSourceTest {

  private static Column column(String name) {
    return new Column()
        .withName(name)
        .withFullyQualifiedName("ipcas.core.dbo.customer." + name)
        .withDataType(ColumnDataType.VARCHAR)
        .withDataTypeDisplay("varchar(100)")
        .withDataLength(100)
        .withDescription("Tên khách hàng");
  }

  private static Table table(List<Column> columns) {
    return new Table()
        .withName("customer")
        .withService(new EntityReference().withName("ipcas"))
        .withDatabase(new EntityReference().withName("core"))
        .withDatabaseSchema(new EntityReference().withName("dbo"))
        .withColumns(columns);
  }

  @Test
  void extractsOnlyTopLevelColumnsWithSearchCompatibleKeys() {
    Column struct = column("address").withChildren(List.of(column("address.city")));
    List<TechnicalColumnSource> sources =
        TechnicalColumnSource.columnsOf(table(List.of(column("name"), struct)));

    assertEquals(2, sources.size());
    TechnicalColumnSource name = sources.getFirst();
    assertEquals(
        UUID.nameUUIDFromBytes("ipcas.core.dbo.customer.name".getBytes(StandardCharsets.UTF_8))
            .toString(),
        name.columnKey());
    assertEquals("ipcas", name.sourceExtension().get(TechnicalDictionaryProfile.SOURCE_SERVICE));
    assertEquals("dbo", name.sourceExtension().get(TechnicalDictionaryProfile.SOURCE_SCHEMA));
    assertEquals(
        "varchar(100)", name.sourceExtension().get(TechnicalDictionaryProfile.SOURCE_DATA_TYPE));
    assertEquals(100, name.sourceExtension().get(TechnicalDictionaryProfile.SOURCE_DATA_LENGTH));
  }

  @Test
  void detectsSnapshotDriftIncludingNumericNormalization() {
    TechnicalColumnSource source =
        TechnicalColumnSource.columnsOf(table(List.of(column("name")))).getFirst();
    Map<String, Object> stored =
        JsonUtils.readValue(JsonUtils.pojoToJson(source.sourceExtension()), Map.class);

    assertTrue(source.isSnapshotOf(stored, "Tên khách hàng"));
    assertFalse(source.isSnapshotOf(stored, "Mô tả khác"));

    Map<String, Object> drifted = new HashMap<>(stored);
    drifted.put(TechnicalDictionaryProfile.SOURCE_DATA_LENGTH, 50L);
    assertFalse(source.isSnapshotOf(drifted, "Tên khách hàng"));
  }

  @Test
  void parsesDeletedColumnsFromJsonOrObjectChangeValues() {
    List<Column> deleted = List.of(column("legacy"));
    ChangeDescription asJson =
        new ChangeDescription()
            .withFieldsDeleted(
                List.of(
                    new FieldChange()
                        .withName("columns")
                        .withOldValue(JsonUtils.pojoToJson(deleted))));
    ChangeDescription asObject =
        new ChangeDescription()
            .withFieldsDeleted(
                List.of(
                    new FieldChange().withName("columns").withOldValue(deleted),
                    new FieldChange().withName("description").withOldValue("x")));

    assertEquals(
        "legacy",
        TechnicalDictionaryColumnHandlerTestAccess.deletedColumns(asJson).getFirst().getName());
    assertEquals(1, TechnicalDictionaryColumnHandlerTestAccess.deletedColumns(asObject).size());
    assertTrue(TechnicalDictionaryColumnHandlerTestAccess.deletedColumns(null).isEmpty());
  }

  @Test
  void recognizesIntegrityConstraintViolationsOnly() {
    SQLException duplicate = new SQLException("duplicate", "23505");
    SQLException timeout = new SQLException("timeout", "57014");

    assertTrue(
        TechnicalRecordWriter.isConstraintViolation(
            new UnableToExecuteStatementException(duplicate, null)));
    assertFalse(
        TechnicalRecordWriter.isConstraintViolation(
            new UnableToExecuteStatementException(timeout, null)));
  }
}
