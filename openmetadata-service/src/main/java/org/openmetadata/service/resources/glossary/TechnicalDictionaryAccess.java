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
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Capabilities on the unversioned Technical Dictionary. Everybody who may view sees the same data;
 * the {@code Technical Dictionary} glossary is only the policy target. Editing, which takes effect
 * at once, is allowed to editors of the dictionary and to the Data Steward role.
 */
public final class TechnicalDictionaryAccess {
  private static final String DATA_STEWARD_ROLE = "DataSteward";

  private final GovernedScopeAuthorizer policies;

  public TechnicalDictionaryAccess(Authorizer authorizer) {
    this.policies = new GovernedScopeAuthorizer(authorizer);
  }

  public record Capabilities(
      boolean canView, boolean canEdit, boolean canImport, boolean canExport) {
    public Map<String, Boolean> asMap() {
      final Map<String, Boolean> result = new LinkedHashMap<>();
      result.put("canView", canView);
      result.put("canEdit", canEdit);
      result.put("canImport", canImport);
      result.put("canExport", canExport);
      return result;
    }
  }

  public Capabilities capabilities(SecurityContext securityContext) {
    final Glossary glossary = TechnicalCatalog.requireGlossary();
    final SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    final boolean canEdit =
        subject.isAdmin()
            || subject.hasAnyRole(DATA_STEWARD_ROLE)
            || policies.policyAllows(securityContext, glossary, MetadataOperation.EDIT_WORKING);
    final boolean canView =
        canEdit || policies.policyAllows(securityContext, glossary, MetadataOperation.VIEW_BASIC);
    return new Capabilities(canView, canEdit, canEdit, canView);
  }

  public Capabilities requireView(SecurityContext securityContext) {
    final Capabilities capabilities = capabilities(securityContext);
    if (!capabilities.canView()) {
      throw new ForbiddenException("Not authorized to view the Technical Dictionary");
    }
    return capabilities;
  }

  public void requireAdmin(SecurityContext securityContext) {
    if (!DefaultAuthorizer.getSubjectContext(securityContext).isAdmin()) {
      throw new ForbiddenException(
          "Only an administrator can rebuild the Technical Dictionary index");
    }
  }

  public Capabilities requireEdit(SecurityContext securityContext) {
    final Capabilities capabilities = capabilities(securityContext);
    if (!capabilities.canEdit()) {
      throw new ForbiddenException("Not authorized to edit the Technical Dictionary");
    }
    return capabilities;
  }
}
