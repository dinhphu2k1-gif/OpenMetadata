/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DqTestSpecSqlTest {
  private static final String VALID =
      "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} IS NOT NULL "
          + "AND NOT REGEXP_LIKE({{ column_name }}, '^[0-9]{12}$')";

  private static List<String> problems(String sql) {
    return DqTestSpecSql.problems(sql, Set.of());
  }

  @Test
  void acceptsSelectReturningViolations() {
    assertEquals(List.of(), problems(VALID));
  }

  @Test
  void acceptsGroupByWithAggregateInHaving() {
    assertEquals(
        List.of(),
        problems(
            "SELECT {{ column_name }} FROM {{ table_name }} GROUP BY {{ column_name }} HAVING COUNT(*) > 1"));
  }

  @Test
  void acceptsWithClause() {
    assertEquals(
        List.of(),
        problems(
            "WITH d AS (SELECT {{ column_name }} AS v FROM {{ table_name }}) SELECT v FROM d WHERE v IS NULL"));
  }

  @Test
  void collectsTemplateVariables() {
    assertEquals(Set.of("table_name", "column_name"), DqTestSpecSql.variables(VALID));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "DELETE FROM {{ table_name }} WHERE {{ column_name }} IS NULL",
        "UPDATE {{ table_name }} SET {{ column_name }} = 1",
        "DROP TABLE {{ table_name }}",
        "SELECT {{ column_name }} INTO backup FROM {{ table_name }}",
        "SELECT {{ column_name }} FROM {{ table_name }}; DROP TABLE x",
        "SELECT {{ column_name }} FROM {{ table_name }} -- ; DROP TABLE x",
        "SELECT {{ column_name }} FROM {{ table_name }} /* DROP */",
        "CALL purge('{{ table_name }}')",
        "SELECT {{ column_name }} FROM {{ table_name }} FOR UPDATE"
      })
  void rejectsWritingOrMultipleStatements(String sql) {
    assertFalse(problems(sql).isEmpty(), sql);
  }

  @Test
  void ignoresKeywordsInsideLiterals() {
    assertEquals(
        List.of(),
        problems(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} = 'delete; drop'"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT COUNT(*) FROM {{ table_name }} WHERE {{ column_name }} IS NULL",
        "select count(*) from {{ table_name }} where {{ column_name }} is null",
        "SELECT COUNT(DISTINCT {{ column_name }}) AS n FROM {{ table_name }}",
        "SELECT SUM({{ column_name }}) FROM {{ table_name }}"
      })
  void rejectsAggregateOnlySelect(String sql) {
    assertTrue(problems(sql).stream().anyMatch(problem -> problem.contains("aggregate")), sql);
  }

  @Test
  void requiresTableAndColumnVariables() {
    final List<String> problems = problems("SELECT 1 FROM dual");
    assertTrue(problems.contains("SQL must use {{ table_name }}"));
    assertTrue(problems.contains("SQL must use {{ column_name }}"));
  }

  @Test
  void otherVariablesNeedAValue() {
    final String sql =
        "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} > {{ limit }}";
    assertFalse(DqTestSpecSql.problems(sql, Set.of()).isEmpty());
    assertEquals(List.of(), DqTestSpecSql.problems(sql, Set.of("limit")));
  }

  @Test
  void rejectsBlankAndComplexTemplates() {
    assertFalse(problems(" ").isEmpty());
    assertFalse(problems("SELECT {{ column_name | upper }} FROM {{ table_name }}").isEmpty());
    assertFalse(
        problems("{% if x %}SELECT {{ column_name }} FROM {{ table_name }}{% endif %}").isEmpty());
  }
}
