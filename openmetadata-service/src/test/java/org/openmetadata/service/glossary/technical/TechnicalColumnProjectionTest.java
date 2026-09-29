/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;

class TechnicalColumnProjectionTest {

  private static TagLabel tag(String fqn, TagLabel.TagSource source) {
    return new TagLabel().withTagFQN(fqn).withSource(source);
  }

  @Test
  void managesOnlyDataDictionaryCdeTagsAndTechnicalClassifications() {
    assertTrue(
        TechnicalColumnProjection.isManaged(
            tag("Data Dictionary.CDE1@v2", TagLabel.TagSource.GLOSSARY)));
    assertTrue(
        TechnicalColumnProjection.isManaged(
            tag("DataElementType.AtomicDataElement", TagLabel.TagSource.CLASSIFICATION)));
    assertFalse(
        TechnicalColumnProjection.isManaged(
            tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION)));
    assertFalse(
        TechnicalColumnProjection.isManaged(
            tag("Business Glossary.Term", TagLabel.TagSource.GLOSSARY)));
    assertFalse(
        TechnicalColumnProjection.isManaged(
            tag("Data Dictionary.CDE1@v2", TagLabel.TagSource.CLASSIFICATION)));
  }

  @Test
  void mergeReplacesManagedTagsAndKeepsOthers() {
    TagLabel pii = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    TagLabel staleCde = tag("Data Dictionary.CDE1@v1", TagLabel.TagSource.GLOSSARY);
    TagLabel staleType = tag("DataTimeliness.T0", TagLabel.TagSource.CLASSIFICATION);
    TagLabel newCde = tag("Data Dictionary.CDE1@v2", TagLabel.TagSource.GLOSSARY);

    List<TagLabel> merged =
        TechnicalColumnProjection.mergeManagedTags(
            List.of(pii, staleCde, staleType), List.of(newCde));

    assertEquals(
        List.of("PII.Sensitive", "Data Dictionary.CDE1@v2"),
        merged.stream().map(TagLabel::getTagFQN).toList());
  }

  @Test
  void mergeWithNoDesiredTagsRemovesAllManagedTags() {
    List<TagLabel> merged =
        TechnicalColumnProjection.mergeManagedTags(
            List.of(tag("Data Dictionary.CDE1@v1", TagLabel.TagSource.GLOSSARY)), List.of());
    assertTrue(merged.isEmpty());
    assertTrue(TechnicalColumnProjection.mergeManagedTags(null, List.of()).isEmpty());
  }
}
