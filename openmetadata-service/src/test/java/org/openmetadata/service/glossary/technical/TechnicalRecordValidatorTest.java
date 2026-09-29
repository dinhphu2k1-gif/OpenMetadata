/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.WebApplicationException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;

class TechnicalRecordValidatorTest {
  private static final UUID TEAM_ID = UUID.randomUUID();

  private final TechnicalRecordValidator validator =
      new TechnicalRecordValidator(
          new TechnicalRecordValidator.ReferenceLookup() {
            @Override
            public boolean tagExists(String tagFqn) {
              return !tagFqn.endsWith("Missing");
            }

            @Override
            public boolean teamExists(UUID teamId) {
              return TEAM_ID.equals(teamId);
            }
          });

  private static GlossaryTerm current() {
    Map<String, Object> extension = new LinkedHashMap<>();
    extension.put(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, "ipcas.core.dbo.customer.name");
    extension.put(TechnicalDictionaryProfile.SOURCE_TABLE, "customer");
    extension.put(
        TechnicalDictionaryProfile.SOURCE_STATUS,
        List.of(TechnicalDictionaryProfile.SOURCE_AVAILABLE));
    extension.put(TechnicalDictionaryProfile.RELEASE_VERSION_TYPE, List.of("Bản chính"));
    return new GlossaryTerm()
        .withDisplayName("name")
        .withDescription("Tên khách hàng")
        .withExtension(extension);
  }

  private static Map<String, Object> team(UUID id) {
    return Map.of("id", id.toString(), "type", "team");
  }

  private static int status(WebApplicationException exception) {
    return exception.getResponse().getStatus();
  }

  @Test
  void keepsServerOwnedFieldsAndAcceptsEditableFields() {
    GlossaryTerm requested =
        new GlossaryTerm()
            .withDisplayName("changed")
            .withDescription("changed")
            .withTags(List.of(new TagLabel().withTagFQN("DataTimeliness.T1")))
            .withExtension(
                Map.of(
                    TechnicalDictionaryProfile.SURVIVORSHIP_RANK,
                    2,
                    TechnicalDictionaryProfile.SYSTEM_OWNER,
                    team(TEAM_ID)));

    GlossaryTerm prepared = validator.prepareDraft(requested, current());
    Map<String, Object> extension = TechnicalRecordValidator.extension(prepared.getExtension());

    assertEquals("name", prepared.getDisplayName());
    assertEquals("Tên khách hàng", prepared.getDescription());
    assertEquals(2, TechnicalRecordValidator.rank(extension));
    assertEquals("customer", extension.get(TechnicalDictionaryProfile.SOURCE_TABLE));
    assertEquals(
        List.of("Bản chính"), extension.get(TechnicalDictionaryProfile.RELEASE_VERSION_TYPE));
  }

  @Test
  void rejectsServerOwnedExtensionKeys() {
    GlossaryTerm requested =
        new GlossaryTerm().withExtension(Map.of(TechnicalDictionaryProfile.SOURCE_TABLE, "x"));
    WebApplicationException error =
        assertThrows(
            WebApplicationException.class, () -> validator.prepareDraft(requested, current()));
    assertEquals(400, status(error));
  }

  @Test
  void rejectsRankOutsideBoundsOrFractional() {
    for (Object rank : List.of(0, 1000, 1.5)) {
      GlossaryTerm requested =
          new GlossaryTerm()
              .withExtension(Map.of(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, rank));
      assertThrows(
          WebApplicationException.class,
          () -> validator.prepareDraft(requested, current()),
          String.valueOf(rank));
    }
  }

  @Test
  void rejectsUnknownTeamAndMalformedTeamId() {
    for (Object owner : List.of(team(UUID.randomUUID()), Map.of("id", "bad", "type", "team"))) {
      GlossaryTerm requested =
          new GlossaryTerm().withExtension(Map.of(TechnicalDictionaryProfile.SYSTEM_OWNER, owner));
      assertThrows(
          WebApplicationException.class, () -> validator.prepareDraft(requested, current()));
    }
  }

  @Test
  void rejectsUnmanagedDuplicatedOrMissingTags() {
    List<List<TagLabel>> invalid =
        List.of(
            List.of(new TagLabel().withTagFQN("PII.Sensitive")),
            List.of(
                new TagLabel().withTagFQN("DataTimeliness.T0"),
                new TagLabel().withTagFQN("DataTimeliness.T1")),
            List.of(new TagLabel().withTagFQN("DataElementType.Missing")));
    for (List<TagLabel> tags : invalid) {
      GlossaryTerm requested = new GlossaryTerm().withTags(tags);
      assertThrows(
          WebApplicationException.class, () -> validator.prepareDraft(requested, current()));
    }
  }

  @Test
  void requiresRankOnlyWhenCdeIsReferenced() {
    GlossaryTerm mappedWithoutRank =
        current().withRelatedTerms(List.of(new TermRelation().withTerm(new EntityReference())));
    WebApplicationException missing =
        assertThrows(
            WebApplicationException.class, () -> validator.requireWorkflowReady(mappedWithoutRank));
    assertEquals(400, status(missing));

    Map<String, Object> extension = TechnicalRecordValidator.extension(current().getExtension());
    extension.put(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, 1);
    GlossaryTerm unmappedWithRank = current().withExtension(extension);
    assertThrows(
        WebApplicationException.class, () -> validator.requireWorkflowReady(unmappedWithRank));

    assertDoesNotThrow(() -> validator.requireWorkflowReady(current()));
  }

  @Test
  void blocksWorkflowWhenSourceColumnIsUnavailable() {
    Map<String, Object> extension = TechnicalRecordValidator.extension(current().getExtension());
    extension.put(
        TechnicalDictionaryProfile.SOURCE_STATUS,
        List.of(TechnicalDictionaryProfile.SOURCE_UNAVAILABLE));
    GlossaryTerm unavailable = current().withExtension(extension);

    assertFalse(TechnicalRecordValidator.isSourceUnavailable(Map.of()));
    WebApplicationException error =
        assertThrows(
            WebApplicationException.class, () -> validator.requireWorkflowReady(unavailable));
    assertEquals(409, status(error));
  }
}
