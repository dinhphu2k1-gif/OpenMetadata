/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/** The published face of a Data Quality Rule that its testcases are derived from. */
public record DqRuleContext(
    UUID ruleId,
    String code,
    String fullyQualifiedName,
    String displayName,
    String description,
    String parentBusinessVersion,
    String businessVersion,
    String cdeTermId,
    List<DqTestSpec> specs,
    String qualityThreshold,
    String dimension) {

  static final String DIMENSION_CLASSIFICATION = "DataQualityDimension";

  public static DqRuleContext of(PublishedSnapshotRecord snapshot, GlossaryTerm payload) {
    return new DqRuleContext(
        snapshot.entityId(),
        payload.getName(),
        payload.getFullyQualifiedName(),
        payload.getDisplayName(),
        payload.getDescription(),
        snapshot.parentBusinessVersion(),
        snapshot.businessVersion(),
        cdeOf(payload),
        payload.getDataQualityTestSpecs() == null
                || nullOrEmpty(payload.getDataQualityTestSpecs().getItems())
            ? List.of()
            : payload.getDataQualityTestSpecs().getItems(),
        DqTestSpecService.ruleThreshold(payload.getExtension()),
        dimensionOf(payload));
  }

  private static String dimensionOf(GlossaryTerm payload) {
    String dimension = null;
    if (!nullOrEmpty(payload.getTags())) {
      for (var tag : payload.getTags()) {
        if (dimension == null
            && tag.getTagFQN() != null
            && tag.getTagFQN().startsWith(DIMENSION_CLASSIFICATION + ".")) {
          dimension = tag.getTagFQN();
        }
      }
    }
    return dimension;
  }

  /** The rule code with every character outside [A-Za-z0-9_] replaced, safe inside entity names. */
  public String safeCode() {
    return code.replaceAll("[^A-Za-z0-9_]", "_");
  }

  public String testSuiteName() {
    return "DQR__" + parentBusinessVersion + "__" + safeCode();
  }

  public String testCaseName(String specKey) {
    return "dqr__" + safeCode() + "__" + specKey;
  }

  public String testDefinitionName(String specKey) {
    return DqTestSpecValidator.MANAGED_DEFINITION_PREFIX
        + parentBusinessVersion
        + "__"
        + safeCode()
        + "__"
        + specKey;
  }

  public String testCaseDisplayName(DqTestSpec spec) {
    return code + " · " + spec.getName();
  }

  private static String cdeOf(GlossaryTerm payload) {
    String cde = null;
    if (!nullOrEmpty(payload.getRelatedTerms())) {
      for (TermRelation relation : payload.getRelatedTerms()) {
        final EntityReference term = relation.getTerm();
        if (cde == null && term != null && term.getId() != null) {
          cde = term.getId().toString();
        }
      }
    }
    return cde;
  }
}
