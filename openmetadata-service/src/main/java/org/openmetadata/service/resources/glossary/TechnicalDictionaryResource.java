/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.openmetadata.service.Entity.GLOSSARY;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry.Profile;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalColumnIndex;
import org.openmetadata.service.glossary.technical.TechnicalColumnIndex.ColumnDocument;
import org.openmetadata.service.glossary.technical.TechnicalColumnSource;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;
import org.openmetadata.service.glossary.technical.TechnicalRecordDeclaration;
import org.openmetadata.service.glossary.technical.TechnicalRecordDeclarations;
import org.openmetadata.service.glossary.technical.TechnicalRecordDeletion;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentBuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchCriteria;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchParameters;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchParameters.ReadScope;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchService;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * Technical Dictionary list, statistics and Column declaration. Lists are read from
 * `technical_dictionary_search_index` with a query built here from the request parameters; writes
 * go to the database and are then synchronized to the index.
 */
@Slf4j
@Path("/v1/glossaryTerms/technical")
@Tag(name = "Glossaries", description = "Technical Dictionary records read from their own index.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "technicalDictionary")
public class TechnicalDictionaryResource {
  private static final String DEFAULT_PAGE_SIZE = "25";
  private static final String DEFAULT_COLUMN_LIMIT = "20";
  private static final int MAX_COLUMN_LIMIT = 50;
  private static final String DATA = "data";

  private final Authorizer authorizer;
  private final GovernedScopeAuthorizer scopeAuthorizer;
  private final TechnicalSearchService searchService = new TechnicalSearchService();
  private final TechnicalRecordDeclarations declarations = new TechnicalRecordDeclarations();
  private final TechnicalRecordDeletion deletion = new TechnicalRecordDeletion();

  public TechnicalDictionaryResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.scopeAuthorizer = new GovernedScopeAuthorizer(authorizer);
  }

  @GET
  @Path("/search")
  @Operation(
      operationId = "searchTechnicalDictionaryRecords",
      summary = "Search the declared Columns of one Technical Dictionary version")
  public Map<String, Object> search(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @QueryParam("q") String q,
      @QueryParam("statuses") String statuses,
      @QueryParam("sourceServices") String sourceServices,
      @QueryParam("cdeMapping") String cdeMapping,
      @QueryParam("cdeTermIds") String cdeTermIds,
      @QueryParam("systemOwnerIds") String systemOwnerIds,
      @QueryParam("sourceStatuses") String sourceStatuses,
      @QueryParam("elementTypes") String elementTypes,
      @QueryParam("generationTypes") String generationTypes,
      @QueryParam("creationMethods") String creationMethods,
      @QueryParam("timeliness") String timeliness,
      @DefaultValue(DEFAULT_PAGE_SIZE) @QueryParam("limit") int limit,
      @DefaultValue("0") @QueryParam("offset") int offset) {
    final Map<String, String> parameters =
        TechnicalSearchParameters.parameters(
            q,
            statuses,
            sourceServices,
            cdeMapping,
            cdeTermIds,
            systemOwnerIds,
            sourceStatuses,
            elementTypes,
            generationTypes,
            creationMethods,
            timeliness);
    final ReadScope scope = readScope(securityContext, glossaryId, parentBusinessVersion);
    return searchService.search(
        TechnicalSearchParameters.criteria(scope, parameters, limit, offset));
  }

  @GET
  @Path("/stats")
  @Operation(
      operationId = "getTechnicalDictionaryIndexStats",
      summary = "Declared Columns, tables, sources and Approved records of one version")
  public Map<String, Long> stats(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion) {
    final ReadScope scope = readScope(securityContext, glossaryId, parentBusinessVersion);
    return searchService.stats(
        TechnicalSearchCriteria.scopeOnly(
            scope.glossaryId(), scope.parentBusinessVersion(), scope.consumerOnly()));
  }

  @GET
  @Path("/columns")
  @Operation(
      operationId = "searchTechnicalDictionaryColumns",
      summary = "Find physical Columns to declare; Columns declared in the version are marked")
  public Map<String, Object> columns(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @QueryParam("q") String q,
      @DefaultValue(DEFAULT_COLUMN_LIMIT) @Min(1) @Max(MAX_COLUMN_LIMIT) @QueryParam("limit")
          int limit) {
    final GovernedScopeAuthorizer.ScopeAccess access =
        requireEditableScope(securityContext, glossaryId.toString(), parentBusinessVersion);
    final List<ColumnDocument> columns = findColumns(q, limit);
    final Map<String, String> declared =
        searchService.declaredColumns(
            access.glossaryId(),
            access.parentBusinessVersion(),
            columns.stream().map(column -> column.toSource().columnKey()).toList());
    return Map.of(DATA, columns.stream().map(column -> columnView(column, declared)).toList());
  }

  @POST
  @Path("/records")
  @Operation(
      operationId = "declareTechnicalDictionaryColumn",
      summary = "Declare a Column with its initial values as a Draft record")
  public Response declare(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @NotNull TechnicalRecordDeclaration declaration) {
    final String scope = canonicalScope(parentBusinessVersion);
    authorizeDeclaration(securityContext, requireTechnicalGlossary(glossaryId), scope);
    final UUID termId =
        declarations.declare(scope, declaration, securityContext.getUserPrincipal().getName());
    final Map<String, Object> row =
        new TechnicalDocumentBuilder()
            .currentRow(termId)
            .orElseThrow(() -> new NotFoundException("The declared record was not found"));
    return Response.status(Response.Status.CREATED).entity(row).build();
  }

  @DELETE
  @Path("/records/{termId}")
  @Operation(
      operationId = "deleteTechnicalDictionaryDraft",
      summary = "Delete a Draft record that was never Approved")
  public Map<String, Object> delete(
      @Context SecurityContext securityContext,
      @PathParam("termId") UUID termId,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion) {
    final GovernedScopeAuthorizer.ScopeAccess access =
        requireEditableScope(
            securityContext,
            TechnicalCatalog.requireGlossary().getId().toString(),
            parentBusinessVersion);
    deletion.delete(termId, access.parentBusinessVersion());
    final Map<String, Object> result = new LinkedHashMap<>();
    result.put("termId", termId);
    result.put("deleted", true);
    return result;
  }

  private ReadScope readScope(
      SecurityContext securityContext, UUID glossaryId, String parentBusinessVersion) {
    final GovernedScopeAuthorizer.ScopeAccess access =
        scopeAuthorizer.authorizeRead(
            securityContext,
            glossaryId.toString(),
            parentBusinessVersion,
            Profile.TECHNICAL_DICTIONARY);
    TechnicalIndexSync.processPendingForRequest();
    return new ReadScope(
        access.glossaryId(),
        access.parentBusinessVersion(),
        readsPublishedOnly(access),
        access.isArchived());
  }

  /** Callers without view-working capability read only the published view (design §6). */
  static boolean readsPublishedOnly(GovernedScopeAuthorizer.ScopeAccess access) {
    return access.consumerOnly() || !access.capabilities().canViewWorking();
  }

  private GovernedScopeAuthorizer.ScopeAccess requireEditableScope(
      SecurityContext securityContext, String glossaryId, String parentBusinessVersion) {
    final GovernedScopeAuthorizer.ScopeAccess access =
        scopeAuthorizer.authorizeRead(
            securityContext, glossaryId, parentBusinessVersion, Profile.TECHNICAL_DICTIONARY);
    if (access.consumerOnly() || !access.capabilities().canEditWorking()) {
      throw new ForbiddenException("Not authorized to edit this Technical Dictionary version");
    }
    return access;
  }

  private static Glossary requireTechnicalGlossary(UUID glossaryId) {
    final Glossary technical = TechnicalCatalog.requireGlossary();
    if (!technical.getId().equals(glossaryId)) {
      throw new NotFoundException("Technical Dictionary glossary was not found");
    }
    return technical;
  }

  /** Same authorization as creating a governed glossary term: edit the catalog version. */
  private void authorizeDeclaration(
      SecurityContext securityContext, Glossary technical, String parentBusinessVersion) {
    final Glossary catalog =
        scopeAuthorizer.resolveCreateScope(
            technical.getId(), parentBusinessVersion, Profile.TECHNICAL_DICTIONARY);
    authorizer.authorize(
        securityContext,
        new OperationContext(GLOSSARY, MetadataOperation.EDIT_WORKING),
        new ResourceContext<>(GLOSSARY, catalog.getId(), null));
  }

  private static String canonicalScope(String parentBusinessVersion) {
    String scope = null;
    try {
      scope = GlossaryBusinessVersion.requireCanonicalDictionary(parentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    return scope;
  }

  private static List<ColumnDocument> findColumns(String q, int limit) {
    List<ColumnDocument> columns = List.of();
    try {
      columns = TechnicalColumnIndex.search(q, limit);
    } catch (IllegalStateException exception) {
      throw TechnicalDictionaryErrors.indexUnavailable(exception.getMessage());
    }
    return columns;
  }

  private static Map<String, Object> columnView(
      ColumnDocument document, Map<String, String> declared) {
    final TechnicalColumnSource column = document.toSource();
    final Map<String, Object> view = new LinkedHashMap<>(column.sourceExtension());
    view.put("columnKey", column.columnKey());
    view.put("columnFqn", column.columnFqn());
    view.put("description", column.description());
    view.put("declared", declared.containsKey(column.columnKey()));
    view.put("termId", declared.get(column.columnKey()));
    return view;
  }
}
