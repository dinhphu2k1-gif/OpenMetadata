/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ServiceUnavailableException;
import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** OpenSearch query boundary for the CDE business-version projection. */
public class CdeBusinessVersionSearchService {
  public static final String MUTABLE_ALIAS = "cdeBusinessVersion";
  public static final String PUBLISHED_ALIAS = "cdeBusinessVersionPublished";
  private static final Set<Integer> PAGE_SIZES = Set.of(10, 15, 25, 50);
  private static final Set<String> STATUSES =
      Set.of("Draft", "In Review", "Rejected", "Approved", "Archived");
  private static final Map<String, String> SORT_FIELDS =
      Map.of(
          "name", "cdeSort.normalizedName",
          "displayName", "cdeSort.displayName",
          "businessVersion", "cdeSort.businessVersion",
          "entityStatus", "cdeSort.entityStatus");
  private static final int MAX_QUERY_LENGTH = 200;
  private static final int MAX_FILTER_VALUES = 50;

  public Map<String, Object> search(
      Criteria criteria, SubjectContext subject, boolean consumerOnly) {
    Criteria validated = validate(criteria, consumerOnly);
    String alias = consumerOnly ? PUBLISHED_ALIAS : MUTABLE_ALIAS;
    String index = Entity.getSearchRepository().getIndexOrAliasName(alias);
    String filter = buildFilter(validated, consumerOnly);
    String query = buildLiteralTextQuery(validated.q());
    SearchSortFilter sort =
        new SearchSortFilter(
            resolveSortField(validated.sortField()),
            validated.sortOrder() == null ? "asc" : validated.sortOrder(),
            null,
            null);
    try {
      SearchResultListMapper result =
          Entity.getSearchRepository()
              .getSearchClient()
              .listWithOffset(
                  filter, validated.limit(), validated.offset(), index, sort, null, query, subject);
      return Map.of(
          "data",
          result.getResults(),
          "paging",
          Map.of(
              "total", result.getTotal(),
              "limit", validated.limit(),
              "offset", validated.offset()));
    } catch (IOException exception) {
      throw new ServiceUnavailableException("CDE business-version search is unavailable", 1L);
    }
  }

  static String resolveSortField(String sortField) {
    return sortField == null ? "cdeSort.normalizedName" : SORT_FIELDS.get(sortField);
  }

  public static Criteria validate(Criteria criteria, boolean consumerOnly) {
    if (criteria == null) {
      throw new BadRequestException("Search criteria are required");
    }
    if (criteria.glossaryId() == null) {
      throw new BadRequestException("glossary is required");
    }
    String parentVersion;
    try {
      parentVersion =
          org.openmetadata.service.util.GlossaryBusinessVersion.requireCanonicalDictionary(
              criteria.parentBusinessVersion());
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    if (!PAGE_SIZES.contains(criteria.limit())) {
      throw new BadRequestException("limit must be one of 10, 15, 25, or 50");
    }
    if (criteria.offset() < 0) {
      throw new BadRequestException("offset must be greater than or equal to 0");
    }
    String q = normalizeOptional(criteria.q());
    if (q != null && q.codePointCount(0, q.length()) > MAX_QUERY_LENGTH) {
      throw new BadRequestException("q must not exceed 200 characters");
    }
    List<String> statuses = parseCsv(criteria.statuses(), "statuses");
    if (!STATUSES.containsAll(statuses)) {
      throw new BadRequestException("statuses contains an unsupported value");
    }
    if (consumerOnly) {
      statuses = List.of("Approved");
    }
    List<String> domainIds = parseUuids(criteria.domainIds(), "domainIds");
    List<String> ownerIds = parseUuids(criteria.ownerIds(), "ownerIds");
    List<String> dataSourceTags = parseFqns(criteria.dataSourceTags(), "dataSourceTags");
    List<String> classificationTags =
        parseFqns(criteria.classificationTags(), "classificationTags");
    String sortField = normalizeOptional(criteria.sortField());
    String sortOrder = normalizeOptional(criteria.sortOrder());
    if (sortField != null && !SORT_FIELDS.containsKey(sortField)) {
      throw new BadRequestException("sortField contains an unsupported value");
    }
    if (sortOrder != null && !Set.of("asc", "desc").contains(sortOrder)) {
      throw new BadRequestException("sortOrder must be asc or desc");
    }
    if (sortOrder != null && sortField == null) {
      throw new BadRequestException("sortField is required when sortOrder is present");
    }
    return new Criteria(
        criteria.glossaryId(),
        parentVersion,
        q,
        statuses,
        domainIds,
        ownerIds,
        dataSourceTags,
        classificationTags,
        sortField,
        sortOrder,
        criteria.limit(),
        criteria.offset());
  }

  static String buildFilter(Criteria criteria, boolean consumerOnly) {
    List<Map<String, Object>> filters = new ArrayList<>();
    addTerm(filters, "glossaryId", criteria.glossaryId().toString());
    addTerm(filters, "parentBusinessVersion", criteria.parentBusinessVersion());
    addTerms(filters, "entityStatus", consumerOnly ? List.of("Approved") : criteria.statuses());
    addTerms(filters, "domainIds", criteria.domainIds());
    addTerms(filters, "ownerIds", criteria.ownerIds());
    addTerms(filters, "dataSourceTags", criteria.dataSourceTags());
    addTerms(filters, "classificationTags", criteria.classificationTags());
    Map<String, Object> bool = new LinkedHashMap<>();
    bool.put("filter", filters);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", bool)));
  }

  static String buildLiteralTextQuery(String q) {
    if (q == null) {
      return null;
    }
    return JsonUtils.pojoToJson(
        Map.of(
            "bool",
            Map.of(
                "must",
                List.of(
                    Map.of(
                        "multi_match",
                        Map.of(
                            "query",
                            q,
                            "fields",
                            List.of("name", "displayName"),
                            "operator",
                            "and"))))));
  }

  private static void addTerm(List<Map<String, Object>> filters, String field, String value) {
    filters.add(Map.of("term", Map.of(field, value)));
  }

  private static void addTerms(
      List<Map<String, Object>> filters, String field, List<String> values) {
    if (!values.isEmpty()) {
      filters.add(Map.of("terms", Map.of(field, values)));
    }
  }

  private static List<String> parseUuids(List<String> values, String field) {
    List<String> parsed = parseValues(values, field);
    for (String value : parsed) {
      try {
        UUID.fromString(value);
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException(field + " contains an invalid UUID");
      }
    }
    return parsed;
  }

  private static List<String> parseFqns(List<String> values, String field) {
    List<String> parsed = parseValues(values, field);
    if (parsed.stream().anyMatch(value -> value.startsWith(".") || value.endsWith("."))) {
      throw new BadRequestException(field + " contains an invalid FQN");
    }
    return parsed;
  }

  private static List<String> parseCsv(List<String> values, String field) {
    return parseValues(values, field);
  }

  public static List<String> splitCsvParameter(String value) {
    if (value == null || value.trim().isEmpty()) {
      return List.of();
    }
    return List.of(value.split(",", -1));
  }

  private static List<String> parseValues(List<String> values, String field) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    if (values.size() > MAX_FILTER_VALUES) {
      throw new BadRequestException(field + " has too many values");
    }
    LinkedHashSet<String> unique = new LinkedHashSet<>();
    for (String raw : values) {
      String value = normalizeOptional(raw);
      if (value == null) {
        throw new BadRequestException(field + " contains an empty value");
      }
      if (!unique.add(value)) {
        throw new BadRequestException(field + " contains a duplicate value");
      }
    }
    return List.copyOf(unique);
  }

  private static String normalizeOptional(String value) {
    if (value == null || value.trim().isEmpty()) {
      return null;
    }
    return Normalizer.normalize(value.trim(), Normalizer.Form.NFC);
  }

  public record Criteria(
      UUID glossaryId,
      String parentBusinessVersion,
      String q,
      List<String> statuses,
      List<String> domainIds,
      List<String> ownerIds,
      List<String> dataSourceTags,
      List<String> classificationTags,
      String sortField,
      String sortOrder,
      int limit,
      int offset) {}
}
