/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import java.math.BigInteger;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/** Server-owned CDE release-version classification derived from the business version. */
public final class CdeReleaseVersionType {
  public static final String PROPERTY = "releaseVersionType";
  public static final String MAIN = "Bản chính";
  public static final String SECONDARY = "Bản phụ";

  private CdeReleaseVersionType() {}

  public static String fromBusinessVersion(String businessVersion) {
    String canonical = GlossaryBusinessVersion.requireCanonical(businessVersion);
    String[] parts = canonical.split("\\.", -1);
    return new BigInteger(parts[1]).signum() == 0 ? MAIN : SECONDARY;
  }

  public static void rejectClientValue(Object extension) {
    if (extension instanceof Map<?, ?> values && values.containsKey(PROPERTY)) {
      throw new BadRequestException(PROPERTY + " is server-owned and cannot be supplied by clients");
    }
  }

  public static Object apply(Object sourcePayload, String businessVersion) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof Map<?, ?> raw)) {
      throw new BadRequestException("CDE payload must be a JSON object");
    }
    Map<String, Object> payload = stringKeyMap(raw);
    Object currentExtension = payload.get("extension");
    Map<String, Object> extension =
        currentExtension instanceof Map<?, ?> values
            ? stringKeyMap(values)
            : new LinkedHashMap<>();
    // OpenMetadata represents enum custom-property values as JSON arrays,
    // including single-select enums.
    extension.put(PROPERTY, List.of(fromBusinessVersion(businessVersion)));
    payload.put("extension", extension);
    return payload;
  }

  @SuppressWarnings("unchecked")
  public static void project(Map<String, Object> payload, String businessVersion) {
    Object normalized = apply(payload, businessVersion);
    payload.clear();
    payload.putAll((Map<String, Object>) normalized);
  }

  private static Map<String, Object> stringKeyMap(Map<?, ?> source) {
    Map<String, Object> result = new LinkedHashMap<>();
    source.forEach((key, value) -> result.put(String.valueOf(key), value));
    return result;
  }
}
