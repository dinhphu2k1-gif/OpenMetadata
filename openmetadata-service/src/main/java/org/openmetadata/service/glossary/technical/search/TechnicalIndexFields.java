/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

/** Field names of a `technical_dictionary_search_index` document and of a list row. */
public final class TechnicalIndexFields {
  public static final String TERM_ID = "termId";
  public static final String COLUMN_KEY = "columnKey";
  public static final String COLUMN_FQN = "columnFqn";
  public static final String SERVICE = "service";
  public static final String DATABASE = "database";
  public static final String SCHEMA = "schema";
  public static final String TABLE = "table";
  public static final String COLUMN = "column";
  public static final String TABLE_KEY = "tableKey";
  public static final String DATA_TYPE = "dataType";
  public static final String DATA_LENGTH = "dataLength";
  public static final String PRECISION = "precision";
  public static final String SCALE = "scale";
  public static final String DESCRIPTION = "description";
  public static final String SOURCE_STATUS = "sourceStatus";
  public static final String DATA_DICTIONARY_VERSION = "dataDictionaryVersion";
  public static final String REVISION = "revision";
  public static final String CDE = "cde";
  public static final String DATA_OWNERS = "dataOwners";
  public static final String RANK = "rank";
  public static final String ELEMENT_TYPE = "elementType";
  public static final String GENERATION_TYPE = "generationType";
  public static final String CREATION_METHOD = "creationMethod";
  public static final String TIMELINESS = "timeliness";
  public static final String SYSTEM_OWNER = "systemOwner";
  public static final String CREATED_AT = "createdAt";
  public static final String CREATED_BY = "createdBy";
  public static final String UPDATED_AT = "updatedAt";
  public static final String UPDATED_BY = "updatedBy";

  public static final String ID = "id";
  public static final String CODE = "code";
  public static final String NAME = "name";
  public static final String BUSINESS_VERSION = "businessVersion";
  public static final String ASSIGNED_AT = "assignedAt";
  public static final String ASSIGNED_BY = "assignedBy";
  public static final String FQN = "fqn";
  public static final String LABEL = "label";
  public static final String NGRAM = "ngram";

  private TechnicalIndexFields() {}

  /** Dotted path of a nested field, for example {@code cde.id}. */
  public static String path(String... segments) {
    return String.join(".", segments);
  }
}
