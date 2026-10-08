/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GlossaryCorrectionChangesTest {
  private static final String OLD_PAYLOAD =
      """
      {"displayName":"Ma KH","description":"d","publishedAt":1,
       "owners":[{"name":"team-a"}],
       "tags":[{"tagFQN":"DataSource.Core"}],
       "extension":{"releaseLevel":["CEO"],"entityRelationship":"x"}}
      """;
  private static final String NEW_PAYLOAD =
      """
      {"displayName":"Ma khach hang","description":"d","publishedAt":2,
       "owners":[{"name":"team-a"},{"displayName":"Team B"}],
       "tags":[{"tagFQN":"DataSource.Core"},{"tagFQN":"DataSource.Mobile"}],
       "extension":{"releaseLevel":["CEO"],"relatedRegulatoryDocuments":"doc"}}
      """;

  @Test
  void listsOnlyBusinessFieldsThatDiffer() {
    final List<Map<String, Object>> changes =
        GlossaryCorrectionChanges.between(OLD_PAYLOAD, NEW_PAYLOAD);

    assertEquals(
        List.of(
            "displayName",
            "owners",
            "tags.DataSource",
            "extension.entityRelationship",
            "extension.relatedRegulatoryDocuments"),
        changes.stream().map(change -> change.get("field")).toList());
    assertEquals("team-a, Team B", changes.get(1).get("newValue"));
    assertEquals("DataSource.Core, DataSource.Mobile", changes.get(2).get("newValue"));
  }

  @Test
  void reportsNothingWhenContentIsIdentical() {
    assertTrue(GlossaryCorrectionChanges.between(OLD_PAYLOAD, OLD_PAYLOAD).isEmpty());
  }
}
