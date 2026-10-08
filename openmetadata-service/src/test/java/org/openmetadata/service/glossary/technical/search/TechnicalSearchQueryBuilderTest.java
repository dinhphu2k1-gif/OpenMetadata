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
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRowMatcher;

class TechnicalSearchQueryBuilderTest {
  private static final String VERSION = "2";

  private static TechnicalSearchCriteria criteria(String q, Map<String, List<String>> filters) {
    return new TechnicalSearchCriteria(VERSION, q, filters, 25, 50);
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
  void alwaysFiltersByTheBoundDataDictionaryVersion() {
    final JsonNode query = json(TechnicalSearchQueryBuilder.query(criteria(null, Map.of())));

    assertTrue(hasTerm(clauses(query, "filter"), "term", "dataDictionaryVersion", VERSION));
    assertEquals(1, clauses(query, "filter").size());
    assertTrue(clauses(query, "must").isEmpty());
  }

  @Test
  void mapsEveryListFilterToItsFlatIndexField() {
    final Map<String, List<String>> filters =
        Map.of(
            TechnicalRowMatcher.SOURCE_SERVICES, List.of("ipcas"),
            TechnicalRowMatcher.SOURCE_STATUSES, List.of("Unavailable"),
            TechnicalRowMatcher.STATUSES, List.of(TechnicalRecord.STATUS_APPROVED),
            TechnicalRowMatcher.CDE_TERM_IDS, List.of("cde-1"),
            TechnicalRowMatcher.SYSTEM_OWNER_IDS, List.of("team-1"),
            TechnicalRowMatcher.ELEMENT_TYPES, List.of("DataElementType.AtomicDataElement"),
            TechnicalRowMatcher.GENERATION_TYPES, List.of("FieldGenerationType.ManualInput"),
            TechnicalRowMatcher.CREATION_METHODS, List.of("DataCreationMethod.Hardcoded"),
            TechnicalRowMatcher.TIMELINESS, List.of("DataTimeliness.T1"));

    final List<JsonNode> filter =
        clauses(json(TechnicalSearchQueryBuilder.query(criteria(null, filters))), "filter");

    assertTrue(hasTerm(filter, "terms", "service", "ipcas"));
    assertTrue(hasTerm(filter, "terms", "sourceStatus", "Unavailable"));
    assertTrue(hasTerm(filter, "terms", "status", TechnicalRecord.STATUS_APPROVED));
    assertTrue(hasTerm(filter, "terms", "cde.id", "cde-1"));
    assertTrue(hasTerm(filter, "terms", "systemOwners.id", "team-1"));
    assertTrue(hasTerm(filter, "terms", "elementType.fqn", "DataElementType.AtomicDataElement"));
    assertTrue(hasTerm(filter, "terms", "generationType.fqn", "FieldGenerationType.ManualInput"));
    assertTrue(hasTerm(filter, "terms", "creationMethod.fqn", "DataCreationMethod.Hardcoded"));
    assertTrue(hasTerm(filter, "terms", "timeliness.fqn", "DataTimeliness.T1"));
  }

  @Test
  void cdeMappingSelectsMappedOrUnmappedRecordsAndBothMeanAll() {
    final JsonNode mapped =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(null, Map.of(TechnicalRowMatcher.CDE_MAPPING, List.of("MAPPED")))));
    final JsonNode unmapped =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(null, Map.of(TechnicalRowMatcher.CDE_MAPPING, List.of("UNMAPPED")))));
    final JsonNode both =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(
                    null, Map.of(TechnicalRowMatcher.CDE_MAPPING, List.of("MAPPED", "UNMAPPED")))));

    assertTrue(
        clauses(mapped, "filter").stream()
            .anyMatch(clause -> "cde.id".equals(clause.path("exists").path("field").asText())));
    assertEquals(
        "cde.id", clauses(unmapped, "must_not").getFirst().path("exists").path("field").asText());
    assertTrue(clauses(both, "must_not").isEmpty());
    assertEquals(1, clauses(both, "filter").size());
  }

  @Test
  void longTextUsesNgramFieldsOfLocationAndCde() {
    final JsonNode multiMatch =
        json(TechnicalSearchQueryBuilder.query(criteria("customer", Map.of())))
            .path("bool")
            .path("must")
            .get(0)
            .path("multi_match");

    final List<String> fields = new ArrayList<>();
    multiMatch.path("fields").forEach(field -> fields.add(field.asText()));
    assertEquals("customer", multiMatch.path("query").asText());
    assertTrue(fields.contains("table.ngram"));
    assertTrue(fields.contains("column.ngram"));
    assertTrue(fields.contains("cde.code.ngram"));
    assertTrue(fields.contains("cde.name.ngram"));
  }

  @Test
  void vietnameseTextIsFoldedBeforeBuildingTheQuery() {
    final JsonNode multiMatch =
        json(TechnicalSearchQueryBuilder.query(criteria("Điểm", Map.of())))
            .path("bool")
            .path("must")
            .get(0)
            .path("multi_match");

    assertEquals("diem", multiMatch.path("query").asText());
  }

  @Test
  void shortTextFallsBackToEscapedLowercaseWildcards() {
    final JsonNode should =
        json(TechnicalSearchQueryBuilder.query(criteria("A*", Map.of())))
            .path("bool")
            .path("must")
            .get(0)
            .path("bool")
            .path("should");

    assertTrue(
        should.get(0).path("wildcard").elements().next().path("value").asText().equals("*a\\**"));
  }

  @Test
  void searchBodyPagesAndSortsByColumnFqnThenTermId() {
    final JsonNode body = json(TechnicalSearchQueryBuilder.searchBody(criteria(null, Map.of())));

    assertEquals(50, body.path("from").asInt());
    assertEquals(25, body.path("size").asInt());
    assertEquals("asc", body.path("sort").get(0).path("rank").path("order").asText());
    assertEquals("_last", body.path("sort").get(0).path("rank").path("missing").asText());
    assertEquals("asc", body.path("sort").get(1).path("columnFqn").asText());
    assertEquals("asc", body.path("sort").get(2).path("termId").asText());
  }

  @Test
  void rejectsPagesBeyondTheResultWindow() {
    assertThrows(
        BadRequestException.class,
        () ->
            TechnicalSearchQueryBuilder.searchBody(
                new TechnicalSearchCriteria(VERSION, null, Map.of(), 50, 9_990)));
  }

  @Test
  void statisticsCountTablesSourcesAndMappedRecordsOverTheBoundVersion() {
    final JsonNode body =
        json(TechnicalSearchQueryBuilder.statsBody(TechnicalSearchCriteria.scopeOnly(VERSION)));

    assertEquals(0, body.path("size").asInt());
    assertEquals(
        "tableKey", body.path("aggs").path("tables").path("cardinality").path("field").asText());
    assertEquals(
        "service", body.path("aggs").path("sources").path("cardinality").path("field").asText());
    assertEquals(
        "cde.id",
        body.path("aggs")
            .path("mapped")
            .path("filter")
            .path("bool")
            .path("filter")
            .get(1)
            .path("exists")
            .path("field")
            .asText());
    assertTrue(
        hasTerm(clauses(body.path("query"), "filter"), "term", "dataDictionaryVersion", VERSION));
  }

  @Test
  void cdeQueryFindsTheRecordsBoundToOneCdeInTheBoundVersion() {
    final UUID cde = UUID.randomUUID();
    final List<JsonNode> filter =
        clauses(json(TechnicalSearchQueryBuilder.cdeQuery(VERSION, cde)), "filter");

    assertTrue(hasTerm(filter, "term", "dataDictionaryVersion", VERSION));
    assertTrue(hasTerm(filter, "term", "status", TechnicalRecord.STATUS_APPROVED));
    assertTrue(hasTerm(filter, "term", "cde.id", cde.toString()));
  }

  @Test
  void tableQueryMatchesLowercaseLocationNames() {
    final List<JsonNode> filter =
        clauses(
            json(TechnicalSearchQueryBuilder.tableQuery(VERSION, "CORE", "DBO", "Customer")),
            "filter");

    assertTrue(hasTerm(filter, "term", "database", "core"));
    assertTrue(hasTerm(filter, "term", "schema", "dbo"));
    assertTrue(hasTerm(filter, "term", "table", "customer"));
    assertFalse(hasTerm(filter, "term", "table", "Customer"));
  }

  @Test
  void workingStatesAreShownUnlessTheCriteriaHideThem() {
    final TechnicalSearchCriteria shown = criteria(null, Map.of());
    final JsonNode all = json(TechnicalSearchQueryBuilder.query(shown));
    final JsonNode approvedOnly =
        json(TechnicalSearchQueryBuilder.query(shown.withUnapprovedHidden(true)));

    assertFalse(hasTerm(clauses(all, "filter"), "term", "status", TechnicalRecord.STATUS_APPROVED));
    assertTrue(
        hasTerm(
            clauses(approvedOnly, "filter"), "term", "status", TechnicalRecord.STATUS_APPROVED));
  }

  @Test
  void hidingUnapprovedSurvivesDroppingThePageAndCombinesWithOtherFilters() {
    final TechnicalSearchCriteria hidden =
        criteria("name", Map.of(TechnicalRowMatcher.STATUSES, List.of("Approved")))
            .withUnapprovedHidden(true)
            .withoutPaging();
    final JsonNode query = json(TechnicalSearchQueryBuilder.query(hidden));

    assertTrue(hidden.hideUnapproved());
    assertTrue(hasTerm(clauses(query, "filter"), "terms", "status", "Approved"));
    assertTrue(hasTerm(clauses(query, "filter"), "term", "status", "Approved"));
  }

  @Test
  void statisticsOfAConsumerIncludeApprovedRecordsOnly() {
    final JsonNode body =
        json(
            TechnicalSearchQueryBuilder.statsBody(
                TechnicalSearchCriteria.scopeOnly(VERSION).withUnapprovedHidden(true)));

    assertTrue(hasTerm(clauses(body.path("query"), "filter"), "term", "status", "Approved"));
  }

  @Test
  void aDraftCanBeFilteredByStatus() {
    assertEquals(
        List.of("Draft"),
        TechnicalRowMatcher.validate(Map.of(TechnicalRowMatcher.STATUSES, "Draft"))
            .get(TechnicalRowMatcher.STATUSES));
  }

  @Test
  void aDraftStatusAlsoMatchesRecordsWhoseUpdateIsADraft() {
    final TechnicalSearchCriteria drafts =
        criteria(null, Map.of(TechnicalRowMatcher.STATUSES, List.of("Draft", "In Review")));
    final JsonNode query = json(TechnicalSearchQueryBuilder.query(drafts));
    final JsonNode alternatives = clauses(query, "filter").get(1).path("bool").path("should");

    assertEquals(2, alternatives.size());
    assertTrue(hasTerm(List.of(alternatives.get(0)), "terms", "status", "Draft"));
    final List<JsonNode> pending = clauses(alternatives.get(1), "filter");
    assertTrue(hasTerm(pending, "term", "hasPendingChange", "true"));
    assertTrue(hasTerm(pending, "term", "changeOperation", "UPDATE"));
    assertTrue(hasTerm(pending, "terms", "changeRequestStatus", "Draft"));
    assertTrue(hasTerm(pending, "terms", "changeRequestStatus", "InReview"));
  }

  @Test
  void anApprovedOrConsumerStatusFilterIgnoresPendingUpdates() {
    final JsonNode approved =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(null, Map.of(TechnicalRowMatcher.STATUSES, List.of("Approved")))));
    final JsonNode consumer =
        json(
            TechnicalSearchQueryBuilder.query(
                criteria(null, Map.of(TechnicalRowMatcher.STATUSES, List.of("Draft")))
                    .withUnapprovedHidden(true)));

    assertTrue(hasTerm(clauses(approved, "filter"), "terms", "status", "Approved"));
    assertTrue(hasTerm(clauses(consumer, "filter"), "terms", "status", "Draft"));
  }

  @Test
  void pendingUpdateCountsOnlyRecordsListedAsTwoRows() {
    final JsonNode body =
        json(
            TechnicalSearchQueryBuilder.pendingUpdateCountBody(
                criteria(
                    null, Map.of(TechnicalRowMatcher.STATUSES, List.of("Approved", "Draft")))));
    final List<JsonNode> filter = clauses(body.path("query"), "filter");

    assertTrue(hasTerm(filter, "terms", "status", "Approved"));
    assertTrue(hasTerm(filter, "terms", "changeRequestStatus", "Draft"));
  }
}
