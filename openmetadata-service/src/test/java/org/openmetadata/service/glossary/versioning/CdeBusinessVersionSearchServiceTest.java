/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.CdeBusinessVersionSearchService.Criteria;

class CdeBusinessVersionSearchServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void draftFilterUsesAuthoritativeRows() {
    CdeBusinessVersionSearchService service = new CdeBusinessVersionSearchService();

    Map<String, Object> response =
        service.search(
            criteria(null, List.of("Draft"), 10, 0),
            List.of(row("CDE2", "2.0", "Approved"), row("CDE1", "2.1", "Draft")),
            false,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
    assertEquals(
        "Draft",
        ((List<?>) response.get("data"))
            .stream()
            .map(Map.class::cast)
            .findFirst()
            .orElseThrow()
            .get("entityStatus"));
  }

  @Test
  void consumerCannotWidenApprovedRows() {
    CdeBusinessVersionSearchService service = new CdeBusinessVersionSearchService();

    Map<String, Object> response =
        service.search(
            criteria(null, List.of("Draft", "Approved"), 10, 0),
            List.of(row("CDE1", "1.1", "Draft"), row("CDE1", "1.0", "Approved")),
            true,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
    assertEquals(
        "Approved",
        ((List<?>) response.get("data"))
            .stream()
            .map(Map.class::cast)
            .findFirst()
            .orElseThrow()
            .get("entityStatus"));
  }

  @Test
  void literalSearchDoesNotInterpretWildcards() {
    CdeBusinessVersionSearchService service = new CdeBusinessVersionSearchService();

    Map<String, Object> response =
        service.search(
            criteria("%_?*", List.of(), 10, 0),
            List.of(row("CDE1", "1.0", "Approved"), row("CDE%_?*", "1.1", "Draft")),
            false,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
  }

  @Test
  void rejectsMalformedCriteria() {
    assertThrows(
        BadRequestException.class,
        () ->
            CdeBusinessVersionSearchService.validate(
                new Criteria(
                    GLOSSARY_ID,
                    "01",
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    null,
                    null,
                    10,
                    0),
                false));
    assertThrows(
        BadRequestException.class,
        () ->
            CdeBusinessVersionSearchService.validate(
                criteria(null, List.of("Draft", "Draft"), 10, 0), false));
  }

  private static Criteria criteria(String q, List<String> statuses, int limit, int offset) {
    return new Criteria(
        GLOSSARY_ID,
        "1",
        q,
        statuses,
        List.of(),
        List.of(),
        List.of(),
        List.of(),
        null,
        null,
        limit,
        offset);
  }

  private static Map<String, Object> row(String name, String version, String status) {
    return Map.of(
        "termId", UUID.randomUUID().toString(),
        "name", name,
        "displayName", name,
        "businessVersion", version,
        "entityStatus", status,
        "recordType", "Draft".equals(status) ? "working" : "published",
        "domains", List.of(),
        "owners", List.of(),
        "tags", List.of());
  }
}
