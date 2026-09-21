/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.util;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Canonical validator and comparator for glossary business versions. */
public final class GlossaryBusinessVersion {
  private static final Pattern CANONICAL_VERSION =
      Pattern.compile("^(0|[1-9]\\d*)(\\.(0|[1-9]\\d*))*$");

  private GlossaryBusinessVersion() {}

  /** Validate and return the canonical business version used by the snapshot store. */
  public static String requireCanonical(String version) {
    if (version == null || !CANONICAL_VERSION.matcher(version.trim()).matches()) {
      throw new IllegalArgumentException(
          "businessVersion must contain dot-separated non-negative integers");
    }
    return version.trim();
  }

  public static int compare(String left, String right) {
    List<BigInteger> leftParts = parts(left);
    List<BigInteger> rightParts = parts(right);
    int length = Math.max(leftParts.size(), rightParts.size());
    for (int index = 0; index < length; index++) {
      BigInteger leftValue = index < leftParts.size() ? leftParts.get(index) : BigInteger.ZERO;
      BigInteger rightValue = index < rightParts.size() ? rightParts.get(index) : BigInteger.ZERO;
      int result = leftValue.compareTo(rightValue);
      if (result != 0) {
        return result;
      }
    }
    return 0;
  }

  private static List<BigInteger> parts(String version) {
    String normalized =
        version == null ? "" : version.trim().replaceFirst("(?i)^(version|v)\\s*", "");
    List<BigInteger> values = new ArrayList<>();
    for (String part : normalized.split("[.-]")) {
      try {
        values.add(new BigInteger(part));
      } catch (NumberFormatException exception) {
        values.add(BigInteger.ZERO);
      }
    }
    return values;
  }
}
