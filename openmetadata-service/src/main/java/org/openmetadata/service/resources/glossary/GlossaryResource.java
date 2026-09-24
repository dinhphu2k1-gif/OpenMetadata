/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.glossary;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.DataDictionaryCreateVersionRequest;
import org.openmetadata.schema.api.data.GlossaryDraftPayload;
import org.openmetadata.schema.api.data.GlossaryDraftUpdateRequest;
import org.openmetadata.schema.api.data.GlossaryWorkflowTransitionRequest;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.glossary.DataDictionaryBootstrap;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository.GlossaryCsv;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.CSVExportResponse;

@Path("/v1/glossaries")
@Tag(
    name = "Glossaries",
    description = "A `Glossary` is collection of hierarchical `GlossaryTerms`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "glossaries",
    order = 6) // Initialize before GlossaryTerm and after Classification and Tags
public class GlossaryResource extends EntityResource<Glossary, GlossaryRepository> {
  public static final String COLLECTION_PATH = "/v1/glossaries/";
  static final String FIELDS = "owners,tags,reviewers,usageCount,termCount,domains,extension";
  private final GlossaryMapper mapper = new GlossaryMapper();
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  public GlossaryResource(Authorizer authorizer, Limits limits) {
    super(Entity.GLOSSARY, authorizer, limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    DataDictionaryBootstrap.initialize();
    versioningService.processPendingOutbox();
  }

  @GET
  @Path("/{id}/working")
  @Operation(
      operationId = "getGlossaryWorkingVersion",
      summary = "Get the working glossary version")
  public Map<String, Object> getWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    GlossaryAuthorizationResolver.Capabilities capabilities =
        capabilities(securityContext, glossary);
    GlossaryAuthorizationResolver.requireViewWorking(capabilities);
    return GlossaryVersionResponses.working(
        versioningService.getWorking(GlossaryVersioningService.GLOSSARY, id));
  }

  @GET
  @Path("/{id}/working/publish-preview")
  @Operation(
      operationId = "getGlossaryPublishPreview",
      summary = "Preview CDEs eligible for publish")
  public GlossaryPublishPreviewResponse getGlossaryPublishPreview(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @DefaultValue("25") @Min(1) @Max(100) @QueryParam("limit") int limit,
      @QueryParam("after") String after) {
    getInternal(uriInfo, securityContext, id, "id", Include.NON_DELETED, null);
    WorkingVersionRecord working =
        versioningService.getWorking(GlossaryVersioningService.GLOSSARY, id);
    GlossaryAuthorizationResolver.requireViewWorking(
        capabilitiesForWorking(securityContext, working));
    GlossaryVersioningService.PublishPreview preview =
        versioningService.publishPreview(id, limit, after);
    return new GlossaryPublishPreviewResponse(
        preview.data(),
        new PublishPreviewPaging(preview.after()),
        preview.termCount(),
        preview.evaluatedAt());
  }

  @POST
  @Path("/{id}/working")
  @Operation(
      operationId = "createGlossaryWorkingVersion",
      summary = "Create a glossary working version")
  public Response createWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid DataDictionaryCreateVersionRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED, null);
    GlossaryAuthorizationResolver.requireCreateVersion(capabilities(securityContext, glossary));
    DataDictionaryResolver.requireDataDictionary(glossary);
    WorkingVersionRecord working =
        versioningService.createWorking(
            GlossaryVersioningService.GLOSSARY,
            id,
            null,
            request.getBusinessVersion(),
            glossary.getVersion(),
            glossary,
            securityContext.getUserPrincipal().getName());
    Map<String, Object> response = GlossaryVersionResponses.working(working);
    response.put("capabilities", capabilitiesForWorking(securityContext, working).asMap());
    return Response.created(
            uriInfo.getBaseUriBuilder().path("v1/glossaries/{id}/working").build(id))
        .entity(response)
        .build();
  }

  @PATCH
  @Path("/{id}/working")
  @Operation(
      operationId = "updateGlossaryWorkingVersion",
      summary = "Update a glossary working version")
  public Map<String, Object> updateWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GlossaryDraftUpdateRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    GlossaryAuthorizationResolver.requireEdit(capabilities(securityContext, glossary));
    WorkingVersionRecord current =
        versioningService.getWorking(GlossaryVersioningService.GLOSSARY, id);
    Map<String, Object> payload = GlossaryVersionResponses.working(current);
    GlossaryDraftPayload changes = request.getPayload();
    payload.put("description", changes.getDescription());
    payload.put("owners", changes.getOwners());
    payload.put("reviewers", changes.getReviewers());
    payload.put("domains", changes.getDomains());
    payload.put("tags", changes.getTags());
    payload.put("extension", changes.getExtension());
    Glossary validated = JsonUtils.readValue(JsonUtils.pojoToJson(payload), Glossary.class);
    validated.setOwners(EntityRepository.validateOwners(validated.getOwners()));
    EntityRepository.validateReviewers(validated.getReviewers());
    validated.setDomains(repository.validateDomainsByRef(validated.getDomains()));
    repository.prepareInternal(validated, true);
    payload = JsonUtils.readValue(JsonUtils.pojoToJson(validated), Map.class);
    WorkingVersionRecord working =
        versioningService.saveWorking(
            GlossaryVersioningService.GLOSSARY,
            id,
            request.getExpectedRevision(),
            glossary.getVersion(),
            payload,
            securityContext.getUserPrincipal().getName());
    return GlossaryVersionResponses.working(working);
  }

  @POST
  @Path("/{id}/working/submit")
  @Operation(
      operationId = "submitGlossaryWorkingVersion",
      summary = "Submit a glossary working version")
  public Map<String, Object> submitWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GlossaryWorkflowTransitionRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    requireExpectedRevision(request);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY,
            id,
            request.getExpectedRevision(),
            EntityStatus.DRAFT,
            EntityStatus.IN_REVIEW,
            securityContext.getUserPrincipal().getName(),
            working ->
                GlossaryAuthorizationResolver.requireSubmit(
                    capabilitiesForWorking(securityContext, working))));
  }

  @POST
  @Path("/{id}/working/reject")
  @Operation(
      operationId = "rejectGlossaryWorkingVersion",
      summary = "Reject a glossary working version")
  public Map<String, Object> rejectWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GlossaryWorkflowTransitionRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    requireExpectedRevision(request);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY,
            id,
            request.getExpectedRevision(),
            EntityStatus.IN_REVIEW,
            EntityStatus.REJECTED,
            securityContext.getUserPrincipal().getName(),
            working ->
                GlossaryAuthorizationResolver.requireReject(
                    capabilitiesForWorking(securityContext, working))));
  }

  @POST
  @Path("/{id}/working/reopen")
  @Operation(
      operationId = "reopenGlossaryWorkingVersion",
      summary = "Reopen a rejected glossary working version")
  public Map<String, Object> reopenWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GlossaryWorkflowTransitionRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    requireExpectedRevision(request);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY,
            id,
            request.getExpectedRevision(),
            EntityStatus.REJECTED,
            EntityStatus.DRAFT,
            securityContext.getUserPrincipal().getName(),
            working ->
                GlossaryAuthorizationResolver.requireEdit(
                    capabilitiesForWorking(securityContext, working))));
  }

  @POST
  @Path("/{id}/working/approve")
  @Operation(
      operationId = "approveGlossaryWorkingVersion",
      summary = "Publish a glossary working version")
  public Map<String, Object> approveWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid GlossaryWorkflowTransitionRequest request) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    requireExpectedRevision(request);
    return GlossaryVersionResponses.published(
        versioningService.publish(
            GlossaryVersioningService.GLOSSARY,
            id,
            request.getExpectedRevision(),
            securityContext.getUserPrincipal().getName(),
            working ->
                GlossaryAuthorizationResolver.requireReview(
                    capabilitiesForWorking(securityContext, working))));
  }

  @GET
  @Path("/{id}/published")
  @Operation(
      operationId = "listPublishedGlossaryVersions",
      summary = "List published glossary versions")
  public List<Map<String, Object>> listPublishedVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    DataDictionaryResolver.requireDataDictionary(
        getInternal(uriInfo, securityContext, id, "id", Include.NON_DELETED, null));
    return versioningService.listPublished(GlossaryVersioningService.GLOSSARY, id).stream()
        .map(GlossaryVersionResponses::published)
        .toList();
  }

  @GET
  @Path("/{id}/published/{businessVersion}")
  @Operation(
      operationId = "getPublishedGlossaryVersion",
      summary = "Get a published glossary business version")
  public Map<String, Object> getPublishedVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("businessVersion") String businessVersion) {
    Glossary glossary =
        DataDictionaryResolver.requireDataDictionary(
            getInternal(uriInfo, securityContext, id, "id", Include.NON_DELETED, null));
    PublishedSnapshotRecord snapshot =
        versioningService.getPublished(
            GlossaryVersioningService.GLOSSARY, id, businessVersion);
    Map<String, Object> response = GlossaryVersionResponses.published(snapshot);
    int termCount = versioningService.listPublishedGlossaryTerms(id, businessVersion).size();
    if (snapshot.archivedAt() == null
        && versioningService.isLatestPublished(
            GlossaryVersioningService.GLOSSARY, id, businessVersion)) {
      if (!isConsumer(securityContext, glossary)) {
        termCount += versioningService.listWorkingTermsByGlossary(id, businessVersion).size();
      }
    }
    response.put("termCount", termCount);
    return response;
  }

  @GET
  @Path("/{id}/published/{businessVersion}/terms")
  @Operation(
      operationId = "listPublishedGlossaryTerms",
      summary = "List exact term revisions in a published glossary")
  public List<Map<String, Object>> listPublishedGlossaryTerms(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("businessVersion") String businessVersion) {
    Glossary glossary =
        DataDictionaryResolver.requireDataDictionary(
            getInternal(uriInfo, securityContext, id, "id", Include.NON_DELETED, null));
    PublishedSnapshotRecord glossarySnapshot =
        versioningService.getPublished(
            GlossaryVersioningService.GLOSSARY, id, businessVersion);
    List<Map<String, Object>> terms =
        new java.util.ArrayList<>(
            versioningService.listPublishedGlossaryTerms(id, businessVersion).stream()
                .map(GlossaryVersionResponses::published)
                .toList());
    if (glossarySnapshot.archivedAt() == null
        && !isConsumer(securityContext, glossary)
        && versioningService.isLatestPublished(
            GlossaryVersioningService.GLOSSARY, id, businessVersion)) {
      terms.addAll(
          versioningService.listWorkingTermsByGlossary(id, businessVersion).stream()
              .map(GlossaryVersionResponses::working)
              .toList());
    }
    return terms;
  }

  @POST
  @Path("/{id}/published/latest/archive")
  @Operation(
      operationId = "archiveLatestPublishedGlossary",
      summary = "Archive the latest published glossary snapshot")
  public Map<String, Object> archiveLatestPublished(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    GlossaryAuthorizationResolver.Capabilities capabilities =
        capabilities(securityContext, glossary);
    if (!capabilities.canArchive()) {
      throw new ForbiddenException("Not authorized to archive the published version");
    }
    return GlossaryVersionResponses.working(
        versioningService.revokeLatestToRejectedWorking(
            GlossaryVersioningService.GLOSSARY, id, securityContext.getUserPrincipal().getName()));
  }

  @GET
  @Path("/{id}/permissions")
  @Operation(
      operationId = "getGlossaryVersionPermissions",
      summary = "Get glossary workflow permissions")
  public Map<String, Boolean> getVersionPermissions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, "owners,reviewers", Include.NON_DELETED, null);
    Map<String, Boolean> permissions = capabilities(securityContext, glossary).asMap();
    permissions.put("isConsumer", isConsumer(securityContext, glossary));
    return permissions;
  }

  private GlossaryAuthorizationResolver.Capabilities capabilities(
      SecurityContext securityContext, Glossary glossary) {
    DataDictionaryResolver.requireDataDictionary(glossary);
    try {
      return withoutCreateVersion(
          capabilitiesForWorking(
              securityContext,
              versioningService.getWorking(GlossaryVersioningService.GLOSSARY, glossary.getId())));
    } catch (NotFoundException ignored) {
      // Published-only identity: evaluate the current representation.
    }
    return capabilitiesForAuthorizationGlossary(securityContext, glossary);
  }

  private GlossaryAuthorizationResolver.Capabilities capabilitiesForWorking(
      SecurityContext securityContext, WorkingVersionRecord working) {
    Glossary payload = JsonUtils.readValue(working.payload(), Glossary.class);
    return capabilitiesForAuthorizationGlossary(securityContext, payload);
  }

  private GlossaryAuthorizationResolver.Capabilities capabilitiesForAuthorizationGlossary(
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

  private static GlossaryAuthorizationResolver.Capabilities withoutCreateVersion(
      GlossaryAuthorizationResolver.Capabilities capabilities) {
    return new GlossaryAuthorizationResolver.Capabilities(
        capabilities.canViewWorking(),
        capabilities.canViewPublished(),
        capabilities.canEditWorking(),
        capabilities.canSubmit(),
        false,
        capabilities.canApprove(),
        capabilities.canReject(),
        capabilities.canArchive());
  }

  private boolean policyAllows(
      SecurityContext securityContext, Glossary glossary, MetadataOperation operation) {
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, operation),
          new ResourceContext<>(entityType, glossary, repository));
      return true;
    } catch (AuthorizationException exception) {
      return false;
    }
  }

  private static void requireExpectedRevision(GlossaryWorkflowTransitionRequest request) {
    if (request == null || request.getExpectedRevision() == null) {
      throw new BadRequestException("expectedRevision is required");
    }
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("reviewers,usageCount,termCount", MetadataOperation.VIEW_BASIC);
    return List.of(
        MetadataOperation.VIEW_WORKING,
        MetadataOperation.EDIT_WORKING,
        MetadataOperation.SUBMIT_WORKING,
        MetadataOperation.CREATE_VERSION,
        MetadataOperation.APPROVE_WORKING,
        MetadataOperation.REJECT_WORKING,
        MetadataOperation.ARCHIVE_PUBLISHED);
  }

  public static class GlossaryList extends ResultList<Glossary> {
    /* Required for serde */
  }

  public record GlossaryPublishPreviewResponse(
      List<GlossaryVersioningService.TermRevision> data,
      PublishPreviewPaging paging,
      int termCount,
      long evaluatedAt) {}

  public record PublishPreviewPaging(String after) {}

  @GET
  @Valid
  @Operation(
      operationId = "listGlossaries",
      summary = "List glossaries",
      description =
          "Get a list of glossaries. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossaries",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryList.class)))
      })
  public ResultList<Glossary> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number glossaries returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of glossaries before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of glossaries after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("exactName", DataDictionaryResolver.DATA_DICTIONARY_NAME);
    ResultList<Glossary> result =
        super.listInternal(
            uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
    boolean consumerOnly =
        !result.getData().isEmpty()
            && isConsumer(
                securityContext,
                repository.get(
                    null,
                    result.getData().get(0).getId(),
                    repository.getFields("owners,reviewers"),
                    Include.NON_DELETED,
                    false));
    if (consumerOnly) {
      Map<UUID, PublishedSnapshotRecord> snapshots =
          versioningService.getLatestPublishedBatch(
              GlossaryVersioningService.GLOSSARY,
              result.getData().stream().map(Glossary::getId).toList());
      List<Glossary> published = new ArrayList<>();
      for (Glossary glossary : result.getData()) {
        PublishedSnapshotRecord snapshot = snapshots.get(glossary.getId());
        if (snapshot != null) {
          published.add(addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), Glossary.class)));
        }
      }
      result.setData(published);
    } else {
      List<UUID> ids = result.getData().stream().map(Glossary::getId).toList();
      Map<UUID, WorkingVersionRecord> workingVersions =
          versioningService.getWorkingBatch(GlossaryVersioningService.GLOSSARY, ids);
      Map<UUID, PublishedSnapshotRecord> publishedVersions =
          versioningService.getLatestPublishedBatch(GlossaryVersioningService.GLOSSARY, ids);
      result.setData(
          result.getData().stream()
              .map(
                  glossary -> {
                    WorkingVersionRecord working = workingVersions.get(glossary.getId());
                    if (working != null) {
                      return JsonUtils.readValue(
                          JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)),
                          Glossary.class);
                    }
                    PublishedSnapshotRecord published = publishedVersions.get(glossary.getId());
                    return published == null
                        ? glossary
                        : JsonUtils.readValue(published.payload(), Glossary.class);
                  })
              .toList());
    }
    return result;
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getGlossaryByID",
      summary = "Get a glossary by Id",
      description = "Get a glossary by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "404", description = "Glossary for instance {id} is not found")
      })
  public Glossary get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    Glossary glossary =
        getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
    DataDictionaryResolver.requireDataDictionary(glossary);
    if (isConsumer(securityContext, glossary)) {
      PublishedSnapshotRecord snapshot =
          versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY, id);
      return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), Glossary.class));
    }
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY, id);
      return addHref(
          uriInfo,
          JsonUtils.readValue(
              JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)), Glossary.class));
    } catch (NotFoundException ignored) {
      try {
        PublishedSnapshotRecord snapshot =
            versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY, id);
        return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), Glossary.class));
      } catch (NotFoundException noPublishedSnapshot) {
        // Before the first working/published version, return the identity projection.
      }
    }
    return glossary;
  }

  @GET
  @Path("/{id}/published/latest")
  @Operation(operationId = "getLatestPublishedGlossary", summary = "Get latest approved glossary")
  public Glossary getLatestPublished(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    DataDictionaryResolver.requireDataDictionary(
        getInternal(uriInfo, securityContext, id, "id", Include.NON_DELETED, null));
    PublishedSnapshotRecord snapshot =
        versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY, id);
    Glossary published = JsonUtils.readValue(snapshot.payload(), Glossary.class);
    return addHref(uriInfo, published);
  }

  private boolean isConsumer(SecurityContext securityContext, Glossary glossary) {
    Glossary authorizationGlossary =
        repository.get(
            null,
            glossary.getId(),
            repository.getFields("owners,reviewers"),
            Include.NON_DELETED,
            false);
    GlossaryAuthorizationResolver.Capabilities effective =
        capabilities(securityContext, authorizationGlossary);
    return effective.canViewPublished() && !effective.canViewWorking();
  }

  private boolean isConsumer(SecurityContext securityContext, UUID id) {
    return isConsumer(securityContext, requireDataDictionary(id));
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getGlossaryByFQN",
      summary = "Get a glossary by name",
      description = "Get a glossary by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary for instance {name} is not found")
      })
  public Glossary getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    Glossary glossary =
        DataDictionaryResolver.requireDataDictionary(
            getByNameInternal(uriInfo, securityContext, name, fieldsParam, include));
    if (isConsumer(securityContext, glossary)) {
      PublishedSnapshotRecord snapshot =
          versioningService.getLatestPublished(
              GlossaryVersioningService.GLOSSARY, glossary.getId());
      return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), Glossary.class));
    }
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY, glossary.getId());
      return addHref(
          uriInfo,
          JsonUtils.readValue(
              JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)), Glossary.class));
    } catch (NotFoundException ignored) {
      try {
        PublishedSnapshotRecord snapshot =
            versioningService.getLatestPublished(
                GlossaryVersioningService.GLOSSARY, glossary.getId());
        return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), Glossary.class));
      } catch (NotFoundException noPublishedSnapshot) {
        // Before the first working/published version, return the identity projection.
      }
    }
    return glossary;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllGlossaryVersion",
      summary = "List glossary versions",
      description = "Get a list of all the versions of a glossary identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireDataDictionary(id);
    if (isConsumer(securityContext, id)) {
      throw new ForbiddenException(
          "Native metadata history is not available to consumers; use /published");
    }
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificGlossaryVersion",
      summary = "Get a version of the glossaries",
      description = "Get a version of the glossary by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "glossaries",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary for instance {id} and version {version} is not found")
      })
  public Glossary getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "glossary version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    requireDataDictionary(id);
    if (isConsumer(securityContext, id)) {
      throw new ForbiddenException(
          "Native metadata history is not available to consumers; use /published");
    }
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createGlossary",
      summary = "Create a glossary",
      description = "Create a new glossary.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossary create) {
    DataDictionaryResolver.requireDataDictionaryName(create.getName());
    Glossary glossary = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, glossary);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchGlossary",
      summary = "Update a glossary",
      description = "Update an existing glossary using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    throw new BadRequestException(
        "Direct glossary patch is disabled; update the glossary working version");
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchGlossary",
      summary = "Update a glossary using name.",
      description = "Update an existing glossary using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    throw new BadRequestException(
        "Direct glossary patch is disabled; update the glossary working version");
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateGlossary",
      summary = "Create or update a glossary",
      description = "Create a new glossary, if it does not exist or update an existing glossary.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossary create) {
    throw new BadRequestException(
        "Glossary upsert is disabled; create with POST and edit through a working version");
  }

  @PUT
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForEntity",
      summary = "Update Vote for a Entity",
      description = "Update vote for a Entity",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    requireDataDictionary(id);
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteGlossary",
      summary = "Delete a glossary by Id",
      description = "Delete a glossary by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "glossary for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireDataDictionary(id);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY, id);
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteGlossaryAsync",
      summary = "Asynchronously delete a glossary by Id",
      description = "Asynchronously delete a glossary by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "glossary for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the glossary", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireDataDictionary(id);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY, id);
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteGlossaryByName",
      summary = "Delete a glossary by name",
      description = "Delete a glossary by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossary for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    Glossary glossary =
        getByNameInternal(uriInfo, securityContext, name, "id", Include.NON_DELETED);
    DataDictionaryResolver.requireDataDictionary(glossary);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY, glossary.getId());
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted glossary",
      description = "Restore a soft deleted Glossary.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Glossary ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Glossary.class)))
      })
  public Response restoreGlossary(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    requireDataDictionary(restore.getId());
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @GET
  @Path("/documentation/csv")
  @Valid
  @Operation(operationId = "getCsvDocumentation", summary = "Get CSV documentation")
  public String getCsvDocumentation(@Context SecurityContext securityContext) {
    return JsonUtils.pojoToJson(GlossaryCsv.DOCUMENTATION);
  }

  @GET
  @Path("/name/{name}/exportAsync")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportGlossary",
      summary = "Export glossary in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    DataDictionaryResolver.requireDataDictionaryName(name);
    return exportCsvInternalAsync(securityContext, name, false);
  }

  @GET
  @Path("/name/{name}/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportGlossary",
      summary = "Export glossary in CSV format",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name)
      throws IOException {
    DataDictionaryResolver.requireDataDictionaryName(name);
    return exportCsvInternal(securityContext, name, false);
  }

  @PUT
  @Path("/name/{name}/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "importGlossary",
      summary = "Import glossary terms from CSV to create, and update glossary terms",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public CsvImportResult importCsv(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun,
      String csv)
      throws IOException {
    DataDictionaryResolver.requireDataDictionaryName(name);
    if (!dryRun) {
      throw new BadRequestException(
          "Direct CSV writes are disabled; import through glossary working-version APIs");
    }
    return importCsvInternal(uriInfo, securityContext, name, csv, dryRun, false);
  }

  @PUT
  @Path("/name/{name}/importAsync")
  @Consumes(MediaType.TEXT_PLAIN)
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importGlossaryAsync",
      summary = "Import glossary in CSV format asynchronously",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CsvImportResult.class)))
      })
  public Response importCsvAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @RequestBody(description = "CSV data to import", required = true) String csv,
      @Parameter(description = "Dry run the import", schema = @Schema(type = "boolean"))
          @QueryParam("dryRun")
          @DefaultValue("true")
          boolean dryRun) {
    DataDictionaryResolver.requireDataDictionaryName(name);
    if (!dryRun) {
      throw new BadRequestException(
          "Direct CSV writes are disabled; import through glossary working-version APIs");
    }
    return importCsvInternalAsync(uriInfo, securityContext, name, csv, dryRun, false);
  }

  private Glossary requireDataDictionary(UUID id) {
    return DataDictionaryResolver.requireDataDictionary(
        repository.get(null, id, repository.getFields("id,name"), Include.NON_DELETED, false));
  }
}
