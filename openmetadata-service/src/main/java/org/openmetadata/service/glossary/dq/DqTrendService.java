/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.dq.DqResultService.RuleState;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * Daily pass rate of a Rule or a CDE over the last 30 or 90 days, computed when read from the
 * native time-series of every testcase that was bound in the period, including retired ones.
 */
public final class DqTrendService {
  public static final int SHORT_PERIOD_DAYS = 30;
  public static final int LONG_PERIOD_DAYS = 90;
  private static final long DAY_MILLIS = 86_400_000L;

  private DqTrendService() {}

  public static Map<String, Object> ruleTrend(String ruleId, int days, String specKey) {
    final RuleState state = DqResultService.load(ruleId);
    final List<BindingRow> bindings =
        state.evaluated().stream()
            .filter(item -> specKey != null || !DqResultService.isDiscontinued(state, item))
            .map(item -> item.binding())
            .filter(binding -> specKey == null || binding.specKey().equals(specKey))
            .toList();
    return trend(List.of(state), bindings, normalize(days));
  }

  public static Map<String, Object> cdeTrend(String cdeId, int days) {
    final List<RuleState> states = DqResultService.ruleStatesOfCde(cdeId);
    final List<BindingRow> bindings = new ArrayList<>();
    states.forEach(
        state ->
            state.evaluated().stream()
                .filter(item -> !DqResultService.isDiscontinued(state, item))
                .forEach(item -> bindings.add(item.binding())));
    return trend(states, bindings, normalize(days));
  }

  private static Map<String, Object> trend(
      List<RuleState> states, List<BindingRow> bindings, int days) {
    final long end = System.currentTimeMillis();
    final long start = end - days * DAY_MILLIS;
    final Map<LocalDate, long[]> byDay = new TreeMap<>();
    for (BindingRow binding : bindings) {
      if (binding.testCaseFqn() != null) {
        addBinding(byDay, binding, start, end);
      }
    }
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("days", days);
    body.put("points", points(byDay));
    body.put("versions", versions(states, start));
    return body;
  }

  /** The latest result of each day of the testcase, counted in rows rather than in testcases. */
  private static void addBinding(
      Map<LocalDate, long[]> byDay, BindingRow binding, long start, long end) {
    final Map<LocalDate, TestCaseResult> latestPerDay = new HashMap<>();
    for (TestCaseResult result :
        DqResultService.resultsRepository()
            .getTestCaseResults(binding.testCaseFqn(), start, end)
            .getData()) {
      final LocalDate day = dayOf(result.getTimestamp());
      final TestCaseResult current = latestPerDay.get(day);
      if (current == null || current.getTimestamp() < result.getTimestamp()) {
        latestPerDay.put(day, result);
      }
    }
    latestPerDay.forEach((day, result) -> count(byDay, day, result));
  }

  private static void count(Map<LocalDate, long[]> byDay, LocalDate day, TestCaseResult result) {
    if (result.getPassedRows() != null && result.getFailedRows() != null) {
      final long[] counts = byDay.computeIfAbsent(day, key -> new long[2]);
      counts[0] += result.getPassedRows();
      counts[1] += totalRows(result);
    }
  }

  /**
   * The rows the engine measured the percentages against, which can exceed passed plus failed
   * (for instance rows a test skips); recovered from a percentage because the result has no total.
   */
  static long totalRows(TestCaseResult result) {
    long total = result.getPassedRows() + result.getFailedRows();
    if (result.getPassedRowsPercentage() != null && result.getPassedRowsPercentage() > 0) {
      total = Math.round(result.getPassedRows() * 100 / result.getPassedRowsPercentage());
    } else if (result.getFailedRowsPercentage() != null && result.getFailedRowsPercentage() > 0) {
      total = Math.round(result.getFailedRows() * 100 / result.getFailedRowsPercentage());
    }
    return total;
  }

  private static List<Map<String, Object>> points(Map<LocalDate, long[]> byDay) {
    final List<Map<String, Object>> points = new ArrayList<>();
    byDay.forEach(
        (day, counts) -> {
          final Map<String, Object> point = new LinkedHashMap<>();
          point.put("date", day.toString());
          point.put("passed", counts[0]);
          point.put("total", counts[1]);
          point.put("passRate", counts[1] == 0 ? 0.0 : (double) counts[0] / counts[1]);
          points.add(point);
        });
    return points;
  }

  private static List<Map<String, Object>> versions(List<RuleState> states, long start) {
    final List<Map<String, Object>> versions = new ArrayList<>();
    for (RuleState state : states) {
      for (PublishedSnapshotRecord snapshot :
          Entity.getJdbi()
              .onDemand(GlossaryVersionDAO.class)
              .listPublished(Entity.GLOSSARY_TERM, UUID.fromString(state.row().ruleTermId()))) {
        if (snapshot.publishedAt() >= start) {
          final Map<String, Object> version = new LinkedHashMap<>();
          version.put("ruleCode", state.context().code());
          version.put("businessVersion", snapshot.businessVersion());
          version.put("publishedAt", snapshot.publishedAt());
          versions.add(version);
        }
      }
    }
    return versions;
  }

  private static LocalDate dayOf(long timestamp) {
    return Instant.ofEpochMilli(timestamp)
        .atZone(ZoneId.of(DqSchedule.DEFAULT_TIMEZONE))
        .toLocalDate();
  }

  private static int normalize(int days) {
    return days >= LONG_PERIOD_DAYS ? LONG_PERIOD_DAYS : SHORT_PERIOD_DAYS;
  }
}
