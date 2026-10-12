/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Approval or rejection of one request, reported back to the user who submitted it. The request
 * name is what the submitter recognises it by: the term name or the column of a technical record.
 */
public record ReviewDecision(
    boolean approved, String submitter, String requestName, RecordRef record) {

  /** Where the decided record lives, enough for the bell to open it. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record RecordRef(
      String id, String fullyQualifiedName, String businessVersion, String parentBusinessVersion) {}

  public static ReviewDecision approved(String submitter, String requestName) {
    return approved(submitter, requestName, null);
  }

  public static ReviewDecision approved(String submitter, String requestName, RecordRef record) {
    return new ReviewDecision(true, submitter, requestName, record);
  }

  public static ReviewDecision rejected(String submitter, String requestName) {
    return rejected(submitter, requestName, null);
  }

  public static ReviewDecision rejected(String submitter, String requestName, RecordRef record) {
    return new ReviewDecision(false, submitter, requestName, record);
  }
}
