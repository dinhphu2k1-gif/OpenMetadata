/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityVersionContext;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.glossary.technical.TechnicalCdeInfo;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentAssembler.RecordState;

class TechnicalDocumentAssemblerTest {
  private static final UUID TERM_ID = UUID.randomUUID();
  private static final UUID GLOSSARY_ID = UUID.randomUUID();
  private static final UUID CDE_ID = UUID.randomUUID();

  private static GlossaryTerm payload(boolean withCde) {
    GlossaryTerm term =
        new GlossaryTerm()
            .withDisplayName("brcd")
            .withDescription("Mã chi nhánh")
            .withExtension(
                Map.of(
                    TechnicalDictionaryProfile.SOURCE_COLUMN_FQN, "MIS.MISDB.aml.TBMS_CTR.brcd",
                    TechnicalDictionaryProfile.SOURCE_SERVICE, "MIS",
                    TechnicalDictionaryProfile.SOURCE_DATABASE, "MISDB",
                    TechnicalDictionaryProfile.SOURCE_SCHEMA, "aml",
                    TechnicalDictionaryProfile.SOURCE_TABLE, "TBMS_CTR",
                    TechnicalDictionaryProfile.SOURCE_COLUMN, "brcd",
                    TechnicalDictionaryProfile.SURVIVORSHIP_RANK, 2))
            .withTags(
                List.of(new TagLabel().withTagFQN("DataElementType.Atomic").withName("Atomic")));
    if (withCde) {
      term.setRelatedTerms(
          List.of(
              new TermRelation()
                  .withTerm(new EntityReference().withId(CDE_ID).withType("glossaryTerm"))
                  .withVersionContext(new EntityVersionContext().withBusinessVersion("2.3"))));
    }
    return term;
  }

  private static TechnicalRepresentation working(boolean withCde) {
    return new TechnicalRepresentation(
        "working", "Draft", "2.1", 4L, null, payload(withCde), 10L, "admin");
  }

  private static TechnicalRepresentation published() {
    return new TechnicalRepresentation(
        "published", "Approved", "2.0", null, "snap", payload(false), 5L, "admin");
  }

  private static RecordState state(TechnicalRepresentation current, TechnicalRepresentation published) {
    return new RecordState(TERM_ID, GLOSSARY_ID, "2", "column-key", current, published, "Available");
  }

  private static final TechnicalCdeInfo CDE =
      new TechnicalCdeInfo("CDE_001", "Mã chi nhánh", List.of());

  @SuppressWarnings("unchecked")
  private static Map<String, Object> view(Map<String, Object> document, String name) {
    return (Map<String, Object>) document.get(name);
  }

  @Test
  void neverApprovedRecordHasOnlyTheCurrentViewAndNoPublishedFlag() {
    Map<String, Object> document =
        TechnicalDocumentAssembler.assemble(state(working(false), null), id -> CDE);
    assertEquals(false, document.get("hasPublished"));
    assertFalse(document.containsKey("published"));
    assertEquals("Draft", view(document, "current").get("entityStatus"));
    assertEquals(4L, view(document, "current").get("workingRevision"));
    assertEquals(TERM_ID.toString(), document.get("termId"));
    assertEquals("2", document.get("parentBusinessVersion"));
  }

  @Test
  void approvedRecordWithWorkingCopyHasBothViews() {
    Map<String, Object> document =
        TechnicalDocumentAssembler.assemble(state(working(true), published()), id -> CDE);
    assertEquals(true, document.get("hasPublished"));
    assertEquals("Approved", view(document, "published").get("entityStatus"));
    assertEquals("Draft", view(document, "current").get("entityStatus"));
    assertNull(view(document, "published").get("cde"));
    assertEquals(CDE_ID.toString(), view(view(document, "current"), "cde").get("id"));
    assertEquals("CDE_001", view(view(document, "current"), "cde").get("code"));
    assertEquals("2.3", view(view(document, "current"), "cde").get("businessVersion"));
  }

  @Test
  void locationFieldsTableKeyAndClassificationsAreIndexed() {
    Map<String, Object> document =
        TechnicalDocumentAssembler.assemble(state(working(false), null), id -> CDE);
    assertEquals("MIS.MISDB.aml.TBMS_CTR.brcd", document.get("columnFqn"));
    assertEquals("MISDB.aml.TBMS_CTR", document.get("tableKey"));
    assertEquals("MIS", document.get("service"));
    assertEquals("Available", document.get("sourceStatus"));
    assertEquals(2, view(document, "current").get("rank"));
    Map<String, Object> elementType = view(view(document, "current"), "elementType");
    assertEquals("DataElementType.Atomic", elementType.get("fqn"));
    assertEquals("Atomic", elementType.get("label"));
    assertTrue(view(document, "current").containsKey("releaseVersionType"));
  }
}
