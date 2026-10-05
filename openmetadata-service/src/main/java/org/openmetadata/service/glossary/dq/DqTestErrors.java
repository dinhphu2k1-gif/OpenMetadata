/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;

/** Stable error codes of Data Quality Rule test execution returned as `{code, message}` bodies. */
public final class DqTestErrors {
  public static final String NAME_DUPLICATE = "DQ_TEST_SPEC_NAME_DUPLICATE";
  public static final String KEY_UNKNOWN = "DQ_TEST_SPEC_KEY_UNKNOWN";
  public static final String SQL_INVALID = "DQ_TEST_SPEC_SQL_INVALID";
  public static final String PARAM_INVALID = "DQ_TEST_SPEC_PARAM_INVALID";
  public static final String DEFINITION_IMMUTABLE = "DQ_TEST_SPEC_DEFINITION_IMMUTABLE";
  public static final String THRESHOLD_UNSUPPORTED = "DQ_THRESHOLD_UNSUPPORTED";
  public static final String MANAGED_TEST_CASE = "DQ_MANAGED_TEST_CASE";
  public static final String SCHEDULE_INVALID = "DQ_SCHEDULE_INVALID";
  public static final String RUN_IN_PROGRESS = "DQ_TEST_RUN_IN_PROGRESS";
  public static final String RUN_NOT_AVAILABLE = "DQ_TEST_RUN_NOT_AVAILABLE";
  public static final String NOT_A_RULE = "DQ_TEST_SPEC_NOT_A_RULE";

  private DqTestErrors() {}

  public static WebApplicationException badRequest(String code, String message, String specRef) {
    return TechnicalDictionaryErrors.error(
        Response.Status.BAD_REQUEST,
        code,
        specRef == null ? message : message + " [" + specRef + "]");
  }

  public static WebApplicationException conflict(String code, String message) {
    return TechnicalDictionaryErrors.conflict(code, message);
  }

  public static WebApplicationException forbidden(String code, String message) {
    return TechnicalDictionaryErrors.forbidden(code, message);
  }

  public static WebApplicationException notFound(String code, String message) {
    return TechnicalDictionaryErrors.notFound(code, message);
  }

  /** Body of a spec-level validation failure that also names the declaration. */
  public static Map<String, Object> specBody(String code, String message, String specKey) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("code", code);
    body.put("message", message);
    body.put("specKey", specKey);
    return body;
  }
}
