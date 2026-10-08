/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GovernedGlossaryDocumentBuilderTest {
  @Test
  void addsExactFilterAndStableSortFieldsWithoutChangingTheApiRow() {
    final UUID glossaryId = UUID.randomUUID();
    final Map<String, Object> row =
        Map.ofEntries(
            Map.entry("termId", UUID.randomUUID().toString()),
            Map.entry("parentBusinessVersion", "12"),
            Map.entry("recordType", "working"),
            Map.entry("name", "Điểm tín dụng"),
            Map.entry("displayName", "ĐIỂM TÍN DỤNG"),
            Map.entry("businessVersion", "12.10"),
            Map.entry("workingRevision", 7L),
            Map.entry("owners", List.of(Map.of("id", "owner-1"))),
            Map.entry("domains", List.of(Map.of("id", "domain-1"))),
            Map.entry("tags", List.of(Map.of("tagFQN", "DataSource.Core"))));

    final Map<String, Object> document = GovernedGlossaryDocumentBuilder.document(glossaryId, row);

    assertEquals("diem tin dung", document.get("nameSearch"));
    assertEquals("diem tin dung", document.get("displayNameSearch"));
    assertEquals(List.of("owner-1"), document.get("ownerIds"));
    assertEquals(List.of("domain-1"), document.get("domainIds"));
    assertEquals(List.of("DataSource.Core"), document.get("dataSourceTags"));
    assertEquals(7L, document.get("revisionMarker"));
    assertEquals(
        "0000000000000000000000000000000000000012.0000000000000000000000000000000000000010",
        document.get("businessVersionSort"));
  }
}
