/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.openmetadata.service.Entity.GLOSSARY;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry.Profile;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.Scope;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.ScopeType;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * Resolves one governed glossary scope and checks that the caller may read it, without loading any
 * record. Shared by the database flat list and the Technical Dictionary index reads.
 */
public final class GovernedScopeAuthorizer {
  private final Authorizer authorizer;
  private final GlossaryFlatListService flatListService = new GlossaryFlatListService();
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  public GovernedScopeAuthorizer(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  /** A readable scope and the caller's catalog-level capabilities on it. */
  public record ScopeAccess(
      UUID glossaryId,
      String parentBusinessVersion,
      Scope scope,
      Profile profile,
      boolean consumerOnly,
      GlossaryAuthorizationResolver.Capabilities capabilities,
      Glossary authorizationGlossary) {

    public ScopeType type() {
      return scope.type();
    }

    public boolean isArchived() {
      return scope.type() == ScopeType.ARCHIVED;
    }
  }

  public ScopeAccess authorizeRead(
      SecurityContext securityContext,
      String glossaryIdParam,
      String requestedParentBusinessVersion,
      Profile requiredProfile) {
    final String parentBusinessVersion = canonicalScope(requestedParentBusinessVersion);
    final EntityReference glossary = resolveGlossary(glossaryIdParam, requiredProfile);
    final Profile profile = GovernedGlossaryProfileRegistry.requireName(glossary.getName());
    final Scope scope = flatListService.resolveScope(glossary.getId(), parentBusinessVersion);
    final Glossary authorizationGlossary = JsonUtils.readValue(scope.payload(), Glossary.class);
    final boolean consumerOnly =
        GlossaryAuthorizationResolver.isConsumerOnly(
            DefaultAuthorizer.getSubjectContext(securityContext));
    final GlossaryAuthorizationResolver.Capabilities capabilities =
        capabilitiesFor(securityContext, authorizationGlossary);
    if (!canRead(
        securityContext, scope.type(), authorizationGlossary, consumerOnly, capabilities)) {
      throw new NotFoundException(profile.glossaryName() + " scope was not found");
    }
    return new ScopeAccess(
        glossary.getId(),
        parentBusinessVersion,
        scope,
        profile,
        consumerOnly,
        capabilities,
        authorizationGlossary);
  }

  private static String canonicalScope(String requestedParentBusinessVersion) {
    String parentBusinessVersion = null;
    try {
      parentBusinessVersion =
          GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    return parentBusinessVersion;
  }

  private static EntityReference resolveGlossary(String glossaryIdParam, Profile requiredProfile) {
    if (glossaryIdParam == null || glossaryIdParam.isBlank()) {
      throw new BadRequestException("glossary is required for a governed flat list");
    }
    EntityReference glossary = null;
    try {
      glossary = termRepository().getGlossary(glossaryIdParam);
      final Profile profile = GovernedGlossaryProfileRegistry.requireName(glossary.getName());
      if (requiredProfile != null && profile != requiredProfile) {
        throw new BadRequestException("Unexpected governed glossary profile");
      }
    } catch (BadRequestException | EntityNotFoundException exception) {
      throw new NotFoundException("Governed glossary scope was not found");
    }
    return glossary;
  }

  private boolean canRead(
      SecurityContext securityContext,
      ScopeType type,
      Glossary glossary,
      boolean consumerOnly,
      GlossaryAuthorizationResolver.Capabilities capabilities) {
    return switch (type) {
      case ACTIVE -> policyAllows(securityContext, glossary, MetadataOperation.VIEW_BASIC);
      case WORKING -> !consumerOnly && capabilities.canViewWorking();
      case ARCHIVED -> policyAllows(securityContext, glossary, MetadataOperation.VIEW_BASIC)
          || capabilities.canViewWorking()
          || capabilities.canArchive();
    };
  }

  /**
   * Catalog payload that authorizes creating a record in {@code parentBusinessVersion}: the working
   * catalog version or the active Approved one.
   */
  public Glossary resolveCreateScope(
      UUID glossaryId, String parentBusinessVersion, Profile profile) {
    final Glossary working = workingCatalog(glossaryId, parentBusinessVersion);
    return working != null ? working : activeCatalog(glossaryId, parentBusinessVersion, profile);
  }

  private Glossary workingCatalog(UUID glossaryId, String parentBusinessVersion) {
    Glossary result = null;
    try {
      final WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY, glossaryId);
      result =
          parentBusinessVersion.equals(working.businessVersion())
              ? JsonUtils.readValue(working.payload(), Glossary.class)
              : null;
    } catch (NotFoundException ignored) {
      // An active Approved governed glossary intentionally has no working record.
    }
    return result;
  }

  private Glossary activeCatalog(UUID glossaryId, String parentBusinessVersion, Profile profile) {
    final PublishedSnapshotRecord published =
        versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY, glossaryId);
    if (!parentBusinessVersion.equals(published.businessVersion())
        || published.archivedAt() != null) {
      throw new BadRequestException(
          "parentBusinessVersion must identify a working or active Approved "
              + profile.glossaryName());
    }
    return JsonUtils.readValue(published.payload(), Glossary.class);
  }

  public GlossaryAuthorizationResolver.Capabilities capabilitiesFor(
      SecurityContext securityContext, Glossary glossary) {
    return GlossaryAuthorizationResolver.fromPolicy(
        policyAllows(securityContext, glossary, MetadataOperation.VIEW_WORKING),
        policyAllows(securityContext, glossary, MetadataOperation.EDIT_WORKING),
        policyAllows(securityContext, glossary, MetadataOperation.SUBMIT_WORKING),
        policyAllows(securityContext, glossary, MetadataOperation.CREATE_VERSION),
        policyAllows(securityContext, glossary, MetadataOperation.APPROVE_WORKING),
        policyAllows(securityContext, glossary, MetadataOperation.REJECT_WORKING),
        policyAllows(securityContext, glossary, MetadataOperation.ARCHIVE_PUBLISHED));
  }

  public boolean policyAllows(
      SecurityContext securityContext, Glossary glossary, MetadataOperation operation) {
    boolean allowed = true;
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(GLOSSARY, operation),
          new ResourceContext<Glossary>(
              GLOSSARY, glossary, (GlossaryRepository) Entity.getEntityRepository(GLOSSARY)));
    } catch (AuthorizationException exception) {
      allowed = false;
    }
    return allowed;
  }

  private static GlossaryTermRepository termRepository() {
    return (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
  }
}
