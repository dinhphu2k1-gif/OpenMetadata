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

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
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
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
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
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CdeCreateVersionRequest;
import org.openmetadata.schema.api.data.CdeDraftUpdateRequest;
import org.openmetadata.schema.api.data.CdeWorkflowTransitionRequest;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.GlossaryWorkingVersionRequest;
import org.openmetadata.schema.api.data.LoadGlossary;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.versioning.CdeBusinessVersionSearchService;
import org.openmetadata.service.glossary.versioning.CdeBusinessVersionSearchService.Criteria;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter;
import org.openmetadata.service.glossary.versioning.CdeExcelExporter.ExportedWorkbook;
import org.openmetadata.service.glossary.versioning.CdeFlatListService;
import org.openmetadata.service.glossary.versioning.CdeFlatListService.Candidates;
import org.openmetadata.service.glossary.versioning.CdeFlatListService.Scope;
import org.openmetadata.service.glossary.versioning.CdeFlatListService.ScopeType;
import org.openmetadata.service.glossary.versioning.CdeImportService;
import org.openmetadata.service.glossary.versioning.CdeImportService.PlannedRow;
import org.openmetadata.service.glossary.versioning.CdeImportService.RowData;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.GlossaryBusinessVersion;
import org.openmetadata.service.util.MoveGlossaryTermResponse;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;

@Slf4j
@Path("/v1/glossaryTerms")
@Tag(
    name = "Glossaries",
    description = "A `Glossary` is collection of hierarchical `GlossaryTerms`.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(
    name = "glossaryTerms",
    order = 7) // Initialized after Glossary, Classification, and Tags
public class GlossaryTermResource extends EntityResource<GlossaryTerm, GlossaryTermRepository> {
  private final GlossaryTermMapper mapper = new GlossaryTermMapper();
  private final GlossaryMapper glossaryMapper = new GlossaryMapper();
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();
  private final CdeFlatListService cdeFlatListService = new CdeFlatListService();
  private final CdeBusinessVersionSearchService cdeSearchService =
      new CdeBusinessVersionSearchService();
  private final CdeImportService cdeImportService = new CdeImportService();
  public static final String COLLECTION_PATH = "/v1/glossaryTerms/";
  static final String FIELDS =
      "children,relatedTerms,reviewers,owners,tags,usageCount,domains,extension,childrenCount";
  // 100 keeps the query-string-encoded ids list (~37 chars per UUID +
  // separators) well below Jetty's default 8 KB request-header limit
  // and matches the client's BATCH_SIZE in useOntologyExplorer.ts.
  private static final int MAX_BATCH_BY_IDS = 100;
  private static final DateTimeFormatter CDE_EXPORT_TIMESTAMP =
      DateTimeFormatter.ofPattern("yyyyMMdd_HHmm");

  @GET
  @Path("/import/template")
  @Produces(CdeImportService.XLSX_MEDIA_TYPE)
  @Operation(operationId = "downloadCdeImportTemplate", summary = "Download the CDE XLSX import template")
  public Response downloadCdeImportTemplate(@Context SecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.CREATE),
        getResourceContext());
    return Response.ok(cdeImportService.template(), CdeImportService.XLSX_MEDIA_TYPE)
        .header("Content-Disposition", "attachment; filename=\"Agribank_CDE_Import_Template.xlsx\"")
        .build();
  }

  @POST
  @Path("/import/preview")
  @Consumes(MediaType.MULTIPART_FORM_DATA)
  @Operation(operationId = "previewCdeImport", summary = "Validate and preview an atomic CDE import")
  public CdeImportService.Preview previewCdeImport(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String requestedParentBusinessVersion,
      @NotNull @QueryParam("existingCodePolicy") String requestedExistingCodePolicy,
      @FormDataParam("file") InputStream input,
      @FormDataParam("file") FormDataContentDisposition fileDetail) {
    CdeImportService.ExistingCodePolicy existingCodePolicy =
        CdeImportService.ExistingCodePolicy.from(requestedExistingCodePolicy);
    ImportScope scope = authorizeImportScope(securityContext, glossaryId, requestedParentBusinessVersion);
    Map<String, Map<String, Object>> existing = new LinkedHashMap<>();
    for (Map<String, Object> row : loadAuthorizedCdeFlatRows(
        securityContext, glossaryId.toString(), scope.parentBusinessVersion()).rows()) {
      String normalized = CdeImportService.normalizeName(String.valueOf(row.get("name")));
      Map<String, Object> previous = existing.get(normalized);
      if (previous == null || "working".equals(row.get("recordType"))) existing.put(normalized, row);
    }
    long contentLength = fileDetail == null ? -1 : fileDetail.getSize();
    String actor = securityContext.getUserPrincipal().getName();
    DisplayNameReferenceResolver referenceResolver = new DisplayNameReferenceResolver();
    return cdeImportService.preview(
        input,
        contentLength,
        actor,
        glossaryId,
        scope.parentBusinessVersion(),
        existingCodePolicy,
        row -> planImportRow(
            row,
            scope,
            existing.get(CdeImportService.normalizeName(row.value(0))),
            existingCodePolicy,
            referenceResolver));
  }

  @POST
  @Path("/import/{importSessionId}/commit")
  @Operation(operationId = "commitCdeImport", summary = "Commit a validated CDE import atomically")
  public Map<String, Object> commitCdeImport(
      @Context SecurityContext securityContext,
      @PathParam("importSessionId") UUID importSessionId) {
    String actor = securityContext.getUserPrincipal().getName();
    String jobId = importSessionId.toString();
    WebsocketNotificationHandler.sendCdeImportNotification(
        jobId, securityContext, "STARTED", 0, null,
        "Đang chuẩn bị giao dịch import CDE", null);
    try {
      Map<String, Object> result = cdeImportService.commit(
          importSessionId,
          actor,
          session -> {
            ImportScope scope = authorizeImportScope(
                securityContext, session.glossaryId(), session.parentBusinessVersion());
            for (PlannedRow row : session.rows()) {
              if (!"SKIP".equals(row.action())) authorizeImportRow(securityContext, row);
            }
            List<WorkingVersionRecord> committed = repository.commitImport(
                scope.glossary().getId(), scope.parentBusinessVersion(), session.rows(), actor,
                (processed, total) -> {
                  try {
                    WebsocketNotificationHandler.sendCdeImportNotification(
                        jobId, securityContext, "IN_PROGRESS", processed, total,
                        "Đã xử lý " + processed + "/" + total + " bản ghi; đang chờ commit", null);
                  } catch (RuntimeException notificationFailure) {
                    LOG.warn(
                        "Unable to publish CDE import progress importSessionId={} processed={} total={}",
                        importSessionId, processed, total, notificationFailure);
                  }
                });
            LOG.info(
                "CDE import committed actor={} importSessionId={} glossaryId={} parentBusinessVersion={} rows={} fileHash={}",
                actor, importSessionId, session.glossaryId(), session.parentBusinessVersion(),
                committed.size(), session.fileHash());
            return Map.of(
                "importSessionId", importSessionId,
                "committed", committed.size(),
                "skipped", session.rows().stream().filter(row -> "SKIP".equals(row.action())).count(),
                "parentBusinessVersion", session.parentBusinessVersion());
          });
      WebsocketNotificationHandler.sendCdeImportNotification(
          jobId, securityContext, "COMPLETED", 1, 1,
          "Import CDE đã commit thành công", null);
      return result;
    } catch (RuntimeException exception) {
      WebsocketNotificationHandler.sendCdeImportNotification(
          jobId, securityContext, "FAILED", null, null,
          "Import CDE thất bại và toàn bộ thay đổi đã được rollback",
          "Import CDE thất bại");
      throw exception;
    }
  }

  @Override
  public GlossaryTerm addHref(UriInfo uriInfo, GlossaryTerm term) {
    super.addHref(uriInfo, term);
    Entity.withHref(uriInfo, term.getGlossary());
    Entity.withHref(uriInfo, term.getParent());
    if (term.getRelatedTerms() != null) {
      for (TermRelation tr : term.getRelatedTerms()) {
        Entity.withHref(uriInfo, tr.getTerm());
      }
    }
    return term;
  }

  public GlossaryTermResource(Authorizer authorizer, Limits limits) {
    super(Entity.GLOSSARY_TERM, authorizer, limits);
  }

  @GET
  @Path("/export")
  @Produces(CdeExcelExporter.XLSX_MEDIA_TYPE)
  @Operation(
      operationId = "exportDataDictionaryVersion",
      summary = "Export one Data Dictionary version as Excel")
  public Response exportDataDictionaryVersion(
      @Context SecurityContext securityContext,
      @NotNull @QueryParam("glossary") UUID glossaryId,
      @NotNull @QueryParam("parentBusinessVersion") String requestedParentBusinessVersion) {
    AuthorizedFlatRows authorized =
        loadAuthorizedCdeFlatRows(
            securityContext,
            glossaryId == null ? null : glossaryId.toString(),
            requestedParentBusinessVersion);
    ExportedWorkbook workbook = null;
    try {
      workbook = CdeExcelExporter.write(authorized.rows(), authorized.parentBusinessVersion());
      java.nio.file.Path file = workbook.path();
      file.toFile().deleteOnExit();
      long contentLength = Files.size(file);
      String filename =
          "Agribank_CDE_Danh_Tu_Dien_Du_Lieu_v"
              + authorized.parentBusinessVersion()
              + "_"
              + LocalDateTime.now().format(CDE_EXPORT_TIMESTAMP)
              + ".xlsx";
      int rowCount = workbook.rowCount();
      StreamingOutput stream =
          output -> {
            try {
              Files.copy(file, output);
            } finally {
              Files.deleteIfExists(file);
            }
          };
      LOG.info(
          "CDE Excel export authorized actor={} glossaryId={} parentBusinessVersion={} rows={}",
          securityContext.getUserPrincipal().getName(),
          glossaryId,
          authorized.parentBusinessVersion(),
          rowCount);
      return Response.ok(stream, CdeExcelExporter.XLSX_MEDIA_TYPE)
          .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
          .header("Content-Length", contentLength)
          .build();
    } catch (IOException exception) {
      if (workbook != null) {
        try {
          Files.deleteIfExists(workbook.path());
        } catch (IOException cleanupException) {
          exception.addSuppressed(cleanupException);
        }
      }
      LOG.error(
          "CDE Excel export failed actor={} glossaryId={} parentBusinessVersion={}",
          securityContext.getUserPrincipal().getName(),
          glossaryId,
          requestedParentBusinessVersion,
          exception);
      throw new jakarta.ws.rs.InternalServerErrorException(
          "Unable to export Data Dictionary", exception);
    }
  }

  @GET
  @Path("/{id}/working")
  @Operation(
      operationId = "getGlossaryTermWorkingVersion",
      summary = "Get the working glossary term version")
  public Map<String, Object> getWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    GlossaryAuthorizationResolver.requireViewWorking(capabilities(securityContext, term));
    return GlossaryVersionResponses.working(
        versioningService.getWorking(
            GlossaryVersioningService.GLOSSARY_TERM, id, parentBusinessVersion));
  }

  @POST
  @Path("/{id}/working")
  @Operation(
      operationId = "createGlossaryTermWorkingVersion",
      summary = "Create a glossary term working version")
  public Map<String, Object> createWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @Valid CdeCreateVersionRequest request) {
    GlossaryTerm term = createVersionEntity(uriInfo, securityContext, id);
    requireCdeIdentityScope(term, request.getParentBusinessVersion());
    GlossaryAuthorizationResolver.requireCreateVersion(capabilities(securityContext, term));
    WorkingVersionRecord working =
        versioningService.createNextTermWorking(
            id,
            term.getGlossary() == null ? null : term.getGlossary().getId(),
            request.getBusinessVersion(),
            request.getParentBusinessVersion(),
            term.getVersion(),
            term,
            securityContext.getUserPrincipal().getName(),
            latest -> {
              GlossaryTerm published = JsonUtils.readValue(latest.payload(), GlossaryTerm.class);
              GlossaryAuthorizationResolver.requireCreateVersion(
                  capabilitiesForAuthorizationTerm(securityContext, published));
            });
    Map<String, Object> response = GlossaryVersionResponses.working(working);
    response.put(
        "capabilities",
        withoutCreateVersion(capabilitiesForWorking(securityContext, working)).asMap());
    return response;
  }

  @PATCH
  @Path("/{id}/working")
  @Operation(
      operationId = "updateGlossaryTermWorkingVersion",
      summary = "Update a glossary term working version")
  public Map<String, Object> updateWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @Valid CdeDraftUpdateRequest request) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    GlossaryAuthorizationResolver.requireEdit(capabilities(securityContext, term));
    GlossaryTerm payload = mutableDraftPayload(term, request);
    repository.prepareInternal(payload, true);
    return GlossaryVersionResponses.working(
        versioningService.saveWorking(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            parentBusinessVersion,
            request.getExpectedRevision(),
            term.getVersion(),
            payload,
            securityContext.getUserPrincipal().getName()));
  }

  @POST
  @Path("/{id}/working/submit")
  @Operation(
      operationId = "submitGlossaryTermWorkingVersion",
      summary = "Submit a glossary term working version")
  public Map<String, Object> submitWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @NotNull @Valid CdeWorkflowTransitionRequest request) {
    versionEntity(uriInfo, securityContext, id);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            parentBusinessVersion,
            request.getExpectedRevision(),
            EntityStatus.DRAFT,
            EntityStatus.IN_REVIEW,
            securityContext.getUserPrincipal().getName(),
            working -> authorizeAndValidateSubmit(securityContext, working)));
  }

  @POST
  @Path("/{id}/working/reject")
  @Operation(
      operationId = "rejectGlossaryTermWorkingVersion",
      summary = "Reject a glossary term working version")
  public Map<String, Object> rejectWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @NotNull @Valid CdeWorkflowTransitionRequest request) {
    versionEntity(uriInfo, securityContext, id);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            parentBusinessVersion,
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
      operationId = "reopenGlossaryTermWorkingVersion",
      summary = "Reopen a rejected glossary term working version")
  public Map<String, Object> reopenWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @NotNull @Valid CdeWorkflowTransitionRequest request) {
    versionEntity(uriInfo, securityContext, id);
    return GlossaryVersionResponses.working(
        versioningService.transition(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            parentBusinessVersion,
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
      operationId = "approveGlossaryTermWorkingVersion",
      summary = "Publish a glossary term working version")
  public Map<String, Object> approveWorkingVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @NotNull @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @NotNull @Valid CdeWorkflowTransitionRequest request) {
    versionEntity(uriInfo, securityContext, id);
    return GlossaryVersionResponses.published(
        versioningService.publish(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            parentBusinessVersion,
            request.getExpectedRevision(),
            securityContext.getUserPrincipal().getName(),
            working -> authorizeAndValidateApprove(securityContext, working)));
  }

  @GET
  @Path("/{id}/published")
  @Operation(
      operationId = "listPublishedGlossaryTermVersions",
      summary = "List published glossary term versions")
  public List<Map<String, Object>> listPublishedVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("parentBusinessVersion") String parentBusinessVersion) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    if (term.getParentBusinessVersion() != null) {
      requireCdeIdentityScopeNotFound(term, parentBusinessVersion);
      authorizeCdeDetailScope(securityContext, term, parentBusinessVersion);
    }
    return versioningService.listPublished(GlossaryVersioningService.GLOSSARY_TERM, id).stream()
        .filter(
            record ->
                parentBusinessVersion == null
                    || parentBusinessVersion.equals(record.parentBusinessVersion()))
        .map(GlossaryVersionResponses::published)
        .toList();
  }

  @GET
  @Path("/{id}/published/{businessVersion}")
  @Operation(
      operationId = "getPublishedGlossaryTermVersion",
      summary = "Get a published glossary term business version")
  public Map<String, Object> getPublishedVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("businessVersion") String businessVersion,
      @QueryParam("parentBusinessVersion") String parentBusinessVersion) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    if (term.getParentBusinessVersion() != null) {
      requireCdeIdentityScopeNotFound(term, parentBusinessVersion);
      requireCdeVersionScopeNotFound(businessVersion, parentBusinessVersion);
      authorizeCdeDetailScope(securityContext, term, parentBusinessVersion);
    }
    PublishedSnapshotRecord snapshot =
        versioningService.getPublished(
            GlossaryVersioningService.GLOSSARY_TERM, id, businessVersion);
    if (parentBusinessVersion != null
        && !parentBusinessVersion.equals(snapshot.parentBusinessVersion())) {
      throw new NotFoundException("CDE business version was not found in the requested scope");
    }
    return GlossaryVersionResponses.published(snapshot);
  }

  @POST
  @Path("/{id}/published/latest/archive")
  @Operation(
      operationId = "archiveLatestPublishedGlossaryTerm",
      summary = "Archive the latest published glossary term snapshot")
  public Map<String, Object> archiveLatestPublished(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    GlossaryAuthorizationResolver.Capabilities capabilities = capabilities(securityContext, term);
    if (!capabilities.canArchive()) {
      throw new AuthorizationException("Not authorized to archive the published version");
    }
    return GlossaryVersionResponses.working(
        versioningService.revokeLatestToRejectedWorking(
            GlossaryVersioningService.GLOSSARY_TERM,
            id,
            securityContext.getUserPrincipal().getName()));
  }

  @GET
  @Path("/{id}/permissions")
  @Operation(
      operationId = "getGlossaryTermVersionPermissions",
      summary = "Get glossary term workflow permissions")
  public Map<String, Boolean> getVersionPermissions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    GlossaryTerm term = versionEntity(uriInfo, securityContext, id);
    Map<String, Boolean> permissions = capabilities(securityContext, term).asMap();
    permissions.put("canImportCdeDrafts", permissions.get("canEditWorking"));
    permissions.put("isConsumer", isConsumer(securityContext, term));
    return permissions;
  }

  private GlossaryTerm versionEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    return DataDictionaryResolver.requireCde(
        getInternal(uriInfo, securityContext, id, FIELDS + ",glossary", Include.NON_DELETED, null));
  }

  private GlossaryTerm createVersionEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    try {
      return versionEntity(uriInfo, securityContext, id);
    } catch (BadRequestException exception) {
      throw new NotFoundException("CDE was not found in the Data Dictionary");
    }
  }

  private GlossaryAuthorizationResolver.Capabilities capabilities(
      SecurityContext securityContext, GlossaryTerm term) {
    GlossaryTerm authorizationTerm = term;
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY_TERM, term.getId());
      return withoutCreateVersion(capabilitiesForWorking(securityContext, working));
    } catch (NotFoundException ignored) {
      // Published-only identities retain their persisted authorization relationships.
    }
    try {
      PublishedSnapshotRecord latest =
          versioningService.getLatestPublished(
              GlossaryVersioningService.GLOSSARY_TERM, term.getId());
      GlossaryTerm publishedAuthorizationTerm =
          JsonUtils.readValue(latest.payload(), GlossaryTerm.class);
      return capabilitiesForAuthorizationTerm(securityContext, publishedAuthorizationTerm);
    } catch (NotFoundException ignored) {
      return withoutCreateVersion(
          capabilitiesForAuthorizationTerm(securityContext, authorizationTerm));
    }
  }

  private GlossaryAuthorizationResolver.Capabilities capabilitiesForAuthorizationTerm(
      SecurityContext securityContext, GlossaryTerm authorizationTerm) {
    return GlossaryAuthorizationResolver.fromPolicy(
        policyAllows(securityContext, authorizationTerm, MetadataOperation.VIEW_WORKING),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.EDIT_WORKING),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.SUBMIT_WORKING),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.CREATE_VERSION),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.APPROVE_WORKING),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.REJECT_WORKING),
        policyAllows(securityContext, authorizationTerm, MetadataOperation.ARCHIVE_PUBLISHED));
  }

  private GlossaryAuthorizationResolver.Capabilities capabilitiesForWorking(
      SecurityContext securityContext, WorkingVersionRecord working) {
    GlossaryTerm payload = JsonUtils.readValue(working.payload(), GlossaryTerm.class);
    GlossaryAuthorizationResolver.Capabilities capabilities =
        capabilitiesForAuthorizationTerm(securityContext, payload);
    if (!securityContext.getUserPrincipal().getName().equals(working.createdBy())
        || (!capabilities.canEditWorking() && !capabilities.canSubmit())) {
      return capabilities;
    }
    return new GlossaryAuthorizationResolver.Capabilities(
        true,
        capabilities.canViewPublished(),
        capabilities.canEditWorking(),
        capabilities.canSubmit(),
        capabilities.canCreateVersion(),
        capabilities.canApprove(),
        capabilities.canReject(),
        capabilities.canArchive());
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

  private void authorizeAndValidateSubmit(
      SecurityContext securityContext, WorkingVersionRecord working) {
    GlossaryTerm payload = JsonUtils.readValue(working.payload(), GlossaryTerm.class);
    GlossaryAuthorizationResolver.requireSubmit(capabilitiesForWorking(securityContext, working));
    DataDictionaryResolver.requireCdePayload(payload, working.glossaryId());
    repository.prepareInternal(payload, true);
  }

  private void authorizeAndValidateApprove(
      SecurityContext securityContext, WorkingVersionRecord working) {
    GlossaryTerm payload = JsonUtils.readValue(working.payload(), GlossaryTerm.class);
    GlossaryAuthorizationResolver.requireReview(
        capabilitiesForAuthorizationTerm(securityContext, payload));
    DataDictionaryResolver.requireCdePayload(payload, working.glossaryId());
    if (payload.getParent() != null) {
      throw new BadRequestException("A CDE must be a direct child of the Data Dictionary");
    }
    EntityRepository.validateOwners(payload.getOwners());
    EntityRepository.validateReviewers(payload.getReviewers());
    repository.validateDomainsByRef(payload.getDomains());
    repository.prepareInternal(payload, true);
  }

  private boolean policyAllows(
      SecurityContext securityContext, GlossaryTerm term, MetadataOperation operation) {
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, operation),
          new ResourceContext<>(entityType, term, repository));
      return true;
    } catch (AuthorizationException exception) {
      return false;
    }
  }

  private static void requireExpectedRevision(GlossaryWorkingVersionRequest request) {
    if (request == null || request.getExpectedRevision() == null) {
      throw new BadRequestException("expectedRevision is required");
    }
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("children,relatedTerms,reviewers,usageCount", MetadataOperation.VIEW_BASIC);
    return List.of(
        MetadataOperation.VIEW_WORKING,
        MetadataOperation.EDIT_WORKING,
        MetadataOperation.SUBMIT_WORKING,
        MetadataOperation.CREATE_VERSION,
        MetadataOperation.APPROVE_WORKING,
        MetadataOperation.REJECT_WORKING,
        MetadataOperation.ARCHIVE_PUBLISHED);
  }

  public static class GlossaryTermList extends ResultList<GlossaryTerm> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    super.initialize(config);
    // Load glossaries provided by OpenMetadata
    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    List<LoadGlossary> loadGlossaries =
        EntityRepository.getEntitiesFromSeedData(
            GLOSSARY, ".*json/data/glossary/.*Glossary\\.json$", LoadGlossary.class);
    for (LoadGlossary loadGlossary : loadGlossaries) {
      Glossary glossary =
          glossaryMapper.createToEntity(loadGlossary.getCreateGlossary(), ADMIN_USER_NAME);
      if (!DataDictionaryResolver.isDataDictionary(glossary)) {
        continue;
      }
      glossary.setFullyQualifiedName(glossary.getName());
      glossaryRepository.initializeEntity(glossary);

      List<GlossaryTerm> termsToCreate = new ArrayList<>();
      for (CreateGlossaryTerm createTerm : loadGlossary.getCreateTerms()) {
        createTerm.withGlossary(glossary.getName());
        createTerm.withProvider(glossary.getProvider());
        GlossaryTerm term = mapper.createToEntity(createTerm, ADMIN_USER_NAME);
        repository.setFullyQualifiedName(term); // FQN required for ordering tags based on hierarchy
        termsToCreate.add(term);
      }

      // Sort tags based on tag hierarchy
      EntityUtil.sortByFQN(termsToCreate);

      for (GlossaryTerm term : termsToCreate) {
        repository.initializeEntity(term);
      }
    }
  }

  @GET
  @Valid
  @Operation(
      operationId = "listGlossaryTerm",
      summary = "List glossary terms",
      description =
          "Get a list of glossary terms. Use `fields` parameter to get only necessary fields. "
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTermList.class)))
      })
  public Object list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "List glossary terms filtered by glossary ID or fully qualified name given in `glossary` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("glossary")
          String glossaryIdParam,
      @Parameter(
              description =
                  "List glossary terms filtered by children of glossary term identified by Id given in "
                      + "`parent` parameter.",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("parent")
          UUID parentTermParam,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description =
                  "Limit the number glossary terms returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of glossary terms before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of glossary terms after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include,
      @Parameter(
              description =
                  "List glossary terms filtered to retrieve the first level/immediate children of the glossary term "
                      + "`directChildrenOf` parameter.",
              schema = @Schema(type = "string"))
          @QueryParam("directChildrenOf")
          String parentTermFQNParam,
      @Parameter(
              description =
                  "Filter by entity status (comma-separated: Approved,Draft,In Review,Rejected,Deprecated,Unprocessed)")
          @QueryParam("entityStatus")
          String entityStatus,
      @Parameter(description = "Filter CDE representations by Data Dictionary business version")
          @QueryParam("parentBusinessVersion")
          String parentBusinessVersion,
      @Parameter(description = "Offset for Data Dictionary flat-list pagination")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam) {
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);

    if (parentBusinessVersion != null) {
      return listCdeFlatRows(
          securityContext,
          glossaryIdParam,
          parentBusinessVersion,
          limitParam,
          offsetParam);
    }

    ResourceContextInterface glossaryResourceContext = new ResourceContext<>(GLOSSARY);
    OperationContext glossaryOperationContext =
        new OperationContext(GLOSSARY, getViewOperations(fields));
    OperationContext glossaryTermOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface glossaryTermResourceContext = new ResourceContext<>(GLOSSARY_TERM);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(glossaryOperationContext, glossaryResourceContext),
            new AuthRequest(glossaryTermOperationContext, glossaryTermResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    // Filter by glossary
    String fqn = null;
    EntityReference glossary = null;
    if (glossaryIdParam != null) {
      glossary = repository.getGlossary(glossaryIdParam);
      DataDictionaryResolver.resolveDataDictionary(glossary);
      fqn = glossary.getFullyQualifiedName();
    } else {
      glossary = repository.getGlossary(DataDictionaryResolver.DATA_DICTIONARY_NAME);
      DataDictionaryResolver.resolveDataDictionary(glossary);
      fqn = glossary.getFullyQualifiedName();
    }

    // Filter by glossary parent term
    if (parentTermParam != null) {
      GlossaryTerm parentTerm =
          repository.get(null, parentTermParam, repository.getFields("parent"));
      DataDictionaryResolver.requireCde(parentTerm);
      fqn = parentTerm.getFullyQualifiedName();

      // Ensure parent glossary term belongs to the glossary
      if ((glossary != null) && (!parentTerm.getGlossary().getId().equals(glossary.getId()))) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.glossaryTermMismatch(
                parentTermParam.toString(), glossaryIdParam));
      }
    }
    if (parentTermFQNParam != null) {
      DataDictionaryResolver.requireCde(
          repository.getByName(
              null,
              parentTermFQNParam,
              repository.getFields("glossary"),
              Include.NON_DELETED,
              false));
    }
    String effectiveEntityStatus = entityStatus;
    boolean publishedOnly =
        "Approved".equals(effectiveEntityStatus) || "Published".equals(effectiveEntityStatus);
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("parent", fqn)
            .addQueryParam("directChildrenOf", parentTermFQNParam)
            .addQueryParam("entityStatus", publishedOnly ? null : effectiveEntityStatus)
            .addQueryParam(
                "publishedSnapshotEntityType",
                publishedOnly ? GlossaryVersioningService.GLOSSARY_TERM : null);

    ResultList<GlossaryTerm> terms;
    if (before != null) { // Reverse paging
      terms =
          repository.listBefore(
              uriInfo, fields, filter, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      terms = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    if (publishedOnly && terms != null && terms.getData() != null) {
      Map<UUID, PublishedSnapshotRecord> snapshots =
          versioningService.getLatestPublishedBatch(
              GlossaryVersioningService.GLOSSARY_TERM,
              terms.getData().stream().map(GlossaryTerm::getId).toList());
      List<GlossaryTerm> resolved = new ArrayList<>();
      for (GlossaryTerm t : terms.getData()) {
        PublishedSnapshotRecord snapshot = snapshots.get(t.getId());
        if (snapshot != null) {
          resolved.add(JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
        }
      }
      terms.setData(resolved);
    } else if (terms != null && terms.getData() != null) {
      List<GlossaryTerm> resolved =
          glossaryIdParam == null
              ? resolveRepresentations(securityContext, terms.getData())
              : resolveAuthoringRepresentations(
                  securityContext, terms.getData(), parentBusinessVersion);
      terms.setData(resolved);
      if (glossaryIdParam != null && terms.getPaging() != null) {
        if (resolved.isEmpty()) {
          terms.setPaging(new org.openmetadata.schema.type.Paging().withTotal(0));
        } else {
          terms.getPaging().withTotal(resolved.size());
        }
      }
    }
    return addHref(uriInfo, terms);
  }

  @GET
  @Path("/search")
  @Operation(
      operationId = "searchGlossaryTerms",
      summary = "Search glossary terms with pagination",
      description =
          "Search glossary terms by name, display name, or description with server-side pagination. "
              + "This endpoint provides efficient search functionality for glossaries with large numbers of terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of matching glossary terms",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTermList.class)))
      })
  public Object searchGlossaryTerms(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Search query for term names, display names, or descriptions")
          @QueryParam("q")
          String query,
      @Parameter(description = "Filter by glossary ID") @QueryParam("glossary") UUID glossaryId,
      @Parameter(description = "Filter by glossary FQN") @QueryParam("glossaryFqn")
          String glossaryFqn,
      @Parameter(description = "Filter by parent term ID") @QueryParam("parent") UUID parentId,
      @Parameter(description = "Filter by parent term FQN") @QueryParam("parentFqn")
          String parentFqn,
      @Parameter(description = "Limit the number of terms returned (1 to 1000, default = 50)")
          @DefaultValue("50")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 1000, message = "must be less than or equal to 1000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offsetParam,
      @Parameter(
              description = "Fields requested in the returned terms",
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
                  "Filter by entity status (comma-separated: Approved,Draft,In Review,Rejected,Deprecated,Unprocessed)")
          @QueryParam("entityStatus")
          String entityStatus,
      @QueryParam("parentBusinessVersion") String parentBusinessVersion,
      @QueryParam("statuses") String statuses,
      @QueryParam("domainIds") String domainIds,
      @QueryParam("ownerIds") String ownerIds,
      @QueryParam("dataSourceTags") String dataSourceTags,
      @QueryParam("classificationTags") String classificationTags,
      @QueryParam("sortField") String sortField,
      @QueryParam("sortOrder") String sortOrder) {

    if (parentBusinessVersion != null) {
      if (glossaryId == null) {
        throw new BadRequestException("glossary is required for CDE business-version search");
      }
      return searchCdeBusinessVersions(
          securityContext,
          glossaryId,
          parentBusinessVersion,
          query,
          statuses,
          domainIds,
          ownerIds,
          dataSourceTags,
          classificationTags,
          sortField,
          sortOrder,
          limitParam,
          offsetParam);
    }

    Fields fields = getFields(fieldsParam);
    ResourceContextInterface glossaryResourceContext = new ResourceContext<>(GLOSSARY);
    OperationContext glossaryOperationContext =
        new OperationContext(GLOSSARY, getViewOperations(fields));
    OperationContext glossaryTermOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface glossaryTermResourceContext = new ResourceContext<>(GLOSSARY_TERM);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(glossaryOperationContext, glossaryResourceContext),
            new AuthRequest(glossaryTermOperationContext, glossaryTermResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    if (glossaryId != null) {
      DataDictionaryResolver.resolveDataDictionary(repository.getGlossary(glossaryId.toString()));
    } else if (glossaryFqn != null) {
      DataDictionaryResolver.requireDataDictionaryName(glossaryFqn);
    } else if (parentId != null) {
      requireCde(parentId);
    } else if (parentFqn != null) {
      requireCde(parentFqn);
    } else {
      glossaryFqn = DataDictionaryResolver.DATA_DICTIONARY_NAME;
    }

    String effectiveEntityStatus = entityStatus;
    boolean publishedOnly =
        "Published".equals(effectiveEntityStatus) || "Approved".equals(effectiveEntityStatus);
    String repositoryStatus = publishedOnly ? "Published" : effectiveEntityStatus;
    ResultList<GlossaryTerm> result;
    if (glossaryId != null) {
      result =
          repository.searchGlossaryTermsById(
              glossaryId, query, limitParam, offsetParam, fieldsParam, include, repositoryStatus);
    } else if (glossaryFqn != null) {
      result =
          repository.searchGlossaryTermsByFQN(
              glossaryFqn, query, limitParam, offsetParam, fieldsParam, include, repositoryStatus);
    } else if (parentId != null) {
      result =
          repository.searchGlossaryTermsByParentId(
              parentId, query, limitParam, offsetParam, fieldsParam, include, repositoryStatus);
    } else if (parentFqn != null) {
      result =
          repository.searchGlossaryTermsByParentFQN(
              parentFqn, query, limitParam, offsetParam, fieldsParam, include, repositoryStatus);
    } else {
      // Search across all glossary terms without parent filter
      // Uses efficient database-level search and pagination
      result =
          repository.searchGlossaryTermsByParentFQN(
              null, query, limitParam, offsetParam, fieldsParam, include, repositoryStatus);
    }

    if (publishedOnly && result != null && result.getData() != null) {
      Map<UUID, PublishedSnapshotRecord> snapshots =
          versioningService.getLatestPublishedBatch(
              GlossaryVersioningService.GLOSSARY_TERM,
              result.getData().stream().map(GlossaryTerm::getId).toList());
      result.setData(
          result.getData().stream()
              .map(term -> snapshots.get(term.getId()))
              .filter(java.util.Objects::nonNull)
              .map(snapshot -> JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class))
              .toList());
    } else if (result != null && result.getData() != null) {
      result.setData(resolveRepresentations(securityContext, result.getData()));
    }

    return addHref(uriInfo, result);
  }

  private Map<String, Object> searchCdeBusinessVersions(
      SecurityContext securityContext,
      UUID glossaryId,
      String parentBusinessVersion,
      String query,
      String statuses,
      String domainIds,
      String ownerIds,
      String dataSourceTags,
      String classificationTags,
      String sortField,
      String sortOrder,
      int limit,
      int offset) {
    Criteria criteria =
        new Criteria(
            glossaryId,
            parentBusinessVersion,
            query,
            CdeBusinessVersionSearchService.splitCsvParameter(statuses),
            CdeBusinessVersionSearchService.splitCsvParameter(domainIds),
            CdeBusinessVersionSearchService.splitCsvParameter(ownerIds),
            CdeBusinessVersionSearchService.splitCsvParameter(dataSourceTags),
            CdeBusinessVersionSearchService.splitCsvParameter(classificationTags),
            sortField,
            sortOrder,
            limit,
            offset);
    AuthorizedFlatRows authorized =
        loadAuthorizedCdeFlatRows(securityContext, glossaryId.toString(), parentBusinessVersion);
    Criteria validated =
        CdeBusinessVersionSearchService.validate(
            criteria, authorized.consumerOnly(), authorized.scopeType() == ScopeType.ARCHIVED);
    if (authorized.scopeType() != ScopeType.ARCHIVED
        && validated.statuses().contains("Archived")) {
      throw new BadRequestException("Archived status is only valid for an archived scope");
    }
    return cdeSearchService.search(
        validated,
        authorized.rows(),
        authorized.consumerOnly(),
        authorized.scopeType() == ScopeType.ARCHIVED);
  }

  private boolean isConsumer(SecurityContext securityContext, GlossaryTerm term) {
    GlossaryTerm authorizationTerm =
        repository.get(
            null,
            term.getId(),
            repository.getFields("owners,reviewers,glossary"),
            Include.NON_DELETED,
            false);
    GlossaryAuthorizationResolver.Capabilities effective =
        capabilities(securityContext, authorizationTerm);
    return effective.canViewPublished() && !effective.canViewWorking();
  }

  private boolean isConsumer(SecurityContext securityContext, UUID id) {
    return isConsumer(securityContext, requireCde(id));
  }

  private List<GlossaryTerm> resolveRepresentations(
      SecurityContext securityContext, List<GlossaryTerm> terms) {
    List<UUID> ids = terms.stream().map(GlossaryTerm::getId).toList();
    Map<UUID, WorkingVersionRecord> workingVersions =
        versioningService.getWorkingBatch(GlossaryVersioningService.GLOSSARY_TERM, ids);
    Map<UUID, PublishedSnapshotRecord> publishedVersions =
        versioningService.getLatestPublishedBatch(GlossaryVersioningService.GLOSSARY_TERM, ids);
    return terms.stream()
        .map(
            term -> {
              if (isConsumer(securityContext, term)) {
                PublishedSnapshotRecord published = publishedVersions.get(term.getId());
                return published == null
                    ? null
                    : JsonUtils.readValue(published.payload(), GlossaryTerm.class);
              }
              WorkingVersionRecord working = workingVersions.get(term.getId());
              if (working != null) {
                return JsonUtils.readValue(
                    JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)),
                    GlossaryTerm.class);
              }
              PublishedSnapshotRecord published = publishedVersions.get(term.getId());
              return published == null
                  ? term
                  : JsonUtils.readValue(published.payload(), GlossaryTerm.class);
            })
        .filter(java.util.Objects::nonNull)
        .toList();
  }

  private List<GlossaryTerm> resolveAuthoringRepresentations(
      SecurityContext securityContext,
      List<GlossaryTerm> terms,
      String parentBusinessVersion) {
    List<UUID> ids = terms.stream().map(GlossaryTerm::getId).toList();
    Map<UUID, WorkingVersionRecord> working =
        parentBusinessVersion == null
            ? versioningService.getWorkingBatch(GlossaryVersioningService.GLOSSARY_TERM, ids)
            : versioningService.getWorkingBatch(
                GlossaryVersioningService.GLOSSARY_TERM, ids, parentBusinessVersion);
    Map<UUID, PublishedSnapshotRecord> published =
        parentBusinessVersion == null
            ? versioningService.getLatestPublishedBatch(
                GlossaryVersioningService.GLOSSARY_TERM, ids)
            : versioningService.getLatestPublishedBatch(
                GlossaryVersioningService.GLOSSARY_TERM, ids, parentBusinessVersion);
    return terms.stream()
        .map(
            term -> {
              WorkingVersionRecord workingRecord = working.get(term.getId());
              if (workingRecord != null) {
                return JsonUtils.readValue(
                    JsonUtils.pojoToJson(GlossaryVersionResponses.working(workingRecord)),
                    GlossaryTerm.class);
              }
              PublishedSnapshotRecord publishedRecord = published.get(term.getId());
              return publishedRecord == null
                  ? null
                  : JsonUtils.readValue(publishedRecord.payload(), GlossaryTerm.class);
            })
        .filter(java.util.Objects::nonNull)
        .filter(term -> capabilitiesForAuthorizationTerm(securityContext, term).canViewWorking())
        .toList();
  }

  private GlossaryTerm mutableDraftPayload(GlossaryTerm identity, CdeDraftUpdateRequest request) {
    if (request == null || request.getExpectedRevision() == null) {
      throw new BadRequestException("expectedRevision is required");
    }
    List<EntityReference> owners =
        EntityRepository.validateOwners(new ArrayList<>(request.getOwners()));
    EntityRepository.validateReviewers(request.getReviewers());
    List<EntityReference> domains =
        request.getDomains().stream()
            .map(reference -> Entity.getEntityReference(reference, Include.NON_DELETED))
            .toList();
    return new GlossaryTerm()
        .withId(identity.getId())
        .withName(identity.getName())
        .withFullyQualifiedName(identity.getFullyQualifiedName())
        .withGlossary(identity.getGlossary())
        .withDisplayName(request.getDisplayName())
        .withDescription(request.getDescription())
        .withOwners(owners)
        .withReviewers(request.getReviewers())
        .withDomains(domains)
        .withTags(request.getTags())
        .withExtension(request.getExtension())
        .withEntityStatus(EntityStatus.DRAFT)
        .withVersion(identity.getVersion());
  }

  @GET
  @Path("/relationTypes/usage")
  @Operation(
      operationId = "getRelationTypeUsageCounts",
      summary = "Get usage counts for all relation types",
      description =
          "Get a map of relation types to the count of glossary term relations using that type. "
              + "Useful for determining if a relation type can be safely deleted.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of relation type to usage count",
            content = @Content(mediaType = "application/json"))
      })
  public Response getRelationTypeUsageCounts(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    java.util.Map<String, Integer> result = repository.getRelationTypeUsageCounts();
    return Response.ok(result).build();
  }

  @GET
  @Path("/assets/counts")
  @Operation(
      operationId = "getAllGlossaryTermsWithAssetsCount",
      summary = "Get all glossary terms with their asset counts",
      description =
          "Get a map of glossary term fully qualified names to their asset counts using search aggregation.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of glossary term FQN to asset count",
            content = @Content(mediaType = "application/json"))
      })
  public Response getAllGlossaryTermsWithAssetsCount(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Filter by parent glossary or glossary term FQN. "
                      + "When provided, only returns asset counts for children whose FQN starts with this value.")
          @QueryParam("parent")
          String parent) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    String cdeParent = parent == null ? DataDictionaryResolver.DATA_DICTIONARY_NAME : parent;
    DataDictionaryResolver.requireDataDictionaryFqn(cdeParent);
    java.util.Map<String, Integer> result =
        repository.getAllGlossaryTermsWithAssetsCount(cdeParent);
    return Response.ok(result).build();
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getGlossaryTermByID",
      summary = "Get a glossary term by Id",
      description = "Get a glossary term by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {id} is not found")
      })
  public GlossaryTerm get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
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
    GlossaryTerm term =
        getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
    DataDictionaryResolver.requireCde(term);
    if (isConsumer(securityContext, term)) {
      PublishedSnapshotRecord snapshot =
          versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY_TERM, id);
      return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
    }
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY_TERM, id);
      return addHref(
          uriInfo,
          JsonUtils.readValue(
              JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)), GlossaryTerm.class));
    } catch (NotFoundException ignored) {
      try {
        PublishedSnapshotRecord snapshot =
            versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY_TERM, id);
        return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
      } catch (NotFoundException noPublishedSnapshot) {
        // Before the first working/published version, return the identity projection.
      }
    }
    return term;
  }

  @GET
  @Path("/{id}/published/latest")
  @Operation(
      operationId = "getLatestPublishedGlossaryTerm",
      summary = "Get latest approved glossary term")
  public GlossaryTerm getLatestPublished(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    requireCde(id);
    PublishedSnapshotRecord snapshot =
        versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY_TERM, id);
    GlossaryTerm published = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
    return addHref(uriInfo, published);
  }

  @GET
  @Path("/byIds")
  @Operation(
      operationId = "getGlossaryTermsByIds",
      summary = "Get multiple glossary terms by Ids",
      description =
          "Get multiple glossary terms in a single request by passing a comma-separated list of UUIDs. "
              + "Exists to eliminate the per-Id round-trip pattern when hydrating related-term "
              + "graphs in the UI. Ids that are missing, deleted, or not visible to the caller "
              + "are silently omitted from the response, so callers should compare the response "
              + "size against the input.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary terms (may be shorter than the input ids list)",
            content =
                @Content(
                    mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = GlossaryTerm.class)))),
        @ApiResponse(responseCode = "400", description = "Invalid ids parameter")
      })
  public List<GlossaryTerm> getByIds(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Comma-separated list of glossary term Ids (UUIDs). Max 100 per call. "
                      + "Omit or pass blank to receive an empty list.",
              schema = @Schema(type = "string"))
          @QueryParam("ids")
          String idsParam,
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
          String includeRelations,
      @Parameter(description = "Resolve CDE representations in this Data Dictionary version")
          @QueryParam("parentBusinessVersion")
          String parentBusinessVersion) {
    List<UUID> ids = parseIdsParam(idsParam);
    List<GlossaryTerm> result = new ArrayList<>(ids.size());
    for (UUID id : ids) {
      try {
        GlossaryTerm term =
            getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
        result.add(DataDictionaryResolver.requireCde(term));
      } catch (EntityNotFoundException | AuthorizationException ex) {
        // Expected per-id misses — silently omit so a single bad Id doesn't
        // 404/403 the whole batch. Matches the documented contract and the
        // old Promise.allSettled semantics on the client.
        LOG.debug("byIds: glossary term {} not found or not visible — {}", id, ex.getMessage());
      } catch (RuntimeException ex) {
        // Unexpected per-id failure (validation, downstream 5xx surfaced as
        // WebApplicationException, etc.). Keep the batch best-effort —
        // dropping one term beats failing the whole request — but log at
        // WARN so a real bug isn't silently swallowed.
        LOG.warn("byIds: unexpected error hydrating glossary term {}", id, ex);
      }
    }
    List<GlossaryTerm> resolved =
        parentBusinessVersion == null
            ? resolveRepresentations(securityContext, result)
            : resolveAuthoringRepresentations(
                securityContext, result, parentBusinessVersion);
    return resolved.stream()
        .map(term -> addHref(uriInfo, term))
        .toList();
  }

  private List<UUID> parseIdsParam(String idsParam) {
    if (idsParam == null || idsParam.isBlank()) {
      return List.of();
    }
    List<UUID> ids;
    try {
      ids =
          Arrays.stream(idsParam.split(","))
              .map(String::trim)
              .filter(s -> !s.isEmpty())
              .map(UUID::fromString)
              .toList();
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException("ids parameter contains an invalid UUID");
    }
    if (ids.size() > MAX_BATCH_BY_IDS) {
      throw new IllegalArgumentException(
          String.format(
              "Too many ids: %d (max %d). Split the request into multiple batches.",
              ids.size(), MAX_BATCH_BY_IDS));
    }
    return ids;
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getGlossaryTermByFQN",
      summary = "Get a glossary term by fully qualified name",
      description = "Get a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {fqn} is not found")
      })
  public GlossaryTerm getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
    GlossaryTerm term =
        getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, includeRelations);
    DataDictionaryResolver.requireCde(term);
    if (isConsumer(securityContext, term)) {
      PublishedSnapshotRecord snapshot =
          versioningService.getLatestPublished(
              GlossaryVersioningService.GLOSSARY_TERM, term.getId());
      return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
    }
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY_TERM, term.getId());
      return addHref(
          uriInfo,
          JsonUtils.readValue(
              JsonUtils.pojoToJson(GlossaryVersionResponses.working(working)), GlossaryTerm.class));
    } catch (NotFoundException ignored) {
      try {
        PublishedSnapshotRecord snapshot =
            versioningService.getLatestPublished(
                GlossaryVersioningService.GLOSSARY_TERM, term.getId());
        return addHref(uriInfo, JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
      } catch (NotFoundException noPublishedSnapshot) {
        // Before the first working/published version, return the identity projection.
      }
    }
    return term;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllGlossaryTermVersion",
      summary = "List glossary term versions",
      description = "Get a list of all the versions of a glossary terms identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of glossary term versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireCde(id);
    if (isConsumer(securityContext, id)) {
      throw new AuthorizationException(
          "Native metadata history is not available to consumers; use /published");
    }
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificGlossaryTermVersion",
      summary = "Get a version of the glossary term",
      description = "Get a version of the glossary term by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {id} and version {version} is not found")
      })
  public GlossaryTerm getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "glossary term version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    requireCde(id);
    if (isConsumer(securityContext, id)) {
      throw new AuthorizationException(
          "Native metadata history is not available to consumers; use /published");
    }
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createGlossaryTerm",
      summary = "Create a glossary term",
      description = "Create a new glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossaryTerm create) {
    DataDictionaryResolver.requireDirectCdeCreate(create);
    GlossaryTerm term = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Glossary glossary =
        DataDictionaryResolver.requireDataDictionary(
            Entity.getEntity(term.getGlossary(), "owners,reviewers", Include.NON_DELETED));
    String parentBusinessVersion =
        GlossaryBusinessVersion.requireCanonicalDictionary(create.getParentBusinessVersion());
    term.setParentBusinessVersion(parentBusinessVersion);
    Glossary authorizationGlossary =
        resolveCdeCreateScope(glossary.getId(), parentBusinessVersion);
    authorizer.authorize(
        securityContext,
        new OperationContext(GLOSSARY, MetadataOperation.EDIT_WORKING),
        new ResourceContext<>(GLOSSARY, authorizationGlossary.getId(), null));
    CreateResourceContext<GlossaryTerm> createContext =
        new CreateResourceContext<>(entityType, term);
    OperationContext createOperation = new OperationContext(entityType, MetadataOperation.CREATE);
    limits.enforceLimits(securityContext, createContext, createOperation);
    authorizer.authorize(securityContext, createOperation, createContext);
    try {
      WorkingVersionRecord working =
          repository.createInitialDraft(
              term,
              parentBusinessVersion,
              securityContext.getUserPrincipal().getName());
      return Response.status(Response.Status.CREATED)
          .entity(GlossaryVersionResponses.working(working))
          .build();
    } catch (org.jdbi.v3.core.statement.UnableToExecuteStatementException exception) {
      throw new jakarta.ws.rs.ClientErrorException(
          "A CDE with this name already exists", Response.Status.CONFLICT, exception);
    }
  }

  private Glossary resolveCdeCreateScope(UUID glossaryId, String parentBusinessVersion) {
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY, glossaryId);
      if (parentBusinessVersion.equals(working.businessVersion())) {
        return JsonUtils.readValue(working.payload(), Glossary.class);
      }
    } catch (NotFoundException ignored) {
      // An Approved active Dictionary intentionally has no working record.
    }

    PublishedSnapshotRecord published =
        versioningService.getLatestPublished(GlossaryVersioningService.GLOSSARY, glossaryId);
    if (!parentBusinessVersion.equals(published.businessVersion())
        || published.archivedAt() != null) {
      throw new BadRequestException(
          "parentBusinessVersion must identify a working or active Approved Data Dictionary");
    }
    return JsonUtils.readValue(published.payload(), Glossary.class);
  }

  private Map<String, Object> listCdeFlatRows(
      SecurityContext securityContext,
      String glossaryIdParam,
      String requestedParentBusinessVersion,
      int limit,
      int offset) {
    if (!List.of(10, 15, 25, 50).contains(limit)) {
      throw new BadRequestException("limit must be one of 10, 15, 25, or 50");
    }
    if (offset < 0) {
      throw new BadRequestException("offset must be greater than or equal to 0");
    }

    AuthorizedFlatRows authorized =
        loadAuthorizedCdeFlatRows(
            securityContext, glossaryIdParam, requestedParentBusinessVersion);
    List<Map<String, Object>> visibleRows = authorized.rows();
    int total = visibleRows.size();
    int from = Math.min(offset, total);
    int to = Math.min(from + limit, total);
    return Map.of(
        "data",
        new ArrayList<>(visibleRows.subList(from, to)),
        "paging",
        Map.of("total", total, "limit", limit, "offset", offset));
  }

  private AuthorizedFlatRows loadAuthorizedCdeFlatRows(
      SecurityContext securityContext,
      String glossaryIdParam,
      String requestedParentBusinessVersion) {
    if (glossaryIdParam == null || glossaryIdParam.isBlank()) {
      throw new BadRequestException("glossary is required for a Data Dictionary flat list");
    }
    final String parentBusinessVersion;
    try {
      parentBusinessVersion =
          GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }

    final EntityReference glossaryReference;
    try {
      glossaryReference = repository.getGlossary(glossaryIdParam);
      DataDictionaryResolver.resolveDataDictionary(glossaryReference);
    } catch (BadRequestException | EntityNotFoundException exception) {
      throw new NotFoundException("Data Dictionary scope was not found");
    }
    UUID glossaryId = glossaryReference.getId();
    Scope scope = cdeFlatListService.resolveScope(glossaryId, parentBusinessVersion);
    Glossary authorizationGlossary = JsonUtils.readValue(scope.payload(), Glossary.class);
    boolean consumerOnly =
        GlossaryAuthorizationResolver.isConsumerOnly(
            org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext(securityContext));
    GlossaryAuthorizationResolver.Capabilities parentCapabilities =
        capabilitiesForAuthorizationGlossary(securityContext, authorizationGlossary);
    if ((scope.type() == ScopeType.ACTIVE
            && !policyAllowsGlossary(
                securityContext, authorizationGlossary, MetadataOperation.VIEW_BASIC))
        || (scope.type() == ScopeType.WORKING
            && (consumerOnly || !parentCapabilities.canViewWorking()))
        || (scope.type() == ScopeType.ARCHIVED
            && !policyAllowsGlossary(
                securityContext, authorizationGlossary, MetadataOperation.VIEW_BASIC)
            && !parentCapabilities.canViewWorking()
            && !parentCapabilities.canArchive())) {
      throw new NotFoundException("Data Dictionary scope was not found");
    }

    Candidates candidates = cdeFlatListService.loadCandidates(glossaryId, scope);
    List<Map<String, Object>> visibleRows = new ArrayList<>();
    for (PublishedSnapshotRecord record : candidates.published()) {
      GlossaryTerm term = JsonUtils.readValue(record.payload(), GlossaryTerm.class);
      if (!capabilitiesForAuthorizationTerm(securityContext, term).canViewPublished()
          || !policyAllows(securityContext, term, MetadataOperation.VIEW_BASIC)) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>(GlossaryVersionResponses.published(record));
      normalizeFlatRow(
          row,
          record.entityId(),
          parentBusinessVersion,
          scope.type() == ScopeType.ARCHIVED ? "archived" : "published");
      visibleRows.add(row);
    }
    for (WorkingVersionRecord record : candidates.working()) {
      if (!capabilitiesForWorking(securityContext, record).canViewWorking()) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>(GlossaryVersionResponses.working(record));
      normalizeFlatRow(row, record.entityId(), parentBusinessVersion, "working");
      visibleRows.add(row);
    }

    visibleRows.sort(CDE_FLAT_ROW_COMPARATOR);
    return new AuthorizedFlatRows(
        parentBusinessVersion, scope.type(), consumerOnly, visibleRows);
  }

  private record AuthorizedFlatRows(
      String parentBusinessVersion,
      ScopeType scopeType,
      boolean consumerOnly,
      List<Map<String, Object>> rows) {}

  private ImportScope authorizeImportScope(
      SecurityContext securityContext, UUID glossaryId, String requestedParentBusinessVersion) {
    final String parentBusinessVersion;
    try {
      parentBusinessVersion =
          GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
    Scope scope;
    try {
      scope = cdeFlatListService.resolveScope(glossaryId, parentBusinessVersion);
    } catch (RuntimeException exception) {
      throw new NotFoundException("Data Dictionary import scope was not found");
    }
    if (scope.type() == ScopeType.ARCHIVED) {
      throw new NotFoundException("Data Dictionary import scope was not found");
    }
    Glossary glossary = JsonUtils.readValue(scope.payload(), Glossary.class);
    if (scope.type() == ScopeType.WORKING
        && glossary.getEntityStatus() != EntityStatus.DRAFT) {
      throw new BadRequestException("Import is allowed only in an active or Draft Data Dictionary");
    }
    GlossaryAuthorizationResolver.requireEdit(
        capabilitiesForAuthorizationGlossary(securityContext, glossary));
    return new ImportScope(parentBusinessVersion, glossary, scope.type());
  }

  private PlannedRow planImportRow(
      RowData row,
      ImportScope scope,
      Map<String, Object> existing,
      CdeImportService.ExistingCodePolicy existingCodePolicy,
      DisplayNameReferenceResolver referenceResolver) {
    try {
      String name = row.value(0).trim();
      if (existing != null
          && existingCodePolicy == CdeImportService.ExistingCodePolicy.SKIP_EXISTING) {
        return new PlannedRow(
            row.rowNumber(), name, "SKIP", null, null, null, null,
            Map.of(), List.of("Mã CDE đã tồn tại và sẽ được bỏ qua"), List.of());
      }
      UUID termId = existing == null
          ? UUID.randomUUID()
          : UUID.fromString(String.valueOf(existing.get("termId")));
      String action;
      Long revision = null;
      String expectedPublishedVersion = null;
      String businessVersion;
      List<String> warnings = new ArrayList<>();
      if (existing == null) {
        action = "CREATE";
        businessVersion = scope.parentBusinessVersion() + ".0";
      } else if ("working".equals(existing.get("recordType"))) {
        revision = Long.valueOf(String.valueOf(existing.get("workingRevision")));
        businessVersion = String.valueOf(existing.get("businessVersion"));
        String status = String.valueOf(existing.get("entityStatus"));
        action = switch (status.replace(" ", "")) {
          case "InReview" -> "REPLACE_IN_REVIEW_AND_REOPEN";
          case "Rejected" -> "REPLACE_REJECTED_AND_REOPEN";
          default -> "UPDATE_DRAFT";
        };
        if (!"UPDATE_DRAFT".equals(action)) {
          warnings.add("Phiên duyệt hiện tại sẽ bị vô hiệu hóa và CDE trở về Draft");
        }
      } else {
        action = "CREATE_VERSION";
        String publishedVersion = String.valueOf(existing.get("businessVersion"));
        expectedPublishedVersion = publishedVersion;
        businessVersion = nextCdeVersion(scope.parentBusinessVersion(), publishedVersion);
      }

      GlossaryTerm term =
          new GlossaryTerm()
              .withId(termId)
              .withName(name)
              .withDisplayName(row.value(2))
              .withDescription(row.value(4))
              .withGlossary(
                  new EntityReference()
                      .withId(scope.glossary().getId())
                      .withType(Entity.GLOSSARY)
                      .withName(scope.glossary().getName())
                      .withFullyQualifiedName(scope.glossary().getFullyQualifiedName()))
              .withParentBusinessVersion(scope.parentBusinessVersion())
              .withBusinessVersion(businessVersion)
              .withEntityStatus(EntityStatus.DRAFT)
              .withDomains(referenceResolver.resolve(row.value(1), Entity.DOMAIN))
              .withOwners(referenceResolver.resolveParties(row.value(6)))
              .withReviewers(List.of())
              .withTags(resolveImportTags(row, referenceResolver))
              .withExtension(importExtension(row));
      if (existing != null && existing.get("fullyQualifiedName") != null) {
        term.setFullyQualifiedName(String.valueOf(existing.get("fullyQualifiedName")));
      }
      Map<String, Object> payload =
          JsonUtils.readValue(JsonUtils.pojoToJson(term), Map.class);
      try {
        EntityRepository.validateExtension(term.getExtension(), Entity.GLOSSARY_TERM);
      } catch (RuntimeException exception) {
        throw new BadRequestException(
            "Dữ liệu custom property không đúng schema", exception);
      }
      return new PlannedRow(
          row.rowNumber(), name, action, termId, businessVersion, expectedPublishedVersion, revision,
          payload, warnings, List.of());
    } catch (BadRequestException exception) {
      return PlannedRow.error(
          row.rowNumber(), "", "INVALID_ROW",
          exception.getMessage() == null ? "Dữ liệu không hợp lệ" : exception.getMessage());
    } catch (RuntimeException exception) {
      LOG.error("CDE import reference lookup failed at row {}", row.rowNumber(), exception);
      return PlannedRow.error(
          row.rowNumber(), "", "REFERENCE_LOOKUP_FAILED",
          "Không thể tra cứu dữ liệu tham chiếu. Vui lòng thử lại hoặc liên hệ quản trị viên");
    }
  }

  private void authorizeImportRow(SecurityContext securityContext, PlannedRow row) {
    if ("CREATE".equals(row.action())) {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.CREATE),
          getResourceContext());
      return;
    }
    GlossaryTerm term = requireCde(row.termId());
    GlossaryAuthorizationResolver.requireEdit(
        capabilitiesForAuthorizationTerm(securityContext, term));
    if ("CREATE_VERSION".equals(row.action())) {
      GlossaryAuthorizationResolver.requireCreateVersion(
          capabilitiesForAuthorizationTerm(securityContext, term));
    }
  }

  private static String nextCdeVersion(String parent, String current) {
    String[] parts = current.split("\\.");
    if (parts.length != 2 || !parts[0].equals(parent)) {
      throw new BadRequestException("Approved CDE version does not belong to the import scope");
    }
    return parent + "." + new BigInteger(parts[1]).add(BigInteger.ONE);
  }

  private static Map<String, Object> importExtension(RowData row) {
    String quality = row.value(10).trim();
    if (!quality.isBlank() && !List.of("Có", "Không").contains(quality)) {
      throw new BadRequestException("Quy định chất lượng dữ liệu chỉ nhận Có hoặc Không");
    }
    String effective = requireImportDate(row.value(11), "Ngày hiệu lực");
    String expiration = requireImportDate(row.value(12), "Ngày hết hiệu lực");
    if (!effective.isBlank() && !expiration.isBlank()
        && java.time.LocalDate.parse(expiration).isBefore(java.time.LocalDate.parse(effective))) {
      throw new BadRequestException("Ngày hết hiệu lực không được trước ngày hiệu lực");
    }
    Map<String, Object> extension = new LinkedHashMap<>();
    putImportString(extension, "entityRelationship", row.value(5));
    putImportString(extension, "relatedRegulatoryDocuments", row.value(9));
    if (!quality.isBlank()) {
      extension.put("dataQualityRules", List.of("Có".equals(quality) ? "Y" : "N"));
    }
    putImportString(extension, "effectiveDate", effective);
    putImportString(extension, "expirationDate", expiration);
    return extension;
  }

  private static void putImportString(
      Map<String, Object> extension, String property, String value) {
    if (value != null && !value.isBlank()) {
      extension.put(property, value);
    }
  }

  private static String requireImportDate(String value, String column) {
    if (value == null || value.isBlank()) return "";
    try {
      java.time.format.DateTimeFormatter formatter =
          java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu")
              .withResolverStyle(java.time.format.ResolverStyle.STRICT);
      return java.time.LocalDate.parse(value.trim(), formatter).toString();
    } catch (RuntimeException exception) {
      throw new BadRequestException(column + " phải có định dạng dd/MM/yyyy");
    }
  }

  private static List<TagLabel> resolveImportTags(
      RowData row, DisplayNameReferenceResolver referenceResolver) {
    List<TagLabel> tags = new ArrayList<>();
    addImportTags(tags, row.value(3), "DataSource", referenceResolver);
    addImportTags(tags, row.value(7), "DataClassification", referenceResolver);
    addImportTags(tags, row.value(8), "PersonalData", referenceResolver);
    return tags;
  }

  private static void addImportTags(
      List<TagLabel> tags,
      String value,
      String classification,
      DisplayNameReferenceResolver referenceResolver) {
    if (value == null || value.isBlank()) return;
    for (String line : value.split("\\R")) {
      EntityReference reference = referenceResolver.resolveTag(line, classification);
      tags.add(
          new TagLabel()
              .withTagFQN(reference.getFullyQualifiedName())
              .withSource(TagLabel.TagSource.CLASSIFICATION)
              .withLabelType(TagLabel.LabelType.MANUAL)
              .withState(TagLabel.State.CONFIRMED));
    }
  }

  private static final class DisplayNameReferenceResolver {
    private final Map<String, Map<String, List<EntityReference>>> byType = new LinkedHashMap<>();

    private List<EntityReference> resolve(String value, String type) {
      if (value == null || value.isBlank()) return List.of();
      List<EntityReference> result = new ArrayList<>();
      for (String label : value.split("\\R")) {
        result.add(resolveOne(type, label, null));
      }
      return result;
    }

    private List<EntityReference> resolveParties(String value) {
      if (value == null || value.isBlank()) return List.of();
      List<EntityReference> result = new ArrayList<>();
      for (String label : value.split("\\R")) {
        List<EntityReference> matches = new ArrayList<>();
        matches.addAll(matches(Entity.USER, label, null));
        matches.addAll(matches(Entity.TEAM, label, null));
        result.add(requireUnique(label, "user/team", matches));
      }
      return result;
    }

    private EntityReference resolveTag(String label, String classification) {
      return resolveOne(Entity.TAG, label, classification + ".");
    }

    private EntityReference resolveOne(String type, String label, String fqnPrefix) {
      return requireUnique(label, type, matches(type, label, fqnPrefix));
    }

    private List<EntityReference> matches(String type, String rawLabel, String fqnPrefix) {
      String key = normalizeDisplayName(rawLabel);
      return byType
          .computeIfAbsent(type, DisplayNameReferenceResolver::load)
          .getOrDefault(key, List.of())
          .stream()
          .filter(
              reference ->
                  fqnPrefix == null
                      || String.valueOf(reference.getFullyQualifiedName()).startsWith(fqnPrefix))
          .toList();
    }

    private static Map<String, List<EntityReference>> load(String type) {
      EntityRepository<? extends org.openmetadata.schema.EntityInterface> repository =
          Entity.getEntityRepository(type);
      Include include = repository.supportsSoftDelete ? Include.NON_DELETED : Include.ALL;
      Map<String, List<EntityReference>> index = new LinkedHashMap<>();
      for (org.openmetadata.schema.EntityInterface entity :
          repository.listAll(
              repository.getFields("displayName"), new ListFilter(include))) {
        String label =
            entity.getDisplayName() == null || entity.getDisplayName().isBlank()
                ? entity.getName()
                : entity.getDisplayName();
        index.computeIfAbsent(normalizeDisplayName(label), ignored -> new ArrayList<>())
            .add(entity.getEntityReference());
      }
      return index;
    }

    private static EntityReference requireUnique(
        String rawLabel, String type, List<EntityReference> matches) {
      String label = rawLabel == null ? "" : rawLabel.trim();
      if (label.isBlank()) throw new BadRequestException("Reference displayName must not be blank");
      if (matches.isEmpty()) {
        throw new BadRequestException(type + " displayName '" + label + "' was not found");
      }
      if (matches.size() > 1) {
        throw new BadRequestException(type + " displayName '" + label + "' is ambiguous");
      }
      return matches.get(0);
    }

    private static String normalizeDisplayName(String value) {
      return java.text.Normalizer.normalize(
              value == null ? "" : value.trim(), java.text.Normalizer.Form.NFKC)
          .toLowerCase(Locale.ROOT);
    }
  }

  private record ImportScope(
      String parentBusinessVersion, Glossary glossary, ScopeType scopeType) {}

  private GlossaryAuthorizationResolver.Capabilities capabilitiesForAuthorizationGlossary(
      SecurityContext securityContext, Glossary glossary) {
    return GlossaryAuthorizationResolver.fromPolicy(
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.VIEW_WORKING),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.EDIT_WORKING),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.SUBMIT_WORKING),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.CREATE_VERSION),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.APPROVE_WORKING),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.REJECT_WORKING),
        policyAllowsGlossary(securityContext, glossary, MetadataOperation.ARCHIVE_PUBLISHED));
  }

  private void authorizeCdeDetailScope(
      SecurityContext securityContext, GlossaryTerm term, String parentBusinessVersion) {
    if (term.getGlossary() == null || term.getGlossary().getId() == null) {
      throw new NotFoundException("CDE was not found in the requested Data Dictionary scope");
    }
    Scope scope =
        cdeFlatListService.resolveScope(term.getGlossary().getId(), parentBusinessVersion);
    Glossary glossary = JsonUtils.readValue(scope.payload(), Glossary.class);
    GlossaryAuthorizationResolver.Capabilities capabilities =
        capabilitiesForAuthorizationGlossary(securityContext, glossary);
    if ((scope.type() == ScopeType.ACTIVE
            && !policyAllowsGlossary(securityContext, glossary, MetadataOperation.VIEW_BASIC))
        || (scope.type() == ScopeType.WORKING && !capabilities.canViewWorking())
        || (scope.type() == ScopeType.ARCHIVED
            && !policyAllowsGlossary(securityContext, glossary, MetadataOperation.VIEW_BASIC)
            && !capabilities.canViewWorking()
            && !capabilities.canArchive())) {
      throw new NotFoundException("CDE was not found in the requested Data Dictionary scope");
    }
  }

  private boolean policyAllowsGlossary(
      SecurityContext securityContext, Glossary glossary, MetadataOperation operation) {
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(GLOSSARY, operation),
          new ResourceContext<Glossary>(
              GLOSSARY,
              glossary,
              (GlossaryRepository) Entity.getEntityRepository(GLOSSARY)));
      return true;
    } catch (AuthorizationException exception) {
      return false;
    }
  }

  private static void normalizeFlatRow(
      Map<String, Object> row,
      UUID termId,
      String parentBusinessVersion,
      String recordType) {
    row.put("termId", termId.toString());
    row.put("id", termId.toString());
    row.put("parentBusinessVersion", parentBusinessVersion);
    row.put("recordType", recordType);
    row.putIfAbsent("displayName", null);
    row.putIfAbsent("description", null);
    row.putIfAbsent("owners", List.of());
    row.putIfAbsent("reviewers", List.of());
    row.putIfAbsent("domains", List.of());
    row.putIfAbsent("tags", List.of());
    row.putIfAbsent("extension", Map.of());
  }

  private static final Comparator<Map<String, Object>> CDE_FLAT_ROW_COMPARATOR =
      Comparator.<Map<String, Object>, String>comparing(
              row -> String.valueOf(row.getOrDefault("name", "")).toLowerCase(Locale.ROOT))
          .thenComparing(
              (left, right) ->
                  compareNumericBusinessVersion(
                      String.valueOf(right.get("businessVersion")),
                      String.valueOf(left.get("businessVersion"))))
          .thenComparing(row -> String.valueOf(row.get("termId")))
          .thenComparing(row -> String.valueOf(row.get("recordType")));

  private static int compareNumericBusinessVersion(String left, String right) {
    String[] leftParts = left.split("\\.");
    String[] rightParts = right.split("\\.");
    int length = Math.max(leftParts.length, rightParts.length);
    for (int i = 0; i < length; i++) {
      BigInteger leftPart =
          i < leftParts.length ? new BigInteger(leftParts[i]) : BigInteger.ZERO;
      BigInteger rightPart =
          i < rightParts.length ? new BigInteger(rightParts[i]) : BigInteger.ZERO;
      int result = leftPart.compareTo(rightPart);
      if (result != 0) {
        return result;
      }
    }
    return 0;
  }

  private static void requireCdeIdentityScope(
      GlossaryTerm term, String requestedParentBusinessVersion) {
    String requestedScope =
        GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    if (term.getParentBusinessVersion() == null
        || !requestedScope.equals(term.getParentBusinessVersion())) {
      throw new BadRequestException(
          "CDE identity does not belong to parentBusinessVersion " + requestedScope);
    }
  }

  private static void requireCdeIdentityScopeNotFound(
      GlossaryTerm term, String requestedParentBusinessVersion) {
    final String requestedScope;
    try {
      requestedScope =
          GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new NotFoundException("CDE was not found in the requested Data Dictionary scope");
    }
    if (term.getParentBusinessVersion() == null
        || !requestedScope.equals(term.getParentBusinessVersion())) {
      throw new NotFoundException("CDE was not found in the requested Data Dictionary scope");
    }
  }

  private static void requireCdeVersionScopeNotFound(
      String businessVersion, String parentBusinessVersion) {
    try {
      GlossaryBusinessVersion.requireCdeInScope(businessVersion, parentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new NotFoundException("CDE business version was not found in the requested scope");
    }
  }

  @POST
  @Path("/createMany")
  @Operation(
      operationId = "createManyGlossaryTerm",
      summary = "Create multiple glossary terms at once",
      description = "Create multiple new glossary terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createMany(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid List<CreateGlossaryTerm> creates) {
    throw new BadRequestException(
        "Bulk native CDE creation is disabled; create each CDE through atomic POST /glossaryTerms");
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchGlossaryTerm",
      summary = "Update a glossary term",
      description = "Update an existing glossary term using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
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
        "Direct glossary term patch is disabled; update the term working version");
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchGlossaryTerm",
      summary = "Update a glossary term by name.",
      description = "Update an existing glossary term using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the glossary term", schema = @Schema(type = "string"))
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
        "Direct glossary term patch is disabled; update the term working version");
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateGlossaryTerm",
      summary = "Create or update a glossary term",
      description =
          "Create a new glossary term, if it does not exist or update an existing glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The glossary",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateGlossaryTerm create) {
    throw new BadRequestException(
        "Glossary term upsert is disabled; create with POST and edit through a working version");
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
    requireCde(id);
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @PUT
  @Path("/{id}/assets/add")
  @Operation(
      operationId = "bulkAddGlossaryTermToAssets",
      summary = "Bulk Add Glossary Term to Assets",
      description = "Bulk Add Glossary Term to Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkAddGlossaryToAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddGlossaryToAssetsRequest request) {
    requireCde(id);
    return Response.ok().entity(repository.bulkAddAndValidateGlossaryToAssets(id, request)).build();
  }

  @PUT
  @Path("/{id}/tags/validate")
  @Operation(
      operationId = "validateGlossaryTermTagsAddition",
      summary = "Validate Tags Addition to Glossary Term",
      description = "Validate Tags Addition to Glossary Term",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response validateGlossaryTermTagsAddition(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid ValidateGlossaryTagsRequest request) {
    requireCde(id);
    return Response.ok().entity(repository.validateGlossaryTagsAddition(id, request)).build();
  }

  @PUT
  @Path("/{id}/assets/remove")
  @Operation(
      operationId = "bulkRemoveGlossaryTermFromAssets",
      summary = "Bulk Remove Glossary Term from Assets",
      description = "Bulk Remove Glossary Term from Assets",
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
  public Response bulkRemoveGlossaryFromAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid AddGlossaryToAssetsRequest request) {
    requireCde(id);
    return Response.ok().entity(repository.bulkRemoveGlossaryToAssets(id, request)).build();
  }

  @GET
  @Path("/{id}/assets")
  @Operation(
      operationId = "listGlossaryTermAssets",
      summary = "List assets tagged with this glossary term",
      description =
          "Get a paginated list of assets that have this glossary term applied. "
              + "Use limit and offset query params for pagination.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityReference.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {id} is not found")
      })
  public Response listGlossaryTermAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Limit the number of assets returned. (1 to 1000, default = 100)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(0)
          @QueryParam("offset")
          int offset) {
    requireCde(id);
    return Response.ok(repository.getGlossaryTermAssets(id, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/assets")
  @Operation(
      operationId = "listGlossaryTermAssetsByName",
      summary = "List assets tagged with this glossary term by fully qualified name",
      description =
          "Get a paginated list of assets that have this glossary term applied. "
              + "Use limit and offset query params for pagination.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityReference.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Glossary term for instance {fqn} is not found")
      })
  public Response listGlossaryTermAssetsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(description = "Limit the number of assets returned. (1 to 1000, default = 100)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          @QueryParam("limit")
          int limit,
      @Parameter(description = "Offset for pagination (default = 0)")
          @DefaultValue("0")
          @Min(0)
          @QueryParam("offset")
          int offset) {
    requireCde(fqn);
    return Response.ok(repository.getGlossaryTermAssetsByName(fqn, limit, offset)).build();
  }

  @PUT
  @Path("/{id}/moveAsync")
  @Operation(
      operationId = "moveGlossaryTerm",
      summary = "Move a glossary term to a new parent or glossary",
      description =
          "Move a glossary term to a new parent term or glossary. Only parent or glossary can be changed.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The moved glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class)))
      })
  @Consumes(MediaType.APPLICATION_JSON)
  public Response moveGlossaryTerm(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "MoveGlossaryTermRequest with new parent or glossary",
              required = true,
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON,
                      schema = @Schema(implementation = MoveGlossaryTermRequest.class)))
          MoveGlossaryTermRequest moveRequest) {
    requireCde(id);
    if (moveRequest.getParent() != null) {
      if (GLOSSARY.equals(moveRequest.getParent().getType())) {
        DataDictionaryResolver.resolveDataDictionary(moveRequest.getParent());
      } else {
        DataDictionaryResolver.requireCde(
            Entity.getEntity(
                moveRequest.getParent().withType(GLOSSARY_TERM), "glossary", Include.NON_DELETED));
      }
    }
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_GLOSSARY_TERMS);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PUT));

    // Validate the move operation synchronously before submitting to async executor
    // This will throw IllegalArgumentException if circular reference detected
    repository.validateMoveOperation(id, moveRequest);

    String jobId = UUID.randomUUID().toString();
    GlossaryTerm glossaryTerm =
        repository.get(uriInfo, id, repository.getFields("name"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    ExecutorService executorService = AsyncService.getInstance().getExecutorService();
    executorService.submit(
        () -> {
          try {
            GlossaryTerm movedGlossaryTerm = repository.moveGlossaryTerm(id, moveRequest, userName);
            WebsocketNotificationHandler.sendMoveOperationCompleteNotification(
                jobId, securityContext, movedGlossaryTerm);
          } catch (Exception e) {
            WebsocketNotificationHandler.sendMoveOperationFailedNotification(
                jobId, securityContext, glossaryTerm, e.getMessage());
          }
        });

    return Response.accepted()
        .entity(
            new MoveGlossaryTermResponse(
                jobId,
                "Move operation initiated for " + glossaryTerm.getName(),
                glossaryTerm.getName()))
        .build();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      summary = "Delete a glossary term by Id",
      description = "Delete a glossary term by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {id} is not found")
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
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireCde(id);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY_TERM, id);
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      summary = "Asynchronously delete a glossary term by Id",
      description = "Asynchronously delete a glossary term by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {id} is not found")
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
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    requireCde(id);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY_TERM, id);
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteGlossaryTermByName",
      summary = "Delete a glossary term by fully qualified name",
      description = "Delete a glossary term by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "glossaryTerm for instance {fqn} is not found")
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
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    GlossaryTerm term =
        getByNameInternal(uriInfo, securityContext, fqn, "id", Include.NON_DELETED, null);
    DataDictionaryResolver.requireCde(term);
    versioningService.assertDeletable(GlossaryVersioningService.GLOSSARY_TERM, term.getId());
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted glossary term",
      description = "Restore a soft deleted glossary term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Chart ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    requireCde(restore.getId());
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @POST
  @Path("/{id}/relations")
  @Operation(
      operationId = "addTermRelation",
      summary = "Add a typed relation to another glossary term",
      description =
          "Add a typed semantic relation (e.g., broader, narrower, synonym) from this glossary term to another.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "404", description = "Glossary term not found")
      })
  public Response addTermRelation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid TermRelation termRelation) {
    requireCde(id);
    DataDictionaryResolver.requireCde(
        Entity.getEntity(
            termRelation.getTerm().withType(GLOSSARY_TERM), "glossary", Include.NON_DELETED));
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PUT));
    GlossaryTerm term = repository.addTermRelation(id, termRelation);
    return Response.ok(addHref(uriInfo, term)).build();
  }

  @DELETE
  @Path("/{id}/relations/{toTermId}")
  @Operation(
      operationId = "removeTermRelation",
      summary = "Remove a relation to another glossary term",
      description = "Remove a relation from this glossary term to another term.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated glossary term",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = GlossaryTerm.class))),
        @ApiResponse(responseCode = "404", description = "Glossary term not found")
      })
  public Response removeTermRelation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the related glossary term to remove",
              schema = @Schema(type = "UUID"))
          @PathParam("toTermId")
          UUID toTermId,
      @Parameter(
              description =
                  "Type of relation to remove (optional, removes all types if not specified)")
          @QueryParam("relationType")
          String relationType) {
    requireCde(id);
    requireCde(toTermId);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PUT));
    GlossaryTerm term = repository.removeTermRelation(id, toTermId, relationType);
    return Response.ok(addHref(uriInfo, term)).build();
  }

  @GET
  @Path("/{id}/relationsGraph")
  @Operation(
      operationId = "getTermRelationGraph",
      summary = "Get the relation graph for a glossary term",
      description =
          "Get a graph of related terms up to a specified depth, optionally filtered by relation types.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Graph of related terms",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(responseCode = "404", description = "Glossary term not found")
      })
  public Response getTermRelationGraph(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the glossary term", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(description = "Depth of the graph (1-5, default = 1)")
          @DefaultValue("1")
          @Min(1)
          @Max(5)
          @QueryParam("depth")
          int depth,
      @Parameter(description = "Comma-separated list of relation types to include")
          @QueryParam("relationTypes")
          String relationTypes) {
    requireCde(id);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    List<String> types = null;
    if (relationTypes != null && !relationTypes.isEmpty()) {
      types = List.of(relationTypes.split(","));
    }
    return Response.ok(repository.getTermRelationGraph(id, depth, types)).build();
  }

  @GET
  @Path("/name/{fqn}/export")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportGlossaryTerm",
      summary = "Export glossary term in CSV format",
      description = "Export glossary term and its children in CSV format.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Exported csv with glossary terms",
            content = @Content(mediaType = "text/plain"))
      })
  public String exportCsv(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn)
      throws IOException {
    requireCde(fqn);
    return exportCsvInternal(securityContext, fqn, false);
  }

  @GET
  @Path("/name/{fqn}/exportAsync")
  @Produces(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "exportGlossaryTermAsync",
      summary = "Export glossary term in CSV format asynchronously",
      description = "Export glossary term and its children in CSV format asynchronously.",
      responses = {
        @ApiResponse(
            responseCode = "202",
            description = "Export initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.service.util.CSVExportResponse.class)))
      })
  public Response exportCsvAsync(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    requireCde(fqn);
    return exportCsvInternalAsync(securityContext, fqn, false);
  }

  @PUT
  @Path("/name/{fqn}/import")
  @Consumes(MediaType.TEXT_PLAIN)
  @Valid
  @Operation(
      operationId = "importGlossaryTerm",
      summary = "Import glossary terms from CSV",
      description =
          "Import glossary terms from CSV to create, and update glossary terms. This is a synchronous API.",
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
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(description = "CSV data to import", required = true) String csv,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @DefaultValue("true")
          @QueryParam("dryRun")
          boolean dryRun)
      throws IOException {
    requireCde(fqn);
    if (!dryRun) {
      throw new BadRequestException(
          "Direct CSV writes are disabled; import through glossary working-version APIs");
    }
    return importCsvInternal(uriInfo, securityContext, fqn, csv, dryRun, false);
  }

  @PUT
  @Path("/name/{fqn}/importAsync")
  @Consumes(MediaType.TEXT_PLAIN)
  @Produces(MediaType.APPLICATION_JSON)
  @Valid
  @Operation(
      operationId = "importGlossaryTermAsync",
      summary = "Import glossary term from CSV asynchronously",
      description =
          "Import glossary term and its children from CSV format asynchronously to create or update glossary terms.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Import initiated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.service.util.CSVImportResponse.class)))
      })
  public Response importCsvAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the glossary term",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(description = "CSV data to import", required = true) String csv,
      @Parameter(
              description =
                  "Dry-run when true is used for validating the CSV without really importing it. (default=true)",
              schema = @Schema(type = "boolean"))
          @QueryParam("dryRun")
          @DefaultValue("true")
          boolean dryRun) {
    requireCde(fqn);
    if (!dryRun) {
      throw new BadRequestException(
          "Direct CSV writes are disabled; import through glossary working-version APIs");
    }
    return importCsvInternalAsync(uriInfo, securityContext, fqn, csv, dryRun, false);
  }

  private GlossaryTerm requireCde(UUID id) {
    return DataDictionaryResolver.requireCde(
        repository.get(null, id, repository.getFields("glossary"), Include.NON_DELETED, false));
  }

  private GlossaryTerm requireCde(String fqn) {
    DataDictionaryResolver.requireDataDictionaryFqn(fqn);
    return DataDictionaryResolver.requireCde(
        repository.getByName(
            null, fqn, repository.getFields("glossary"), Include.NON_DELETED, false));
  }
}
