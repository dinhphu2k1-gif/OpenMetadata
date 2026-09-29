/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;

class TechnicalImportPatchTest {

  private static GlossaryTerm term() {
    Map<String, Object> extension = new HashMap<>();
    extension.put(TechnicalDictionaryProfile.SOURCE_TABLE, "CUSTOMER");
    extension.put(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, 5);
    return new GlossaryTerm()
        .withExtension(extension)
        .withRelatedTerms(
            List.of(TechnicalImportTestSupport.relation(TechnicalImportTestSupport.CDE_ID)))
        .withTags(
            List.of(
                TechnicalImportTestSupport.tag("DataTimeliness.T0"),
                TechnicalImportTestSupport.tag("DataElementType.AtomicDataElement"),
                TechnicalImportTestSupport.tag("PII.Sensitive")));
  }

  private static RowPatch patch(
      Field<Integer> rank, Field<EntityReference> owner, Map<String, Field<TagLabel>> tags) {
    return new RowPatch(Field.absent(), rank, tags, owner);
  }

  @Test
  void setsAndClearsOnlySpecifiedFields() {
    GlossaryTerm patched =
        TechnicalImportPatch.apply(
            term(),
            patch(
                Field.of(1),
                Field.of(
                    new EntityReference()
                        .withId(TechnicalImportTestSupport.TEAM_ID)
                        .withType("team")),
                Map.of(
                    TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION,
                    Field.of(TechnicalImportTestSupport.tag("DataTimeliness.T1")))));

    Map<String, Object> extension = TechnicalRecordValidator.extension(patched.getExtension());
    assertEquals(1, TechnicalRecordValidator.rank(extension));
    assertEquals("CUSTOMER", extension.get(TechnicalDictionaryProfile.SOURCE_TABLE));
    assertTrue(extension.containsKey(TechnicalDictionaryProfile.SYSTEM_OWNER));
    assertEquals(1, patched.getRelatedTerms().size());
    List<String> tags = patched.getTags().stream().map(TagLabel::getTagFQN).toList();
    assertTrue(tags.contains("DataTimeliness.T1"));
    assertFalse(tags.contains("DataTimeliness.T0"));
    assertTrue(tags.contains("DataElementType.AtomicDataElement"));
    assertTrue(tags.contains("PII.Sensitive"));
  }

  @Test
  void emptyValuesClearRankOwnerAndTags() {
    RowPatch clear =
        new RowPatch(
            Field.of(null),
            Field.of(null),
            Map.of(TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION, Field.of(null)),
            Field.of(null));

    GlossaryTerm patched = TechnicalImportPatch.apply(term(), clear);

    Map<String, Object> extension = TechnicalRecordValidator.extension(patched.getExtension());
    assertFalse(extension.containsKey(TechnicalDictionaryProfile.SURVIVORSHIP_RANK));
    assertEquals(0, patched.getRelatedTerms().size());
    assertEquals(
        List.of("DataTimeliness.T0", "PII.Sensitive"),
        patched.getTags().stream().map(TagLabel::getTagFQN).toList());
  }

  @Test
  void absentFieldsLeaveThePayloadUntouched() {
    GlossaryTerm patched =
        TechnicalImportPatch.apply(
            term(), new RowPatch(Field.absent(), Field.absent(), Map.of(), Field.absent()));
    assertEquals(3, patched.getTags().size());
    assertEquals(
        5,
        TechnicalRecordValidator.rank(TechnicalRecordValidator.extension(patched.getExtension())));
    assertEquals(1, patched.getRelatedTerms().size());
  }
}
