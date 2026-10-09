/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService.Criteria;
import org.openmetadata.service.resources.glossary.GlossaryAuthorizationResolver.Capabilities;

/** Builds governed glossary queries from validated criteria and request-level capabilities. */
public final class GovernedGlossarySearchQueryBuilder {
  private static final String ASC = "asc";
  private static final String DESC = "desc";
  private static final String FILTER = "filter";
  private static final String SHOULD = "should";

  private GovernedGlossarySearchQueryBuilder() {}

  public static Map<String, Object> searchBody(final GovernedGlossarySearchRequest request) {
    final Criteria criteria = request.criteria();
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("from", criteria.offset());
    body.put("size", criteria.limit());
    body.put("track_total_hits", true);
    body.put("sort", stableSort(criteria));
    body.put("query", query(request));
    body.put("_source", Map.of("excludes", internalSourceFields()));
    return body;
  }

  public static Map<String, Object> countBody(final GovernedGlossarySearchRequest request) {
    return Map.of("size", 0, "track_total_hits", true, "query", query(request));
  }

  public static Map<String, Object> query(final GovernedGlossarySearchRequest request) {
    final Criteria criteria = request.criteria();
    final List<Object> filter = new ArrayList<>();
    filter.add(term(GovernedGlossaryIndexFields.GLOSSARY_ID, criteria.glossaryId().toString()));
    filter.add(
        term(
            GovernedGlossaryIndexFields.PARENT_BUSINESS_VERSION, criteria.parentBusinessVersion()));
    filter.add(visibility(request));
    addTerms(filter, GovernedGlossaryIndexFields.ENTITY_STATUS, criteria.statuses());
    addTerms(filter, GovernedGlossaryIndexFields.DOMAIN_IDS, criteria.domainIds());
    addTerms(filter, GovernedGlossaryIndexFields.OWNER_IDS, criteria.ownerIds());
    addTerms(filter, GovernedGlossaryIndexFields.DATA_SOURCE_TAGS, criteria.dataSourceTags());
    addTerms(
        filter, GovernedGlossaryIndexFields.CLASSIFICATION_TAGS, criteria.classificationTags());
    addRecordType(filter, request);
    final Map<String, Object> bool = new LinkedHashMap<>();
    bool.put(FILTER, filter);
    if (!nullOrEmpty(criteria.q())) {
      bool.put("must", List.of(textQuery(criteria.q())));
    }
    return Map.of("bool", bool);
  }

  private static Map<String, Object> visibility(final GovernedGlossarySearchRequest request) {
    final List<Object> visible = new ArrayList<>();
    final List<String> publishedTypes =
        request.access().consumerOnly()
            ? List.of("published", "archived")
            : List.of("published", "archived", "deleted");
    visible.add(terms(GovernedGlossaryIndexFields.RECORD_TYPE, publishedTypes));
    final Capabilities capabilities = request.access().capabilities();
    if (capabilities.canViewWorking()) {
      visible.add(term(GovernedGlossaryIndexFields.RECORD_TYPE, "working"));
    } else if (capabilities.canEditWorking() || capabilities.canSubmit()) {
      visible.add(creatorWorking(request.principal()));
    }
    return Map.of("bool", Map.of(SHOULD, visible, "minimum_should_match", 1));
  }

  private static Map<String, Object> creatorWorking(final String principal) {
    return Map.of(
        "bool",
        Map.of(
            FILTER,
            List.of(
                term(GovernedGlossaryIndexFields.RECORD_TYPE, "working"),
                term(GovernedGlossaryIndexFields.CREATED_BY, principal))));
  }

  private static void addRecordType(
      final Collection<Object> filter, final GovernedGlossarySearchRequest request) {
    if (request.deletedOnly()) {
      filter.add(term(GovernedGlossaryIndexFields.RECORD_TYPE, "deleted"));
    } else if (!request.includeDeleted()) {
      filter.add(
          Map.of(
              "bool",
              Map.of(
                  "must_not", List.of(term(GovernedGlossaryIndexFields.RECORD_TYPE, "deleted")))));
    }
  }

  private static Map<String, Object> textQuery(final String query) {
    final String normalized = GovernedGlossaryText.normalize(query);
    final String pattern = "*" + GovernedGlossaryText.escapeWildcard(normalized) + "*";
    return Map.of(
        "bool",
        Map.of(
            SHOULD,
            List.of(
                wildcard(GovernedGlossaryIndexFields.NAME_SEARCH, pattern),
                wildcard(GovernedGlossaryIndexFields.DISPLAY_NAME_SEARCH, pattern),
                wildcard(GovernedGlossaryIndexFields.DESCRIPTION_SEARCH, pattern)),
            "minimum_should_match",
            1));
  }

  private static Map<String, Object> wildcard(final String field, final String value) {
    return Map.of("wildcard", Map.of(field, Map.of("value", value)));
  }

  private static void addTerms(
      final List<Object> filter, final String field, final List<String> values) {
    if (!nullOrEmpty(values)) {
      filter.add(terms(field, values));
    }
  }

  private static Map<String, Object> term(final String field, final Object value) {
    return Map.of("term", Map.of(field, value));
  }

  private static Map<String, Object> terms(final String field, final List<String> values) {
    return Map.of("terms", Map.of(field, values));
  }

  public static List<Object> stableSort(final Criteria criteria) {
    final String requested = criteria.sortField();
    final String field = sortField(requested);
    final String order =
        requested == null || criteria.sortOrder() == null ? ASC : criteria.sortOrder();
    final List<Object> sort = new ArrayList<>();
    sort.add(Map.of(field, order));
    if (requested == null) {
      sort.add(Map.of(GovernedGlossaryIndexFields.BUSINESS_VERSION_SORT, DESC));
    }
    sort.add(Map.of(GovernedGlossaryIndexFields.TERM_ID, ASC));
    sort.add(Map.of(GovernedGlossaryIndexFields.RECORD_TYPE, ASC));
    return sort;
  }

  private static String sortField(final String field) {
    return switch (field == null ? GovernedGlossaryIndexFields.NAME : field) {
      case GovernedGlossaryIndexFields.DISPLAY_NAME -> GovernedGlossaryIndexFields
          .DISPLAY_NAME_SEARCH;
      case GovernedGlossaryIndexFields.BUSINESS_VERSION -> GovernedGlossaryIndexFields
          .BUSINESS_VERSION_SORT;
      case GovernedGlossaryIndexFields.ENTITY_STATUS -> GovernedGlossaryIndexFields.ENTITY_STATUS;
      default -> GovernedGlossaryIndexFields.NAME_SEARCH;
    };
  }

  public static List<String> internalSourceFields() {
    return List.of(
        GovernedGlossaryIndexFields.GLOSSARY_ID,
        GovernedGlossaryIndexFields.NAME_SEARCH,
        GovernedGlossaryIndexFields.DISPLAY_NAME_SEARCH,
        GovernedGlossaryIndexFields.DESCRIPTION_SEARCH,
        GovernedGlossaryIndexFields.BUSINESS_VERSION_SORT,
        GovernedGlossaryIndexFields.REVISION_MARKER,
        GovernedGlossaryIndexFields.OWNER_IDS,
        GovernedGlossaryIndexFields.DOMAIN_IDS,
        GovernedGlossaryIndexFields.DATA_SOURCE_TAGS,
        GovernedGlossaryIndexFields.CLASSIFICATION_TAGS);
  }
}
