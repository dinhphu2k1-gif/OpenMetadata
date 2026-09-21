/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import jakarta.ws.rs.ForbiddenException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Central workflow capability resolver. Organization is not elevated without a matching policy. */
public final class GlossaryAuthorizationResolver {
  private GlossaryAuthorizationResolver() {}

  public static Capabilities resolve(
      SubjectContext subject, List<EntityReference> owners, List<EntityReference> reviewers) {
    boolean administrator = subject != null && (subject.isAdmin() || subject.hasAnyRole("Admin"));
    boolean steward = subject != null && subject.hasAnyRole("DataSteward");
    boolean owner = subject != null && subject.isOwner(owners);
    boolean proposer = subject != null && subject.hasAnyRole("DataProposer");
    boolean reviewer = subject != null && subject.isReviewer(reviewers);
    boolean elevated = administrator || steward;
    return new Capabilities(
        elevated || proposer || owner || reviewer,
        true,
        elevated || proposer || owner,
        elevated || proposer || owner,
        elevated || reviewer,
        elevated || reviewer,
        elevated);
  }

  public static boolean isConsumerOnly(SubjectContext subject) {
    if (subject == null || subject.isAdmin() || subject.isBot()) {
      return false;
    }
    boolean managesContent =
        subject.hasAnyRole("Admin")
            || subject.hasAnyRole("DataSteward")
            || subject.hasAnyRole("DataProposer");
    return !managesContent
        && (subject.hasAnyRole("BasicConsumer") || subject.hasAnyRole("DataConsumer"));
  }

  public static void requireViewWorking(Capabilities capabilities) {
    require(capabilities.canViewWorking(), "Not authorized to view the working version");
  }

  public static void requireEdit(Capabilities capabilities) {
    require(capabilities.canEditWorking(), "Not authorized to edit the working version");
  }

  public static void requireSubmit(Capabilities capabilities) {
    require(capabilities.canSubmit(), "Not authorized to submit the working version");
  }

  public static void requireReview(Capabilities capabilities) {
    require(capabilities.canApprove(), "Only an assigned reviewer or Data Steward can review");
  }

  private static void require(boolean allowed, String message) {
    if (!allowed) {
      throw new ForbiddenException(message);
    }
  }

  public record Capabilities(
      boolean canViewWorking,
      boolean canViewPublished,
      boolean canEditWorking,
      boolean canSubmit,
      boolean canApprove,
      boolean canReject,
      boolean canArchive) {
    public Capabilities restrictToPolicy(boolean canEdit, boolean canChangeStatus) {
      return new Capabilities(
          canEdit || canChangeStatus,
          canViewPublished,
          canEdit,
          canEdit || canChangeStatus,
          canApprove && canChangeStatus,
          canReject && canChangeStatus,
          canArchive && canChangeStatus);
    }

    public Map<String, Boolean> asMap() {
      Map<String, Boolean> result = new LinkedHashMap<>();
      result.put("canViewWorking", canViewWorking);
      result.put("canViewPublished", canViewPublished);
      result.put("canEditWorking", canEditWorking);
      result.put("canSubmit", canSubmit);
      result.put("canApprove", canApprove);
      result.put("canReject", canReject);
      result.put("canArchive", canArchive);
      return result;
    }
  }
}
