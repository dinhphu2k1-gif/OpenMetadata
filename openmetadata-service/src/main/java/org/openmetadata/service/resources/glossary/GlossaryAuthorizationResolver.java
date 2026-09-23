/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import jakarta.ws.rs.ForbiddenException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Central workflow capability resolver. Organization is not elevated without a matching policy. */
public final class GlossaryAuthorizationResolver {
  private GlossaryAuthorizationResolver() {}

  public static Capabilities fromPolicy(
      boolean canViewWorking,
      boolean canEditWorking,
      boolean canSubmit,
      boolean canCreateVersion,
      boolean canApprove,
      boolean canReject,
      boolean canArchive) {
    return new Capabilities(
        canViewWorking,
        true,
        canEditWorking,
        canSubmit,
        canCreateVersion,
        canApprove,
        canReject,
        canArchive);
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

  /** Consumer access is always limited to immutable published representations. */
  public static Capabilities publishedReadOnly() {
    return new Capabilities(false, true, false, false, false, false, false, false);
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

  public static void requireCreateVersion(Capabilities capabilities) {
    require(capabilities.canCreateVersion(), "Not authorized to create a CDE version");
  }

  public static void requireReview(Capabilities capabilities) {
    require(capabilities.canApprove(), "Not authorized to approve the working version");
  }

  public static void requireReject(Capabilities capabilities) {
    require(capabilities.canReject(), "Not authorized to reject the working version");
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
      boolean canCreateVersion,
      boolean canApprove,
      boolean canReject,
      boolean canArchive) {
    public Map<String, Boolean> asMap() {
      Map<String, Boolean> result = new LinkedHashMap<>();
      result.put("canViewWorking", canViewWorking);
      result.put("canViewPublished", canViewPublished);
      result.put("canEditWorking", canEditWorking);
      result.put("canSubmit", canSubmit);
      result.put("canCreateVersion", canCreateVersion);
      result.put("canApprove", canApprove);
      result.put("canReject", canReject);
      result.put("canArchive", canArchive);
      return result;
    }
  }
}
