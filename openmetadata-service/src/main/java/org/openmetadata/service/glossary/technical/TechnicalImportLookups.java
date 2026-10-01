/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import java.util.UUID;

/** Reference resolution used by the import planner; failures are reported per row and column. */
public interface TechnicalImportLookups {

  /** Tag FQN of the classification tag with the given display name. */
  String tag(String classification, String displayName);

  /** Id of the team with the given display name. */
  UUID team(String displayName);

  /** Resolves an Approved CDE of the bound Data Dictionary version by its code. */
  TechnicalCdeInfo cde(String code);

  /** Physical Columns of one table that may be declared by the import. */
  default List<TechnicalColumnSource> columns(String database, String schema, String table) {
    return List.of();
  }

  /** The Available record that holds a rank of a CDE, or null. */
  default TechnicalRecord rankHolder(String cdeId, int rank) {
    return null;
  }

  /** A lookup failure with a stable code, attributed to the column being resolved. */
  class LookupException extends RuntimeException {
    private final String code;

    public LookupException(String code, String message) {
      super(message);
      this.code = code;
    }

    public String code() {
      return code;
    }
  }
}
