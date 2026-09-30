/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.technical.TechnicalRowMatcher;

class TechnicalSearchQueryBuilderTest {
  private static final UUID GLOSSARY_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final String SCOPE = "2";

  private static TechnicalSearchCriteria criteria(
      boolean consumerOnly, String q, List<String> statuses, Map<String, List<String>> filters) {
    return new TechnicalSearchCriteria(
        GLOSSARY_ID, SCOPE, consumerOnly, q, statuses, filters, 25, 50);
  }

  private static JsonNode json(Object body) {
    return JsonUtils.readTree(JsonUtils.pojoToJson(body));
  }

  private static List<JsonNode> clauses(JsonNode query, String occurrence) {
    final List<JsonNode> clauses = new ArrayList<>();
    query.path("bool").path(occurrence).forEach(clauses::add);
    return clauses;
  }

  private static boolean hasTerm(List<JsonNode> clauses, String kind, String field, String value) {
    return clauses.stream()
        .map(clause -> clause.path(kind).path(field))
        .anyMatch(node -> node.isArray() ? contains(node, value) : value.equals(node.asText()));
  }

  private static boolean contains(JsonNode array, String value) {
    boolean found = false;
    for (JsonNode item : array) {
      found = found || value.equals(item.asText());
    }
    return found;
  }

  @Test
  void alwaysFiltersByScopeAndReadsTheCurrentViewForAuthors() {
    final JsonNode query = json(TechnicalSearchQueryBuilder.query(criteria(false, null, List.of("Draft"), Map.of())));
    final List<JsonNode> filter = clauses(query, "filter");
    assertTrue(hasTerm(filter, "term", "glossaryId", GLOSSARY_ID.toString()));
    assertTrue(hasTerm(filter, "term", "parentBusinessVersion", SCOPE));
    assertTrue(hasTerm(filter, "terms", "current.entityStatus", "Draft"));
    assertFalse(query.toString().contains("hasPublished"));
  }

  @Test
  void consumersOnlyReadPublishedRecordsThroughThePublishedView() {
    final JsonNode query =
        json(TechnicalSearchQueryBuilder.query(criteria(true, null, List.of("Approved"), Map.of())));
    final List<JsonNode> filter = clauses(query, "filter");
    assertTrue(hasTerm(filter, "term", "hasPublished", "true"));
    assertTrue(hasTerm(filter, "terms", "published.entityStatus", "Approved"));
    assertFalse(query.toString().contains("current."));
  }

  @Test
  void mapsEveryListFilterToItsIndexField() {
    final Map<String, List<String>> filters =
        Map.of(
            TechnicalRowMatcher.SOURCE_SERVICES, List.of("ipcas"),
            TechnicalRowMatcher.SOURCE_STATUSES, List.of("Unavailable"),
            TechnicalRowMatcher.CDE_TERM_IDS, List.of("cde-1"),
            TechnicalRowMatcher.SYSTEM_OWNER_IDS, List.of("team-1"),
            TechnicalRowMatcher.ELEMENT_TYPES, List.of("DataElementType.Atomic"),
            TechnicalRowMatcher.GENERATION_TYPES, List.of("FieldGenerationType.Raw"),
            TechnicalRowMatcher.CREATION_METHODS, List.of("DataCreationMethod.Manual"),
            TechnicalRowMatcher.TIMELINESS, List.of("DataTimeliness.T0"));
    final List<JsonNode> filter =
        clauses(json(TechnicalSearchQueryBuilder.query(criteria(false, null, List.of(), filters))), "filter");
    assertTrue(hasTerm(filter, "terms", "service", "ipcas"));
    assertTrue(hasTerm(filter, "terms", "sourceStatus", "Unavailable"));
    assertTrue(hasTerm(filter, "terms", "current.cde.id", "cde-1"));
    assertTrue(hasTerm(filter, "terms", "current.systemOwner.id", "team-1"));
    assertTrue(hasTerm(filter, "terms", "current.elementType.fqn", "DataElementType.Atomic"));
    assertTrue(hasTerm(filter, "terms", "current.generationType.fqn", "FieldGenerationType.Raw"));
    assertTrue(hasTerm(filter, "terms", "current.creationMethod.fqn", "DataCreationMethod.Manual"));
    assertTrue(hasTerm(filter, "terms", "current.timeliness.fqn", "DataTimeliness.T0"));
  }

  @Test
  void cdeMappingSelectsMappedOrUnmappedRecordsAndBothMeanAll() {
    final JsonNode mapped =
        json(TechnicalSearchQueryBuilder.query(criteria(false, null, List.of(), Map.of(TechnicalRowMatcher.CDE_MAPPING, List.of(TechnicalRowMatcher.MAPPED)))));
    final JsonNode unmapped =
        json(TechnicalSearchQueryBuilder.query(criteria(false, null, List.of(), Map.of(TechnicalRowMatcher.CDE_MAPPING, List.of(TechnicalRowMatcher.UNMAPPED)))));
    final JsonNode both =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(
                    false,
                    null,
                    List.of(),
                    Map.of(
                        TechnicalRowMatcher.CDE_MAPPING,
                        List.of(TechnicalRowMatcher.MAPPED, TechnicalRowMatcher.UNMAPPED)))));
    assertTrue(hasTerm(clauses(mapped, "filter"), "exists", "field", "current.cde.id"));
    assertTrue(hasTerm(clauses(unmapped, "must_not"), "exists", "field", "current.cde.id"));
    assertFalse(both.toString().contains("exists"));
  }

  @Test
  void longTextUsesNgramFieldsOfLocationAndCde() {
    final JsonNode match =
        json(TechnicalSearchQueryBuilder.textQuery("TBMS_CTR", TechnicalIndexFields.CURRENT)).path("multi_match");
    assertEquals("tbms_ctr", match.path("query").asText());
    assertEquals("and", match.path("operator").asText());
    final List<String> fields = new ArrayList<>();
    match.path("fields").forEach(field -> fields.add(field.asText()));
    assertEquals(
        List.of(
            "database.ngram",
            "schema.ngram",
            "table.ngram",
            "column.ngram",
            "current.cde.code.ngram",
            "current.cde.name.ngram"),
        fields);
  }

  @Test
  void shortTextFallsBackToEscapedLowercaseWildcards() {
    final JsonNode query = json(TechnicalSearchQueryBuilder.textQuery("A*", TechnicalIndexFields.PUBLISHED));
    final List<JsonNode> should = clauses(query, "should");
    assertEquals(6, should.size());
    assertEquals("*a\\**", should.getFirst().path("wildcard").path("database").path("value").asText());
    assertTrue(query.toString().contains("published.cde.code"));
  }

  @Test
  void textQueryIsARequiredClause() {
    final JsonNode query = json(TechnicalSearchQueryBuilder.query(criteria(false, "brcd", List.of(), Map.of())));
    assertEquals(1, clauses(query, "must").size());
  }

  @Test
  void searchBodyPagesAndSortsByColumnFqnThenTermId() {
    final JsonNode body = json(TechnicalSearchQueryBuilder.searchBody(criteria(false, null, List.of(), Map.of())));
    assertEquals(50, body.path("from").asInt());
    assertEquals(25, body.path("size").asInt());
    assertTrue(body.path("track_total_hits").asBoolean());
    assertEquals("asc", body.path("sort").get(0).path("columnFqn").asText());
    assertEquals("asc", body.path("sort").get(1).path("termId").asText());
  }

  @Test
  void rejectsPagesBeyondTheResultWindow() {
    final TechnicalSearchCriteria deep =
        new TechnicalSearchCriteria(GLOSSARY_ID, SCOPE, false, null, List.of(), Map.of(), 25, 9_990);
    assertThrows(BadRequestException.class, () -> TechnicalSearchQueryBuilder.searchBody(deep));
  }

  @Test
  void statisticsCountTablesSourcesAndApprovedOverTheScope() {
    final JsonNode body =
        json(TechnicalSearchQueryBuilder.statsBody(TechnicalSearchCriteria.scopeOnly(GLOSSARY_ID, SCOPE, false)));
    assertEquals(0, body.path("size").asInt());
    assertEquals("tableKey", body.path("aggs").path("tables").path("cardinality").path("field").asText());
    assertEquals("service", body.path("aggs").path("sources").path("cardinality").path("field").asText());
    assertTrue(body.path("aggs").path("approved").path("filter").path("term").path("hasPublished").asBoolean());
    assertTrue(hasTerm(clauses(body.path("query"), "filter"), "term", "parentBusinessVersion", SCOPE));
  }

  @Test
  void columnKeysQueryLooksUpDeclaredColumnsInTheScope() {
    final List<JsonNode> filter =
        clauses(json(TechnicalSearchQueryBuilder.columnKeysQuery(GLOSSARY_ID, SCOPE, List.of("k1", "k2"))), "filter");
    assertTrue(hasTerm(filter, "terms", "columnKey", "k2"));
    assertTrue(hasTerm(filter, "term", "parentBusinessVersion", SCOPE));
  }

  @Test
  void tableQueryMatchesLowercaseLocationWithinTheReadableScope() {
    final List<JsonNode> filter =
        clauses(
            json(
                TechnicalSearchQueryBuilder.tableQuery(
                    TechnicalSearchCriteria.scopeOnly(GLOSSARY_ID, SCOPE, true), "MISDB", "AML", "TBMS_CTR")),
            "filter");
    assertTrue(hasTerm(filter, "term", "database", "misdb"));
    assertTrue(hasTerm(filter, "term", "schema", "aml"));
    assertTrue(hasTerm(filter, "term", "table", "tbms_ctr"));
    assertTrue(hasTerm(filter, "term", "hasPublished", "true"));
  }
}
