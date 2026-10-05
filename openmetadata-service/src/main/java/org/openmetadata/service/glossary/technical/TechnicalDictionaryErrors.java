/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/** Stable Technical Dictionary error codes returned as `{code, message}` bodies. */
public final class TechnicalDictionaryErrors {
  public static final String SERVER_OWNED_FIELD = "TD_SERVER_OWNED_FIELD";
  public static final String INVALID_FIELD = "TD_INVALID_FIELD";
  public static final String RANK_REQUIRED = "TD_RANK_REQUIRED";
  public static final String RANK_DUPLICATE = "TD_RANK_DUPLICATE";
  public static final String CDE_SCOPE_NOT_ACTIVE = "TD_CDE_SCOPE_NOT_ACTIVE";
  public static final String DATA_DICTIONARY_NOT_ACTIVE = "TD_DATA_DICTIONARY_NOT_ACTIVE";
  public static final String NOT_INITIALIZED = "TD_NOT_INITIALIZED";
  public static final String RECORD_NOT_FOUND = "TD_RECORD_NOT_FOUND";
  public static final String RECORD_REVISION_CONFLICT = "TD_RECORD_REVISION_CONFLICT";
  public static final String IMPORT_ROW_NOT_MATCHED = "TD_IMPORT_ROW_NOT_MATCHED";
  public static final String IMPORT_CONFLICT = "TD_IMPORT_CONFLICT";
  public static final String IMPORT_SESSION_INVALID = "TD_IMPORT_SESSION_INVALID";
  public static final String INDEX_UNAVAILABLE = "TD_INDEX_UNAVAILABLE";
  public static final String COLUMN_NOT_FOUND = "TD_COLUMN_NOT_FOUND";
  public static final String COLUMN_ALREADY_DECLARED = "TD_COLUMN_ALREADY_DECLARED";
  public static final String INVALID_STATUS_TRANSITION = "TD_INVALID_STATUS_TRANSITION";
  public static final String SELF_APPROVAL_FORBIDDEN = "TD_SELF_APPROVAL_FORBIDDEN";
  public static final String REJECTION_COMMENT_REQUIRED = "TD_REJECTION_COMMENT_REQUIRED";

  private TechnicalDictionaryErrors() {}

  public static WebApplicationException badRequest(String code, String message) {
    return error(Response.Status.BAD_REQUEST, code, message);
  }

  public static WebApplicationException forbidden(String code, String message) {
    return error(Response.Status.FORBIDDEN, code, message);
  }

  public static WebApplicationException notFound(String code, String message) {
    return error(Response.Status.NOT_FOUND, code, message);
  }

  public static WebApplicationException conflict(String code, String message) {
    return error(Response.Status.CONFLICT, code, message);
  }

  public static WebApplicationException indexUnavailable(String message) {
    return error(Response.Status.SERVICE_UNAVAILABLE, INDEX_UNAVAILABLE, message);
  }

  /** Stable code of an error created by this class, or an HTTP-status fallback. */
  public static String codeOf(WebApplicationException exception) {
    return exception.getResponse().getEntity() instanceof Map<?, ?> body && body.get("code") != null
        ? String.valueOf(body.get("code"))
        : "HTTP_" + exception.getResponse().getStatus();
  }

  public static WebApplicationException error(Response.Status status, String code, String message) {
    return new WebApplicationException(
        message,
        Response.status(status)
            .type(MediaType.APPLICATION_JSON_TYPE)
            .entity(Map.of("code", code, "message", message))
            .build());
  }
}
