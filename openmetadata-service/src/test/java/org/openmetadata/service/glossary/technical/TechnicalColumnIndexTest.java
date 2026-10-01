/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalColumnIndex.ColumnDocument;

class TechnicalColumnIndexTest {
  private static ColumnDocument column(String table, String name) {
    final String fqn = "MIS.MISDB.cs1." + table + "." + name;
    return new ColumnDocument(
        fqn, fqn, null, TechnicalColumnSource.sourceExtension(fqn, "varchar2", null, null, null));
  }

  private static List<String> names(List<ColumnDocument> columns) {
    return columns.stream().map(column -> column.columnFqn().split("\\.")[4]).toList();
  }

  @Test
  void anExactColumnNameComesBeforeNamesThatMerelyContainTheText() {
    final List<ColumnDocument> ranked =
        TechnicalColumnIndex.closestFirst(
            List.of(
                column("TBBI_DASH_LN", "nodenhanmm"),
                column("TBCS_BKCD", "bknm"),
                column("TBZZ_LAST", "nm"),
                column("TBCS_BKCD", "brnm")),
            "nm",
            10);

    assertEquals("nm", names(ranked).getFirst());
  }

  @Test
  void ranksExactThenPrefixThenContainsThenTableMatchesAndShorterNamesFirst() {
    final List<ColumnDocument> ranked =
        TechnicalColumnIndex.closestFirst(
            List.of(
                column("NM_TABLE", "acct"),
                column("T1", "shrtbknm"),
                column("T1", "bknm"),
                column("T1", "nm2x"),
                column("T1", "nm2"),
                column("T1", "nm")),
            "nm",
            10);

    assertEquals(List.of("nm", "nm2", "nm2x", "bknm", "shrtbknm", "acct"), names(ranked));
  }

  @Test
  void matchingIgnoresCaseAndCutsAtTheLimitAfterRanking() {
    final List<ColumnDocument> ranked =
        TechnicalColumnIndex.closestFirst(
            List.of(column("A", "xnm"), column("B", "NM"), column("C", "nmx")), " Nm ".trim(), 2);

    assertEquals(List.of("NM", "nmx"), names(ranked));
  }

  @Test
  void withoutTextTheOrderIsByNameLengthThenNameThenFqn() {
    final List<ColumnDocument> ranked =
        TechnicalColumnIndex.closestFirst(
            List.of(column("B", "bb"), column("A", "bb"), column("A", "a")), "", 10);

    assertEquals("MIS.MISDB.cs1.A.a", ranked.getFirst().columnFqn());
    assertEquals("MIS.MISDB.cs1.A.bb", ranked.get(1).columnFqn());
  }

  @Test
  @SuppressWarnings("unchecked")
  void theQueryScoresExactPrefixContainsTableAndFqnMatchesInThatOrder() {
    final Map<String, Object> bool =
        (Map<String, Object>) TechnicalColumnIndex.textQuery("nm").get("bool");
    final List<Map<String, Object>> should = (List<Map<String, Object>>) bool.get("should");

    assertEquals(1, bool.get("minimum_should_match"));
    assertEquals(
        List.of("term", "prefix", "wildcard", "wildcard", "wildcard"),
        should.stream().map(clause -> clause.keySet().iterator().next()).toList());
    final List<Integer> boosts =
        should.stream()
            .map(clause -> (Map<String, Object>) clause.values().iterator().next())
            .map(field -> (Map<String, Object>) field.values().iterator().next())
            .map(spec -> (Integer) spec.get("boost"))
            .toList();
    assertEquals(List.of(1000, 500, 100, 10, 1), boosts);
  }

  @Test
  @SuppressWarnings("unchecked")
  void aBlankTextAddsNoRelevanceClauses() {
    final Map<String, Object> bool =
        (Map<String, Object>) TechnicalColumnIndex.textQuery("").get("bool");

    assertFalse(bool.containsKey("should"));
    assertTrue(bool.containsKey("filter"));
  }
}
