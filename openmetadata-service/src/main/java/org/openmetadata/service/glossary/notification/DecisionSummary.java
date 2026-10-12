/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

/** The decisions one reviewer made on one submitter's requests in a catalog, merged per batch. */
record DecisionSummary(
    int approvedCount,
    int rejectedCount,
    String onlyRequestName,
    ReviewDecision.RecordRef onlyRecord) {
  private static final String APPROVED_ONE = "Yêu cầu \"%s\" đã được duyệt trong %s";
  private static final String REJECTED_ONE = "Yêu cầu \"%s\" đã bị từ chối trong %s";
  private static final String APPROVED_MANY = "%d yêu cầu đã được duyệt";
  private static final String REJECTED_MANY = "%d yêu cầu bị từ chối";
  private static final String IN_CATALOG = " trong %s";
  private static final String SEPARATOR = ", ";

  static DecisionSummary of(ReviewDecision decision) {
    return new DecisionSummary(
        decision.approved() ? 1 : 0,
        decision.approved() ? 0 : 1,
        decision.requestName(),
        decision.record());
  }

  DecisionSummary merge(DecisionSummary other) {
    return new DecisionSummary(
        approvedCount + other.approvedCount, rejectedCount + other.rejectedCount, null, null);
  }

  /** Names a single request; counts several, approvals first. */
  String describe(String catalogName) {
    final String result;
    if (isSingleNamedRequest()) {
      result =
          String.format(
              approvedCount == 1 ? APPROVED_ONE : REJECTED_ONE, onlyRequestName, catalogName);
    } else {
      result = counts() + String.format(IN_CATALOG, catalogName);
    }
    return result;
  }

  private boolean isSingleNamedRequest() {
    return approvedCount + rejectedCount == 1 && onlyRequestName != null;
  }

  private String counts() {
    final StringBuilder text = new StringBuilder();
    if (approvedCount > 0) {
      text.append(String.format(APPROVED_MANY, approvedCount));
    }
    if (rejectedCount > 0) {
      text.append(text.isEmpty() ? "" : SEPARATOR)
          .append(String.format(REJECTED_MANY, rejectedCount));
    }
    return text.toString();
  }
}
