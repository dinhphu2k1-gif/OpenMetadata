/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quality threshold of a Data Quality Rule or of one of its test declarations.
 *
 * <pre>
 * percentage := (">=" | ">" | "=" | "<=" | "<") decimal "%"
 * count      := "count" ("=" | "<=") nonNegativeInteger
 * </pre>
 */
public record DqThreshold(Kind kind, String operator, BigDecimal value) {
  public static final int MAX_LENGTH = 64;
  private static final Pattern PERCENTAGE =
      Pattern.compile("^(>=|<=|>|<|=)\\s*(\\d+(?:\\.\\d+)?)\\s*%$");
  private static final Pattern COUNT = Pattern.compile("^count\\s*(=|<=)\\s*(\\d+)$");

  public enum Kind {
    PERCENTAGE,
    COUNT
  }

  public static Optional<DqThreshold> parse(String text) {
    Optional<DqThreshold> result = Optional.empty();
    if (text != null && !text.isBlank() && text.length() <= MAX_LENGTH) {
      final String normalized = text.trim().toLowerCase(java.util.Locale.ROOT);
      result = parsePercentage(normalized).or(() -> parseCount(normalized));
    }
    return result;
  }

  public boolean isPercentage() {
    return kind == Kind.PERCENTAGE;
  }

  /** True when {@code actual} satisfies the threshold. */
  public boolean isSatisfiedBy(BigDecimal actual) {
    final int comparison = actual.compareTo(value);
    return switch (operator) {
      case ">=" -> comparison >= 0;
      case ">" -> comparison > 0;
      case "<=" -> comparison <= 0;
      case "<" -> comparison < 0;
      default -> comparison == 0;
    };
  }

  private static Optional<DqThreshold> parsePercentage(String text) {
    final Matcher matcher = PERCENTAGE.matcher(text);
    Optional<DqThreshold> result = Optional.empty();
    if (matcher.matches()) {
      final BigDecimal value = new BigDecimal(matcher.group(2));
      if (value.compareTo(BigDecimal.valueOf(100)) <= 0) {
        result = Optional.of(new DqThreshold(Kind.PERCENTAGE, matcher.group(1), value));
      }
    }
    return result;
  }

  private static Optional<DqThreshold> parseCount(String text) {
    final Matcher matcher = COUNT.matcher(text);
    return matcher.matches()
        ? Optional.of(
            new DqThreshold(Kind.COUNT, matcher.group(1), new BigDecimal(matcher.group(2))))
        : Optional.empty();
  }
}
