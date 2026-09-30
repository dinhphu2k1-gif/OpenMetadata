/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Validated parameters of one Technical Dictionary list query. {@code filters} are keyed by the
 * request parameter names of {@code TechnicalRowMatcher}. A consumer reads only the published view
 * of records that were Approved at least once.
 */
public record TechnicalSearchCriteria(
    UUID glossaryId,
    String parentBusinessVersion,
    boolean consumerOnly,
    String q,
    List<String> statuses,
    Map<String, List<String>> filters,
    int limit,
    int offset) {

  public TechnicalSearchCriteria {
    statuses = statuses == null ? List.of() : List.copyOf(statuses);
    filters = filters == null ? Map.of() : Map.copyOf(filters);
  }

  /** The representation view the caller filters and reads. */
  public String view() {
    return consumerOnly ? TechnicalIndexFields.PUBLISHED : TechnicalIndexFields.CURRENT;
  }

  /** Same scope and permission without user filters, for statistics. */
  public static TechnicalSearchCriteria scopeOnly(
      UUID glossaryId, String parentBusinessVersion, boolean consumerOnly) {
    return new TechnicalSearchCriteria(
        glossaryId, parentBusinessVersion, consumerOnly, null, List.of(), Map.of(), 0, 0);
  }
}
