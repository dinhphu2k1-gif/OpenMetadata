/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecs;

/**
 * Issues the {@code key} of test declarations. A key is {@code t<n>}, stable within the Rule
 * identity and never reused, so the results of a declaration stay continuous across versions.
 */
public final class DqTestSpecKeys {
  private static final Pattern KEY = Pattern.compile("^t([1-9][0-9]*)$");
  private static final String PREFIX = "t";

  private DqTestSpecKeys() {}

  /** Highest key number found in the declarations of one payload; 0 when there is none. */
  public static int highestNumber(DqTestSpecs specs) {
    int highest = 0;
    if (specs != null && !nullOrEmpty(specs.getItems())) {
      for (DqTestSpec spec : specs.getItems()) {
        highest = Math.max(highest, numberOf(spec.getKey()));
      }
    }
    return highest;
  }

  public static Set<String> keysOf(DqTestSpecs specs) {
    final Set<String> keys = new java.util.LinkedHashSet<>();
    if (specs != null && !nullOrEmpty(specs.getItems())) {
      specs.getItems().stream()
          .map(DqTestSpec::getKey)
          .filter(key -> !nullOrEmpty(key))
          .forEach(keys::add);
    }
    return keys;
  }

  /**
   * Returns the declarations with a key on every item. Items that already carry a key must use one
   * that was issued before ({@code issuedUpTo} is the highest number ever issued); items without
   * a key get the next numbers.
   */
  public static DqTestSpecs assign(DqTestSpecs incoming, int issuedUpTo) {
    final List<DqTestSpec> items = new ArrayList<>();
    int next = issuedUpTo;
    final Set<String> seen = new java.util.HashSet<>();
    final List<DqTestSpec> source = incoming == null ? List.of() : listOrEmpty(incoming.getItems());
    for (int index = 0; index < source.size(); index++) {
      final DqTestSpec spec = source.get(index);
      final String key = spec.getKey();
      if (nullOrEmpty(key)) {
        next++;
        items.add(copyWithKey(spec, PREFIX + next));
      } else {
        requireIssued(key, issuedUpTo, index);
        requireUnique(seen, key, index);
        items.add(spec);
      }
    }
    return new DqTestSpecs().withSchemaVersion(1).withItems(items);
  }

  private static void requireIssued(String key, int issuedUpTo, int index) {
    if (numberOf(key) == 0 || numberOf(key) > issuedUpTo) {
      throw DqTestErrors.badRequest(
          DqTestErrors.KEY_UNKNOWN,
          "Test declaration key '" + key + "' was never issued for this rule",
          "item #" + (index + 1));
    }
  }

  private static void requireUnique(Set<String> seen, String key, int index) {
    if (!seen.add(key)) {
      throw DqTestErrors.badRequest(
          DqTestErrors.KEY_UNKNOWN,
          "Test declaration key '" + key + "' is used twice",
          "item #" + (index + 1));
    }
  }

  private static DqTestSpec copyWithKey(DqTestSpec spec, String key) {
    return new DqTestSpec()
        .withKey(key)
        .withName(spec.getName())
        .withKind(spec.getKind())
        .withTestDefinitionFqn(spec.getTestDefinitionFqn())
        .withSqlExpression(spec.getSqlExpression())
        .withParameterValues(spec.getParameterValues())
        .withComputePassedFailedRowCount(spec.getComputePassedFailedRowCount())
        .withThreshold(spec.getThreshold())
        .withScheduleCron(spec.getScheduleCron())
        .withScheduleTimezone(spec.getScheduleTimezone());
  }

  static int numberOf(String key) {
    final Matcher matcher = key == null ? KEY.matcher("") : KEY.matcher(key);
    return matcher.matches() ? Integer.parseInt(matcher.group(1)) : 0;
  }

  private static <T> List<T> listOrEmpty(List<T> list) {
    return list == null ? List.of() : list;
  }
}
