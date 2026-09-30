/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;

/** Value types of a Technical Dictionary import plan. */
public final class TechnicalImportPlan {
  public static final String UPDATE_DRAFT = "UPDATE_DRAFT";
  public static final String REPLACE_IN_REVIEW_AND_REOPEN = "REPLACE_IN_REVIEW_AND_REOPEN";
  public static final String REPLACE_REJECTED_AND_REOPEN = "REPLACE_REJECTED_AND_REOPEN";
  public static final String CREATE_VERSION = "CREATE_VERSION";
  public static final String CREATE_RECORD = "CREATE_RECORD";
  public static final String SKIP = "SKIP";
  public static final String NO_CHANGE = "NO_CHANGE";
  public static final String ERROR = "ERROR";

  public static final List<String> ACTIONS =
      List.of(
          UPDATE_DRAFT,
          REPLACE_IN_REVIEW_AND_REOPEN,
          REPLACE_REJECTED_AND_REOPEN,
          CREATE_VERSION,
          CREATE_RECORD,
          SKIP,
          NO_CHANGE);

  private TechnicalImportPlan() {}

  /** Update policy chosen before the preview. */
  public enum UpdatePolicy {
    DRAFT_ONLY,
    ALL_EDITABLE;

    public static UpdatePolicy from(String value) {
      try {
        return value == null || value.isBlank() ? DRAFT_ONLY : valueOf(value);
      } catch (IllegalArgumentException exception) {
        throw new jakarta.ws.rs.BadRequestException(
            "updatePolicy must be DRAFT_ONLY or ALL_EDITABLE");
      }
    }
  }

  /** A column of the file that was present: `value == null` clears the stored value. */
  public record Field<T>(boolean specified, T value) {
    public static <T> Field<T> absent() {
      return new Field<>(false, null);
    }

    public static <T> Field<T> of(T value) {
      return new Field<>(true, value);
    }
  }

  /** Editable changes requested by one row. */
  public record RowPatch(
      Field<TermRelation> cde,
      Field<Integer> rank,
      Map<String, Field<TagLabel>> tags,
      Field<EntityReference> systemOwner) {}

  public record ImportError(int rowNumber, String column, String code, String message) {}

  public record PlannedRow(
      int rowNumber,
      String location,
      String action,
      UUID termId,
      Long expectedRevision,
      String expectedPublishedVersion,
      String newBusinessVersion,
      @JsonIgnore RowPatch patch,
      @JsonIgnore TechnicalColumnSource column,
      List<ImportError> errors,
      List<String> warnings) {

    public boolean hasErrors() {
      return !errors.isEmpty();
    }

    public boolean mutates() {
      return List.of(
              UPDATE_DRAFT,
              REPLACE_IN_REVIEW_AND_REOPEN,
              REPLACE_REJECTED_AND_REOPEN,
              CREATE_VERSION,
              CREATE_RECORD)
          .contains(action);
    }
  }
}
