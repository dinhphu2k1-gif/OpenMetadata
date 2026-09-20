/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

final class GlossaryWorkflowSupport {
  enum Action {
    CREATE_DRAFT,
    SUBMIT,
    APPROVE,
    REJECT,
    REOPEN,
    REVOKE;

    static Action fromPath(String value) {
      try {
        return valueOf(value.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase(Locale.ROOT));
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException("Unsupported glossary workflow action: " + value);
      }
    }
  }

  private static final Map<Action, EntityStatus> FROM =
      Map.of(
          Action.CREATE_DRAFT, EntityStatus.APPROVED,
          Action.SUBMIT, EntityStatus.DRAFT,
          Action.APPROVE, EntityStatus.IN_REVIEW,
          Action.REJECT, EntityStatus.IN_REVIEW,
          Action.REOPEN, EntityStatus.REJECTED,
          Action.REVOKE, EntityStatus.APPROVED);

  private static final Map<Action, EntityStatus> TO =
      Map.of(
          Action.CREATE_DRAFT, EntityStatus.DRAFT,
          Action.SUBMIT, EntityStatus.IN_REVIEW,
          Action.APPROVE, EntityStatus.APPROVED,
          Action.REJECT, EntityStatus.REJECTED,
          Action.REOPEN, EntityStatus.DRAFT,
          Action.REVOKE, EntityStatus.DRAFT);

  private GlossaryWorkflowSupport() {}

  static EntityStatus validate(
      Action action,
      EntityStatus current,
      Double currentVersion,
      GlossaryWorkflowRequest request,
      SubjectContext subject,
      List<EntityReference> owners,
      List<EntityReference> reviewers) {
    if (request == null || request.getExpectedNativeVersion() == null) {
      throw new BadRequestException("expectedNativeVersion is required");
    }
    if (!Objects.equals(currentVersion, request.getExpectedNativeVersion())) {
      throw new WebApplicationException(
          Response.status(Response.Status.CONFLICT)
              .entity(
                  String.format(
                      "Entity version conflict. Expected %s but current version is %s",
                      request.getExpectedNativeVersion(), currentVersion))
              .build());
    }
    if (current != FROM.get(action)) {
      throw new BadRequestException(
          String.format("Invalid workflow transition %s -> %s", current, action));
    }
    boolean elevated =
        subject.isAdmin()
            || subject.hasAnyRole("DataSteward")
            || subject.hasAnyRole("Admin")
            || subject.hasAnyRole("Organization");
    boolean proposer =
        subject.hasAnyRole("DataProposer") || subject.isOwner(owners) || elevated;
    boolean reviewer = elevated || subject.isReviewer(reviewers);

    if ((action == Action.APPROVE || action == Action.REJECT) && !reviewer) {
      throw new ForbiddenException("Only an assigned reviewer or Data Steward can review");
    }
    if (action == Action.REVOKE && !elevated) {
      throw new ForbiddenException("Only an administrator or Data Steward can revoke approval");
    }
    if (action != Action.APPROVE && action != Action.REJECT && !proposer) {
      throw new ForbiddenException("Only a proposer, owner, or Data Steward can change workflow");
    }

    return TO.get(action);
  }
}
