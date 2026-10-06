/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import java.util.List;
import java.util.Map;

/**
 * Validated parameters of one Technical Dictionary list query. {@code filters} are keyed by the
 * request parameter names of {@code TechnicalRowMatcher}. {@code dataDictionaryVersion} restricts
 * the query to documents of the bound Data Dictionary version. {@code hideUnapproved} restricts
 * consumers to the currently approved data; working states are visible only to editors/reviewers.
 */
public record TechnicalSearchCriteria(
    String dataDictionaryVersion,
    String q,
    Map<String, List<String>> filters,
    int limit,
    int offset,
    boolean hideUnapproved) {

  public TechnicalSearchCriteria {
    filters = filters == null ? Map.of() : Map.copyOf(filters);
  }

  public TechnicalSearchCriteria(
      String dataDictionaryVersion,
      String q,
      Map<String, List<String>> filters,
      int limit,
      int offset) {
    this(dataDictionaryVersion, q, filters, limit, offset, false);
  }

  /** The bound version without user filters, for statistics and full scans. */
  public static TechnicalSearchCriteria scopeOnly(String dataDictionaryVersion) {
    return new TechnicalSearchCriteria(dataDictionaryVersion, null, Map.of(), 0, 0);
  }

  public TechnicalSearchCriteria withoutPaging() {
    return new TechnicalSearchCriteria(dataDictionaryVersion, q, filters, 0, 0, hideUnapproved);
  }

  public TechnicalSearchCriteria withUnapprovedHidden(boolean hidden) {
    return new TechnicalSearchCriteria(dataDictionaryVersion, q, filters, limit, offset, hidden);
  }
}
