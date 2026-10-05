/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sf.jsqlparser.JSQLParserException;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.Select;

/**
 * Static checks of the SQL template of a {@code SQL} test declaration. The template must be one
 * read-only SELECT that returns the violating records; it runs against every Column of the CDE,
 * so the table and column are template variables.
 */
public final class DqTestSpecSql {
  public static final String TABLE_VARIABLE = "table_name";
  public static final String COLUMN_VARIABLE = "column_name";

  private static final Pattern TEMPLATE_VARIABLE =
      Pattern.compile("\\{\\{\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*}}");
  private static final Pattern WORD = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
  private static final Pattern AGGREGATE_ONLY =
      Pattern.compile(
          "^(count|sum|avg|min|max)\\s*\\(.*\\)\\s*(as\\s+\\w+|\\w+)?$",
          Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
  private static final Set<String> FORBIDDEN_WORDS =
      Set.of(
          "insert",
          "update",
          "delete",
          "drop",
          "alter",
          "create",
          "truncate",
          "merge",
          "grant",
          "revoke",
          "exec",
          "execute",
          "call",
          "into",
          "begin",
          "declare",
          "commit",
          "rollback");
  private static final Set<String> SELECT_STARTS = Set.of("select", "with");

  private DqTestSpecSql() {}

  /** Names of the template variables, in order of first use. */
  public static Set<String> variables(String sql) {
    final Set<String> names = new LinkedHashSet<>();
    final Matcher matcher = TEMPLATE_VARIABLE.matcher(sql == null ? "" : sql);
    while (matcher.find()) {
      names.add(matcher.group(1));
    }
    return names;
  }

  /** Returns the problems of the template; empty when it is acceptable. */
  public static List<String> problems(String sql, Set<String> parameterNames) {
    final java.util.ArrayList<String> problems = new java.util.ArrayList<>();
    if (sql == null || sql.isBlank()) {
      problems.add("SQL is required");
    } else {
      problems.addAll(templateProblems(sql, parameterNames));
      final String code = stripLiterals(TEMPLATE_VARIABLE.matcher(sql).replaceAll(" tpl "));
      problems.addAll(statementProblems(code));
      if (problems.isEmpty()) {
        problems.addAll(parserProblems(sql));
      }
    }
    return problems;
  }

  private static List<String> templateProblems(String sql, Set<String> parameterNames) {
    final java.util.ArrayList<String> problems = new java.util.ArrayList<>();
    final Set<String> variables = variables(sql);
    for (String required : List.of(TABLE_VARIABLE, COLUMN_VARIABLE)) {
      if (!variables.contains(required)) {
        problems.add("SQL must use {{ " + required + " }}");
      }
    }
    variables.stream()
        .filter(name -> !TABLE_VARIABLE.equals(name) && !COLUMN_VARIABLE.equals(name))
        .filter(name -> !parameterNames.contains(name))
        .forEach(
            name -> problems.add("Variable {{ " + name + " }} has no value in parameterValues"));
    if (TEMPLATE_VARIABLE.matcher(sql).replaceAll("").matches("(?s).*(\\{\\{|}}|\\{%).*")) {
      problems.add("Only simple {{ variable }} placeholders are allowed");
    }
    return problems;
  }

  private static List<String> statementProblems(String code) {
    final java.util.ArrayList<String> problems = new java.util.ArrayList<>();
    final String lower = code.toLowerCase(Locale.ROOT);
    if (lower.contains("--") || lower.contains("/*") || lower.contains("*/")) {
      problems.add("Comments are not allowed");
    }
    if (lower.contains(";")) {
      problems.add("Only one statement without ';' is allowed");
    }
    final List<String> words = words(lower);
    if (words.isEmpty() || !SELECT_STARTS.contains(words.getFirst())) {
      problems.add("SQL must be a SELECT statement");
    }
    words.stream()
        .filter(FORBIDDEN_WORDS::contains)
        .distinct()
        .forEach(
            word -> problems.add("Keyword '" + word.toUpperCase(Locale.ROOT) + "' is not allowed"));
    if (isAggregateOnly(code)) {
      problems.add("SQL must return the violating records, not an aggregate such as COUNT(*)");
    }
    return problems;
  }

  /** Dialect-specific SQL may not parse; only a parsed non-SELECT statement is rejected here. */
  private static List<String> parserProblems(String sql) {
    final java.util.ArrayList<String> problems = new java.util.ArrayList<>();
    final String parsable =
        TEMPLATE_VARIABLE
            .matcher(sql)
            .replaceAll(
                match ->
                    TABLE_VARIABLE.equals(match.group(1))
                        ? "dqr_table"
                        : COLUMN_VARIABLE.equals(match.group(1)) ? "dqr_column" : "'dqr'");
    try {
      final Statement statement = CCJSqlParserUtil.parse(parsable);
      if (!(statement instanceof Select)) {
        problems.add("SQL must be a SELECT statement");
      }
    } catch (JSQLParserException ignored) {
      // The dialect may be beyond the parser; the token checks above already ran.
    }
    return problems;
  }

  static List<String> words(String code) {
    final List<String> words = new java.util.ArrayList<>();
    final Matcher matcher = WORD.matcher(code);
    while (matcher.find()) {
      words.add(matcher.group());
    }
    return words;
  }

  /** Replaces quoted text with a placeholder so keywords and ';' inside literals are ignored. */
  static String stripLiterals(String sql) {
    final StringBuilder code = new StringBuilder();
    char quote = 0;
    for (int index = 0; index < sql.length(); index++) {
      final char current = sql.charAt(index);
      if (quote == 0) {
        if (current == '\'' || current == '"') {
          quote = current;
          code.append(' ');
        } else {
          code.append(current);
        }
      } else if (current == quote) {
        quote = 0;
      }
    }
    return code.toString();
  }

  /** True when the single select item is an aggregate call such as {@code COUNT(*)}. */
  static boolean isAggregateOnly(String code) {
    final String compact = code.trim().replaceAll("\\s+", " ");
    final String lower = compact.toLowerCase(Locale.ROOT);
    boolean aggregateOnly = false;
    if (lower.startsWith("select ")) {
      final String items = selectItems(compact.substring("select ".length()));
      aggregateOnly = topLevelCommas(items) == 0 && AGGREGATE_ONLY.matcher(items.trim()).matches();
    }
    return aggregateOnly;
  }

  private static String selectItems(String afterSelect) {
    final String lower = afterSelect.toLowerCase(Locale.ROOT);
    int depth = 0;
    int end = afterSelect.length();
    for (int index = 0; index < afterSelect.length() && end == afterSelect.length(); index++) {
      final char current = afterSelect.charAt(index);
      depth += current == '(' ? 1 : current == ')' ? -1 : 0;
      if (depth == 0 && lower.startsWith(" from ", index)) {
        end = index;
      }
    }
    return afterSelect.substring(0, end).replaceFirst("(?i)^(distinct|all)\\s+", "");
  }

  private static int topLevelCommas(String items) {
    int depth = 0;
    int commas = 0;
    for (char current : items.toCharArray()) {
      depth += current == '(' ? 1 : current == ')' ? -1 : 0;
      commas += depth == 0 && current == ',' ? 1 : 0;
    }
    return commas;
  }
}
