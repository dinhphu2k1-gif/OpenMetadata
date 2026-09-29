/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Column scope of the Technical Dictionary bootstrap. Every value is a comma-separated list so it
 * can be supplied through environment variables. An empty service list disables bootstrap rather
 * than meaning "every service".
 */
@Getter
@Setter
public class TechnicalDictionaryConfiguration {

  /** Database service names whose Columns are catalogued. */
  @JsonProperty private String includeServices = "";

  /** Optional database FQNs (`service.database`) narrowing the included services. */
  @JsonProperty private String includeDatabases = "";

  /** Optional schema FQNs (`service.database.schema`) narrowing the included databases. */
  @JsonProperty private String includeSchemas = "";

  /** Case-insensitive glob patterns matched against table and schema names, e.g. `TMP_*`. */
  @JsonProperty private String excludePatterns = "";
}
