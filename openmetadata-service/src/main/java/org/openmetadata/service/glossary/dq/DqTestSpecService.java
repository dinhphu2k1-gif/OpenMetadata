/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DqTestSpecs;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/** Orchestrates saving and checking the test declarations carried by a Data Quality Rule payload. */
public final class DqTestSpecService {
  private static final String THRESHOLD_PROPERTY = "qualityThreshold";

  private DqTestSpecService() {}

  /**
   * Returns the declarations to store in a working Draft. An absent request keeps the current
   * declarations; a present one replaces them, with server-issued keys.
   */
  public static DqTestSpecs prepareDraft(
      UUID ruleId, DqTestSpecs current, DqTestSpecs requested, Object extension) {
    DqTestSpecs result = current;
    if (requested != null) {
      final DqTestSpecs assigned = DqTestSpecKeys.assign(requested, issuedUpTo(ruleId, current));
      new DqTestSpecValidator(
              DqTestSpecValidator.Mode.DRAFT, definitionResolver(), null, ruleThreshold(extension))
          .validate(assigned);
      result = nullOrEmpty(assigned.getItems()) ? null : assigned;
    }
    return result;
  }

  /** Full check at Submit and Approve. */
  public static void validateForWorkflow(GlossaryTerm payload) {
    final DqTestSpecs specs = payload.getDataQualityTestSpecs();
    if (specs != null && !nullOrEmpty(specs.getItems())) {
      new DqTestSpecValidator(
              DqTestSpecValidator.Mode.FULL,
              definitionResolver(),
              latestApproved(payload.getId()),
              ruleThreshold(payload.getExtension()))
          .validate(specs);
    }
  }

  public static String ruleThreshold(Object extension) {
    String threshold = null;
    if (extension != null) {
      final Object value = JsonUtils.convertValue(extension, Map.class).get(THRESHOLD_PROPERTY);
      threshold = value == null ? null : value.toString();
    }
    return threshold;
  }

  /** Declarations of the most recently published snapshot of the Rule identity, if any. */
  public static DqTestSpecs latestApproved(UUID ruleId) {
    return listPublished(ruleId).stream()
        .max(Comparator.comparingLong(PublishedSnapshotRecord::publicationSequence))
        .map(DqTestSpecService::specsOf)
        .orElse(null);
  }

  static int issuedUpTo(UUID ruleId, DqTestSpecs current) {
    int highest = DqTestSpecKeys.highestNumber(current);
    for (PublishedSnapshotRecord snapshot : listPublished(ruleId)) {
      highest = Math.max(highest, DqTestSpecKeys.highestNumber(specsOf(snapshot)));
    }
    return highest;
  }

  public static Function<String, TestDefinition> definitionResolver() {
    return fqn -> Entity.findEntityByNameOrNull(Entity.TEST_DEFINITION, fqn, Include.NON_DELETED);
  }

  private static List<PublishedSnapshotRecord> listPublished(UUID ruleId) {
    return ruleId == null
        ? List.of()
        : Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .listPublished(Entity.GLOSSARY_TERM, ruleId);
  }

  private static DqTestSpecs specsOf(PublishedSnapshotRecord snapshot) {
    return JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class).getDataQualityTestSpecs();
  }
}
