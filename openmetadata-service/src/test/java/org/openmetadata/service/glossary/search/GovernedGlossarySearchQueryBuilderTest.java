/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry.Profile;
import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService.Criteria;
import org.openmetadata.service.resources.glossary.GlossaryAuthorizationResolver.Capabilities;
import org.openmetadata.service.resources.glossary.GovernedScopeAuthorizer.ScopeAccess;

class GovernedGlossarySearchQueryBuilderTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void combinesFilterFamiliesWithAndAndValuesWithOr() {
    final Criteria criteria =
        criteria(
            null,
            List.of("Draft", "Approved"),
            List.of("domain-1", "domain-2"),
            List.of("owner-1"));

    final JsonNode query = json(request(criteria, capabilities(true, false, false), false));

    assertEquals(2, findTerms(query, "entityStatus").size());
    assertEquals(2, findTerms(query, "domainIds").size());
    assertEquals(List.of("owner-1"), findTerms(query, "ownerIds"));
  }

  @Test
  void creatorCanSeeOnlyTheirWorkingRowsWhenEditOrSubmitDoesNotGrantGeneralView() {
    final JsonNode query =
        json(
            request(
                criteria(null, List.of(), List.of(), List.of()),
                capabilities(false, true, false),
                false));
    final String serialized = query.toString();

    assertTrue(serialized.contains("createdBy"));
    assertTrue(serialized.contains("alice"));
    assertTrue(serialized.contains("working"));
  }

  @Test
  void consumerVisibilityNeverIncludesDeletedOrWorkingRows() {
    final JsonNode query =
        json(
            request(
                criteria(null, List.of("Approved"), List.of(), List.of()),
                capabilities(false, false, false),
                true));
    final String serialized = query.toString();

    assertFalse(serialized.contains("deleted"));
    assertFalse(serialized.contains("createdBy"));
  }

  @Test
  void literalWildcardCharactersAreEscapedAfterVietnameseFolding() {
    final JsonNode query =
        json(
            request(
                criteria("Độ_*?", List.of(), List.of(), List.of()),
                capabilities(true, false, false),
                false));
    final String serialized = query.toString();

    assertTrue(serialized.contains("do_"));
    assertTrue(serialized.contains("\\\\*"));
    assertTrue(serialized.contains("\\\\?"));
  }

  @Test
  void textSearchCoversCodeNameAndDescription() {
    final String serialized =
        json(request(
                criteria("Khách hàng", List.of(), List.of(), List.of()),
                capabilities(true, false, false),
                false))
            .toString();

    assertTrue(serialized.contains("\"nameSearch\""));
    assertTrue(serialized.contains("\"displayNameSearch\""));
    assertTrue(serialized.contains("\"descriptionSearch\""));
    assertTrue(serialized.contains("*khach hang*"));
  }

  private static GovernedGlossarySearchRequest request(
      final Criteria criteria, final Capabilities capabilities, final boolean consumer) {
    final ScopeAccess access =
        new ScopeAccess(
            GLOSSARY_ID, "2", null, Profile.DATA_DICTIONARY, consumer, capabilities, null);
    return new GovernedGlossarySearchRequest(criteria, access, "alice", true, false);
  }

  private static Capabilities capabilities(
      final boolean view, final boolean edit, final boolean submit) {
    return new Capabilities(view, true, edit, submit, false, false, false, false);
  }

  private static Criteria criteria(
      final String q,
      final List<String> statuses,
      final List<String> domains,
      final List<String> owners) {
    return new Criteria(
        GLOSSARY_ID, "2", q, statuses, domains, owners, List.of(), List.of(), null, null, 10, 0);
  }

  private static JsonNode json(final GovernedGlossarySearchRequest request) {
    return JsonUtils.readTree(
        JsonUtils.pojoToJson(GovernedGlossarySearchQueryBuilder.query(request)));
  }

  private static List<String> findTerms(final JsonNode query, final String field) {
    final java.util.ArrayList<String> values = new java.util.ArrayList<>();
    query.findValues(field).forEach(array -> array.forEach(value -> values.add(value.asText())));
    return values;
  }
}
