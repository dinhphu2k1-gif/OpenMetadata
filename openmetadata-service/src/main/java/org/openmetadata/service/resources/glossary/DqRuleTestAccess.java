/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.glossary.dq.DqCatalog;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;

/**
 * Capabilities on the test execution of Data Quality Rules. Viewing results is allowed to whoever
 * may view the Data Quality glossary; declaring, scheduling and running is allowed to editors of
 * its working versions and to administrators.
 */
public final class DqRuleTestAccess {
  private final GovernedScopeAuthorizer policies;

  public DqRuleTestAccess(Authorizer authorizer) {
    this.policies = new GovernedScopeAuthorizer(authorizer);
  }

  public record Capabilities(boolean canView, boolean canEdit, boolean canRun, boolean isAdmin) {
    public Map<String, Boolean> asMap() {
      final Map<String, Boolean> result = new LinkedHashMap<>();
      result.put("canView", canView);
      result.put("canEdit", canEdit);
      result.put("canRun", canRun);
      result.put("isAdmin", isAdmin);
      return result;
    }
  }

  public Capabilities capabilities(SecurityContext securityContext) {
    final Glossary glossary = DqCatalog.requireGlossary();
    final boolean admin = DefaultAuthorizer.getSubjectContext(securityContext).isAdmin();
    final boolean canEdit =
        admin || policies.policyAllows(securityContext, glossary, MetadataOperation.EDIT_WORKING);
    final boolean canView =
        canEdit || policies.policyAllows(securityContext, glossary, MetadataOperation.VIEW_BASIC);
    return new Capabilities(canView, canEdit, canEdit, admin);
  }

  public Capabilities requireView(SecurityContext securityContext) {
    final Capabilities capabilities = capabilities(securityContext);
    if (!capabilities.canView()) {
      throw new ForbiddenException("Not authorized to view Data Quality Rule test results");
    }
    return capabilities;
  }

  public Capabilities requireEdit(SecurityContext securityContext) {
    final Capabilities capabilities = capabilities(securityContext);
    if (!capabilities.canEdit()) {
      throw new ForbiddenException("Not authorized to change Data Quality Rule tests");
    }
    return capabilities;
  }

  public void requireAdmin(SecurityContext securityContext) {
    if (!DefaultAuthorizer.getSubjectContext(securityContext).isAdmin()) {
      throw new ForbiddenException("Only an administrator can do this");
    }
  }
}
