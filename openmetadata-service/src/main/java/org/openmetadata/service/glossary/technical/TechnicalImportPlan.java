/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.Map;

/** Value types of a Technical Dictionary import plan. */
public final class TechnicalImportPlan {
  public static final String CREATE_RECORD = "CREATE_RECORD";
  public static final String UPDATE = "UPDATE";
  public static final String NO_CHANGE = "NO_CHANGE";
  public static final String ERROR = "ERROR";

  public static final List<String> ACTIONS = List.of(CREATE_RECORD, UPDATE, NO_CHANGE);

  private TechnicalImportPlan() {}

  /** A column of the file that was present: `value == null` clears the stored value. */
  public record Field<T>(boolean specified, T value) {
    public static <T> Field<T> absent() {
      return new Field<>(false, null);
    }

    public static <T> Field<T> of(T value) {
      return new Field<>(true, value);
    }
  }

  /** Editable changes requested by one row; tags are keyed by classification. */
  public record RowPatch(
      Field<TechnicalCdeInfo> cde,
      Field<Integer> rank,
      Map<String, Field<String>> tags,
      Field<java.util.UUID> systemOwner) {}

  public record ImportError(int rowNumber, String column, String code, String message) {}

  public record PlannedRow(
      int rowNumber,
      String location,
      String action,
      String recordId,
      Long expectedRevision,
      @JsonIgnore RowPatch patch,
      @JsonIgnore TechnicalColumnSource column,
      List<ImportError> errors,
      List<String> warnings) {

    public boolean hasErrors() {
      return !errors.isEmpty();
    }

    public boolean mutates() {
      return CREATE_RECORD.equals(action) || UPDATE.equals(action);
    }
  }
}
