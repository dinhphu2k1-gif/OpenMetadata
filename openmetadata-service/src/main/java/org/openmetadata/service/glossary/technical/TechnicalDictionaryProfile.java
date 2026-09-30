/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.type.TableType;

/** Schema manifest of the Technical Dictionary governed glossary profile (schemaVersion 1). */
public final class TechnicalDictionaryProfile {
  public static final int SCHEMA_VERSION = 1;

  public static final String SURVIVORSHIP_RANK = "survivorshipRank";
  public static final String SYSTEM_OWNER = "systemOwner";
  public static final String SOURCE_COLUMN_FQN = "sourceColumnFqn";
  public static final String SOURCE_SERVICE = "sourceService";
  public static final String SOURCE_DATABASE = "sourceDatabase";
  public static final String SOURCE_SCHEMA = "sourceSchema";
  public static final String SOURCE_TABLE = "sourceTable";
  public static final String SOURCE_COLUMN = "sourceColumn";
  public static final String SOURCE_DATA_TYPE = "sourceDataType";
  public static final String SOURCE_DATA_LENGTH = "sourceDataLength";
  public static final String SOURCE_PRECISION = "sourcePrecision";
  public static final String SOURCE_SCALE = "sourceScale";

  /** Read-model field carrying the operational source state; never persisted in payloads. */
  public static final String SOURCE_STATUS = "sourceStatus";

  public static final String RELEASE_VERSION_TYPE = "releaseVersionType";

  public static final String SOURCE_AVAILABLE = "Available";
  public static final String SOURCE_UNAVAILABLE = "Unavailable";
  public static final String SOURCE_CHANGED = "Changed";

  public static final String ELEMENT_TYPE_CLASSIFICATION = "DataElementType";
  public static final String GENERATION_TYPE_CLASSIFICATION = "FieldGenerationType";
  public static final String CREATION_METHOD_CLASSIFICATION = "DataCreationMethod";
  public static final String TIMELINESS_CLASSIFICATION = "DataTimeliness";

  public static final int MIN_RANK = 1;
  public static final int MAX_RANK = 999;

  public static final Set<String> EDITABLE_EXTENSION_KEYS = Set.of(SURVIVORSHIP_RANK, SYSTEM_OWNER);

  public static final List<String> SOURCE_EXTENSION_KEYS =
      List.of(
          SOURCE_COLUMN_FQN,
          SOURCE_SERVICE,
          SOURCE_DATABASE,
          SOURCE_SCHEMA,
          SOURCE_TABLE,
          SOURCE_COLUMN,
          SOURCE_DATA_TYPE,
          SOURCE_DATA_LENGTH,
          SOURCE_PRECISION,
          SOURCE_SCALE);

  public static final Set<String> SERVER_OWNED_EXTENSION_KEYS = serverOwnedKeys();

  public static final List<String> CLASSIFICATIONS =
      List.of(
          ELEMENT_TYPE_CLASSIFICATION,
          GENERATION_TYPE_CLASSIFICATION,
          CREATION_METHOD_CLASSIFICATION,
          TIMELINESS_CLASSIFICATION);

  public static final Set<TableType> INCLUDED_TABLE_TYPES =
      Set.of(TableType.Regular, TableType.Partitioned, TableType.External, TableType.Iceberg);

  private TechnicalDictionaryProfile() {}

  public static boolean isManagedClassification(String tagFqn) {
    return tagFqn != null
        && CLASSIFICATIONS.stream().anyMatch(name -> tagFqn.startsWith(name + "."));
  }

  private static Set<String> serverOwnedKeys() {
    final Set<String> keys = new LinkedHashSet<>(SOURCE_EXTENSION_KEYS);
    keys.add(RELEASE_VERSION_TYPE);
    return Set.copyOf(keys);
  }
}
