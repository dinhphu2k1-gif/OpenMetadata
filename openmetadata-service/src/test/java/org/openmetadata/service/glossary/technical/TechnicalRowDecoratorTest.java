/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalRowDecorator.CdeInfo;

class TechnicalRowDecoratorTest {
  private static Map<String, Object> row() {
    return Map.of(
        "extension",
        Map.of(
            TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, "IPCAS.core.dbo.CUSTOMER.NAME",
            TechnicalDictionaryProfile.SOURCE_TABLE, "CUSTOMER",
            TechnicalDictionaryProfile.SOURCE_COLUMN, "NAME"));
  }

  @Test
  void searchTextCoversSourceFieldsAndCdeInLowercase() {
    String text =
        TechnicalRowDecorator.searchText(row(), new CdeInfo("CDE1", "Tên khách hàng", List.of()));
    assertTrue(text.contains("customer"));
    assertTrue(text.contains("cde1"));
    assertTrue(text.contains("tên khách hàng"));
    assertEquals(text, text.toLowerCase());
  }

  @Test
  void sortKeyOrdersByFullyQualifiedSourceColumn() {
    assertEquals("ipcas.core.dbo.customer.name", TechnicalRowDecorator.sortKey(row()));
    assertEquals("", TechnicalRowDecorator.sortKey(Map.of()));
  }
}
