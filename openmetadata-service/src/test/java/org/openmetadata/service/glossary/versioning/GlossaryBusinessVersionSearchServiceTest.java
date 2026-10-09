/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService.Criteria;

class GlossaryBusinessVersionSearchServiceTest {
  private static final UUID GLOSSARY_ID = UUID.randomUUID();

  @Test
  void draftFilterUsesAuthoritativeRows() {
    GlossaryBusinessVersionSearchService service = new GlossaryBusinessVersionSearchService();

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
            .stream().map(Map.class::cast).findFirst().orElseThrow().get("entityStatus"));
  }

  @Test
  void consumerCannotWidenApprovedRows() {
    GlossaryBusinessVersionSearchService service = new GlossaryBusinessVersionSearchService();

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
            .stream().map(Map.class::cast).findFirst().orElseThrow().get("entityStatus"));
  }

  @Test
  void searchMatchesDescriptionIgnoringAccents() {
    GlossaryBusinessVersionSearchService service = new GlossaryBusinessVersionSearchService();
    Map<String, Object> described = new HashMap<>(row("CDE1", "1.0", "Approved"));
    described.put("description", "Số định danh của Khách hàng");

    Map<String, Object> response =
        service.search(
            criteria("khach hang", List.of(), 10, 0),
            List.of(described, row("CDE2", "1.0", "Approved")),
            false,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
  }

  @Test
  void literalSearchDoesNotInterpretWildcards() {
    GlossaryBusinessVersionSearchService service = new GlossaryBusinessVersionSearchService();

    Map<String, Object> response =
        service.search(
            criteria("%_?*", List.of(), 10, 0),
            List.of(row("CDE1", "1.0", "Approved"), row("CDE%_?*", "1.1", "Draft")),
            false,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
  }

  @Test
  void searchIgnoresVietnameseDiacritics() {
    final GlossaryBusinessVersionSearchService service = new GlossaryBusinessVersionSearchService();

    final Map<String, Object> response =
        service.search(
            criteria("diem tin dung", List.of(), 10, 0),
            List.of(row("Điểm tín dụng", "1.0", "Approved")),
            false,
            false);

    assertEquals(1, ((Map<?, ?>) response.get("paging")).get("total"));
  }

  @Test
  void rejectsMalformedCriteria() {
    assertThrows(
        BadRequestException.class,
        () ->
            GlossaryBusinessVersionSearchService.validate(
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
            GlossaryBusinessVersionSearchService.validate(
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
        "termId",
        UUID.randomUUID().toString(),
        "name",
        name,
        "displayName",
        name,
        "businessVersion",
        version,
        "entityStatus",
        status,
        "recordType",
        "Draft".equals(status) ? "working" : "published",
        "domains",
        List.of(),
        "owners",
        List.of(),
        "tags",
        List.of());
  }
}
