/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.service.config.TechnicalDictionaryConfiguration;

class TechnicalColumnScopeTest {

  private static Table table(String service, String schema, String name, TableType type) {
    return new Table()
        .withName(name)
        .withTableType(type)
        .withService(new EntityReference().withName(service))
        .withDatabase(new EntityReference().withFullyQualifiedName(service + ".core"))
        .withDatabaseSchema(
            new EntityReference()
                .withName(schema)
                .withFullyQualifiedName(service + ".core." + schema));
  }

  private static TechnicalColumnScope scope(String services, String excludes) {
    TechnicalDictionaryConfiguration config = new TechnicalDictionaryConfiguration();
    config.setIncludeServices(services);
    config.setExcludePatterns(excludes);
    return TechnicalColumnScope.fromConfiguration(config);
  }

  @Test
  void emptyServiceAllowlistMatchesNothing() {
    TechnicalColumnScope empty = scope("", "");
    assertTrue(empty.isEmpty());
    assertFalse(empty.matches(table("ipcas", "dbo", "CUSTOMER", TableType.Regular)));
  }

  @Test
  void includesOnlyPhysicalTablesOfAllowlistedServices() {
    TechnicalColumnScope scope = scope("ipcas, dwh", "");
    assertTrue(scope.matches(table("IPCAS", "dbo", "CUSTOMER", TableType.Regular)));
    assertTrue(scope.matches(table("dwh", "dbo", "FACT", TableType.Partitioned)));
    assertTrue(scope.matches(table("dwh", "dbo", "EXT", TableType.External)));
    assertTrue(scope.matches(table("dwh", "dbo", "ICE", TableType.Iceberg)));
    assertTrue(scope.matches(table("dwh", "dbo", "UNTYPED", null)));
    assertFalse(scope.matches(table("crm", "dbo", "CUSTOMER", TableType.Regular)));
    for (TableType derived :
        List.of(
            TableType.View,
            TableType.SecureView,
            TableType.MaterializedView,
            TableType.Dynamic,
            TableType.Transient,
            TableType.Local,
            TableType.Stream,
            TableType.Stage,
            TableType.Foreign)) {
      assertFalse(scope.matches(table("dwh", "dbo", "T", derived)), derived.value());
    }
  }

  @Test
  void excludesSoftDeletedTables() {
    Table deleted = table("ipcas", "dbo", "CUSTOMER", TableType.Regular).withDeleted(true);
    assertFalse(scope("ipcas", "").matches(deleted));
  }

  @Test
  void excludePatternsMatchTableOrSchemaCaseInsensitively() {
    TechnicalColumnScope scope = scope("ipcas", "TMP_*,*_bak,staging");
    assertFalse(scope.matches(table("ipcas", "dbo", "tmp_load", TableType.Regular)));
    assertFalse(scope.matches(table("ipcas", "dbo", "CUSTOMER_BAK", TableType.Regular)));
    assertFalse(scope.matches(table("ipcas", "STAGING", "CUSTOMER", TableType.Regular)));
    assertTrue(scope.matches(table("ipcas", "dbo", "CUSTOMER", TableType.Regular)));
  }

  @Test
  void databaseAndSchemaAllowlistsNarrowTheServiceScope() {
    TechnicalDictionaryConfiguration config = new TechnicalDictionaryConfiguration();
    config.setIncludeServices("ipcas");
    config.setIncludeSchemas("ipcas.core.dbo");
    TechnicalColumnScope scope = TechnicalColumnScope.fromConfiguration(config);
    assertTrue(scope.matches(table("ipcas", "dbo", "CUSTOMER", TableType.Regular)));
    assertFalse(scope.matches(table("ipcas", "audit", "CUSTOMER", TableType.Regular)));
  }

  @Test
  void roundTripsThroughJsonSnapshot() {
    TechnicalColumnScope scope = scope("ipcas", "TMP_*");
    assertEquals(scope, TechnicalColumnScope.fromJson(scope.toJson()));
  }
}
