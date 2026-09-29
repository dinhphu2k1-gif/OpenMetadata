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
  public static final String MANUAL_CREATE_NOT_ALLOWED = "TD_MANUAL_CREATE_NOT_ALLOWED";
  public static final String MANUAL_DELETE_NOT_ALLOWED = "TD_MANUAL_DELETE_NOT_ALLOWED";
  public static final String SERVER_OWNED_FIELD = "TD_SERVER_OWNED_FIELD";
  public static final String INVALID_FIELD = "TD_INVALID_FIELD";
  public static final String SOURCE_UNAVAILABLE = "TD_SOURCE_UNAVAILABLE";
  public static final String RANK_REQUIRED = "TD_RANK_REQUIRED";
  public static final String RANK_DUPLICATE = "TD_RANK_DUPLICATE";
  public static final String CDE_SCOPE_MISMATCH = "TD_CDE_SCOPE_MISMATCH";
  public static final String CDE_SCOPE_NOT_ACTIVE = "TD_CDE_SCOPE_NOT_ACTIVE";
  public static final String COLUMN_SCOPE_EMPTY = "TD_COLUMN_SCOPE_EMPTY";
  public static final String BOOTSTRAP_NOT_READY = "TD_BOOTSTRAP_NOT_READY";
  public static final String IMPORT_ROW_NOT_MATCHED = "TD_IMPORT_ROW_NOT_MATCHED";

  private TechnicalDictionaryErrors() {}

  public static WebApplicationException badRequest(String code, String message) {
    return error(Response.Status.BAD_REQUEST, code, message);
  }

  public static WebApplicationException forbidden(String code, String message) {
    return error(Response.Status.FORBIDDEN, code, message);
  }

  public static WebApplicationException conflict(String code, String message) {
    return error(Response.Status.CONFLICT, code, message);
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
