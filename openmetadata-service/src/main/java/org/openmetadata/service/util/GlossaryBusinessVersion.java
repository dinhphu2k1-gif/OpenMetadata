/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.util;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/** Canonical reader, writer, and comparator for glossary business versions. */
public final class GlossaryBusinessVersion {
  public static final String DEFAULT_VERSION = "1.0";

  private GlossaryBusinessVersion() {}

  public static String get(Object extension) {
    JsonNode node = JsonUtils.valueToTree(extension);
    for (String field : List.of("version", "cdeVersion", "phien_ban")) {
      JsonNode value = node.path(field);
      if (!value.isMissingNode() && !value.isNull() && !value.asText().isBlank()) {
        return value.asText().trim();
      }
    }
    return DEFAULT_VERSION;
  }

  public static Map<String, Object> normalize(Object extension, String version) {
    Map<String, Object> normalized = new HashMap<>();
    if (extension instanceof Map<?, ?> values) {
      values.forEach((key, value) -> normalized.put(String.valueOf(key), value));
    }
    normalized.remove("cdeVersion");
    normalized.remove("phien_ban");
    normalized.put("version", version == null || version.isBlank() ? get(extension) : version.trim());
    return normalized;
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

  public static boolean appliesTo(String... identifiers) {
    List<String> aliases =
        List.of(
            "Data Dictionary",
            "Từ điển dữ liệu dùng chung",
            "Data Quality",
            "Chất lượng dữ liệu",
            "Kiểm tra chất lượng dữ liệu",
            "Quy tắc chất lượng dữ liệu",
            "DataQuality");
    for (String identifier : identifiers) {
      if (identifier == null) {
        continue;
      }
      for (String alias : aliases) {
        if (identifier.equals(alias) || identifier.startsWith(alias + ".")) {
          return true;
        }
      }
    }
    return false;
  }

  private static List<BigInteger> parts(String version) {
    String normalized = version == null ? "" : version.trim().replaceFirst("(?i)^(version|v)\\s*", "");
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
