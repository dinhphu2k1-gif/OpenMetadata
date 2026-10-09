/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.glossary.GlossaryAuthorizationResolver.Capabilities;

class GlossaryResourcePermissionsTest {
  @Test
  void returnsPublishedOnlyPermissionsForConsumerWithoutWorkingAccess() {
    Map<String, Boolean> permissions =
        GlossaryResource.versionPermissions(GlossaryAuthorizationResolver.publishedReadOnly());

    assertEquals(
        Map.of(
            "canViewWorking", false,
            "canViewPublished", true,
            "canEditWorking", false,
            "canSubmit", false,
            "canCreateVersion", false,
            "canApprove", false,
            "canReject", false,
            "canArchive", false,
            "canImportCdeDrafts", false,
            "isConsumer", true),
        permissions);
  }

  @Test
  void returnsWorkingPermissionsForEditor() {
    Capabilities capabilities =
        new Capabilities(true, true, true, true, false, false, false, false);

    Map<String, Boolean> permissions = GlossaryResource.versionPermissions(capabilities);

    assertEquals(
        Map.of(
            "canViewWorking", true,
            "canViewPublished", true,
            "canEditWorking", true,
            "canSubmit", true,
            "canCreateVersion", false,
            "canApprove", false,
            "canReject", false,
            "canArchive", false,
            "canImportCdeDrafts", true,
            "isConsumer", false),
        permissions);
  }

  @Test
  void returnsWorkingPermissionsForApprover() {
    Capabilities capabilities = new Capabilities(true, true, false, false, false, true, true, true);

    Map<String, Boolean> permissions = GlossaryResource.versionPermissions(capabilities);

    assertEquals(
        Map.of(
            "canViewWorking", true,
            "canViewPublished", true,
            "canEditWorking", false,
            "canSubmit", false,
            "canCreateVersion", false,
            "canApprove", true,
            "canReject", true,
            "canArchive", true,
            "canImportCdeDrafts", false,
            "isConsumer", false),
        permissions);
  }
}
