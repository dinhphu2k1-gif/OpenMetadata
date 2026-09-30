/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;

/** Reference resolution used by the import planner; failures are reported per row and column. */
public interface TechnicalImportLookups {

  TagLabel tag(String classification, String displayName);

  EntityReference team(String displayName);

  /** Resolves an Approved CDE of the same-numbered Data Dictionary by its code. */
  TermRelation cde(String code);

  /** Physical Columns of one table that have no record yet and may be declared by the import. */
  default List<TechnicalColumnSource> columns(String database, String schema, String table) {
    return List.of();
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
