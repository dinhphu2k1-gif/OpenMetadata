/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.openmetadata.service.Entity.GLOSSARY;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.StreamingOutput;
import java.nio.file.Files;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.TechnicalDictionaryService;
import org.openmetadata.service.glossary.TechnicalDictionaryService.RecordView;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.glossary.versioning.TechnicalDictionaryExcelExporter;
import org.openmetadata.service.glossary.versioning.TechnicalDictionaryExcelExporter.ExportedWorkbook;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ScopeRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ColumnBindingRecord;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.MetadataOperation;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.FullyQualifiedName;

/** Thin REST facade over shared governed-glossary workflow and Technical Column binding. */
@Path("/v1/technical-dictionary")
@Tag(name = "Technical Dictionary", description = "Scope-aware governed technical metadata")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "technicalDictionary", order = 8)
public class TechnicalDictionaryResource {
  private final Authorizer authorizer;
  private final TechnicalDictionaryService service = new TechnicalDictionaryService();
  private final GlossaryVersioningService versions = new GlossaryVersioningService();

  public TechnicalDictionaryResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/scopes")
  public List<ScopeRecord> listScopes(@Context SecurityContext securityContext) {
    authorize(securityContext, null, MetadataOperation.VIEW_BASIC);
    return service.listScopes();
  }

  @GET
  @Path("/scopes/{scopeId}")
  public ScopeRecord getScope(
      @Context SecurityContext securityContext, @PathParam("scopeId") UUID scopeId) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    return scope;
  }

  @POST
  @Path("/scopes")
  public Response createScope(
      @Context SecurityContext securityContext, CreateScopeRequest request) {
    authorize(securityContext, null, MetadataOperation.CREATE_VERSION);
    ScopeRecord created =
        service.createScope(
            request.dataDictionaryVersionId(), securityContext.getUserPrincipal().getName());
    return Response.status(Response.Status.CREATED).entity(created).build();
  }

  @POST
  @Path("/scopes/{scopeId}/archive")
  public ScopeRecord archiveScope(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      RevisionRequest request) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.ARCHIVE_PUBLISHED);
    return service.archive(
        scopeId, request.expectedWorkingRevision(), securityContext.getUserPrincipal().getName());
  }

  @POST
  @Path("/scopes/{scopeId}/bootstrap")
  public Response retryBootstrap(
      @Context SecurityContext securityContext, @PathParam("scopeId") UUID scopeId) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.EDIT_WORKING);
    String actor = securityContext.getUserPrincipal().getName();
    org.openmetadata.service.util.AsyncService.getInstance()
        .execute(() -> service.bootstrap(scopeId, actor));
    return Response.accepted(scope).build();
  }

  @GET
  @Path("/scopes/{scopeId}/records")
  public Map<String, Object> listRecords(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @QueryParam("search") String search,
      @QueryParam("status") String status,
      @QueryParam("versionView") @DefaultValue("LATEST") String versionView,
      @QueryParam("limit") @DefaultValue("50") int limit,
      @QueryParam("offset") @DefaultValue("0") int offset) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    boolean includeWorking = can(securityContext, scope, MetadataOperation.EDIT_WORKING);
    List<RecordView> rows =
        service.listRecords(
            scopeId, search, status, "ALL_VERSIONS".equals(versionView), includeWorking);
    int safeLimit = Math.max(1, Math.min(limit, 200));
    int safeOffset = Math.max(0, offset);
    int from = Math.min(safeOffset, rows.size());
    int to = Math.min(from + safeLimit, rows.size());
    return Map.of(
        "data", rows.subList(from, to),
        "paging", Map.of("total", rows.size(), "limit", safeLimit, "offset", safeOffset),
        "scope", scope);
  }

  @GET
  @Path("/scopes/{scopeId}/records/{recordId}")
  public RecordView getRecord(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    return service.listRecords(
            scopeId, recordId.toString(), null, false,
            can(securityContext, scope, MetadataOperation.EDIT_WORKING)).stream()
        .filter(row -> recordId.equals(row.recordId()))
        .findFirst()
        .orElseThrow(
            () ->
                TechnicalDictionaryService.error(
                    Response.Status.NOT_FOUND, "COLUMN_NOT_FOUND", "Technical record was not found"));
  }

  @GET
  @Path("/scopes/{scopeId}/records/{recordId}/versions")
  public List<PublishedSnapshotRecord> listVersions(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    return versions.listPublished(GlossaryVersioningService.GLOSSARY_TERM, recordId).stream()
        .filter(row -> scope.technicalBusinessVersion().equals(row.parentBusinessVersion()))
        .toList();
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/versions")
  public WorkingVersionRecord createRecordVersion(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId) {
    ScopeRecord scope = requireActive(scopeId);
    authorize(securityContext, scope, MetadataOperation.CREATE_VERSION);
    PublishedSnapshotRecord latest =
        versions.getLatestPublishedInScope(
            GlossaryVersioningService.GLOSSARY_TERM,
            recordId,
            scope.technicalBusinessVersion());
    String[] parts = latest.businessVersion().split("\\.");
    if (parts.length != 2 || !parts[0].equals(scope.technicalBusinessVersion())) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT,
          "SCOPE_VERSION_MISMATCH",
          "Technical record version is outside its scope");
    }
    String nextVersion = parts[0] + "." + (Long.parseLong(parts[1]) + 1);
    return versions.createNextTermWorkingFromPublished(
        recordId,
        scope.technicalGlossaryId(),
        nextVersion,
        scope.technicalBusinessVersion(),
        latest.nativeVersion(),
        JsonUtils.readValue(latest.payload(), Map.class),
        securityContext.getUserPrincipal().getName(),
        published -> {
          if (!scope.technicalBusinessVersion().equals(published.parentBusinessVersion())) {
            throw TechnicalDictionaryService.error(
                Response.Status.CONFLICT,
                "SCOPE_VERSION_MISMATCH",
                "Approved record is outside the requested scope");
          }
        });
  }

  @PATCH
  @Path("/scopes/{scopeId}/records/{recordId}/working")
  public WorkingVersionRecord saveWorking(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId,
      SaveWorkingRequest request) {
    ScopeRecord scope = requireActive(scopeId);
    authorize(securityContext, scope, MetadataOperation.EDIT_WORKING);
    Map<String, Object> merged = mergeBusinessPayload(recordId, scope, request.businessFields());
    validateCdeRelation(scope, merged);
    return versions.saveWorking(
        GlossaryVersioningService.GLOSSARY_TERM,
        recordId,
        scope.technicalBusinessVersion(),
        request.expectedWorkingRevision(),
        null,
        merged,
        securityContext.getUserPrincipal().getName());
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/submit")
  public WorkingVersionRecord submit(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId,
      RevisionRequest request) {
    return transition(
        securityContext, scopeId, recordId, request, EntityStatus.DRAFT, EntityStatus.IN_REVIEW,
        MetadataOperation.SUBMIT_WORKING);
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/reject")
  public WorkingVersionRecord reject(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId,
      RevisionRequest request) {
    return transition(
        securityContext, scopeId, recordId, request, EntityStatus.IN_REVIEW, EntityStatus.REJECTED,
        MetadataOperation.APPROVE_WORKING);
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/reopen")
  public WorkingVersionRecord reopen(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId,
      RevisionRequest request) {
    return transition(
        securityContext, scopeId, recordId, request, EntityStatus.REJECTED, EntityStatus.DRAFT,
        MetadataOperation.EDIT_WORKING);
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/approve")
  public PublishedSnapshotRecord approve(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId,
      RevisionRequest request) {
    ScopeRecord scope = requireActive(scopeId);
    authorize(securityContext, scope, MetadataOperation.APPROVE_WORKING);
    return versions.publish(
        GlossaryVersioningService.GLOSSARY_TERM,
        recordId,
        scope.technicalBusinessVersion(),
        request.expectedWorkingRevision(),
        securityContext.getUserPrincipal().getName(),
        working -> validateCdeRelation(scope, JsonUtils.readValue(working.payload(), Map.class)),
        (handle, working, published) -> {
          TechnicalDictionaryDAO technicalDao = handle.attach(TechnicalDictionaryDAO.class);
          ColumnBindingRecord binding = technicalDao.findRecordBinding(scopeId, recordId);
          if (binding == null) {
            throw TechnicalDictionaryService.error(
                Response.Status.CONFLICT,
                "COLUMN_BINDING_CONFLICT",
                "Technical record is not bound to a Column in this scope");
          }
          technicalDao.insertProjectionEvent(
              UUID.randomUUID(),
              published.snapshotId(),
              scopeId,
              recordId,
              binding.columnId(),
              "TECHNICAL_RECORD_APPROVED",
              published.payload(),
              published.publishedAt());
        });
  }

  @POST
  @Path("/scopes/{scopeId}/records/{recordId}/revoke")
  public WorkingVersionRecord revoke(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @PathParam("recordId") UUID recordId) {
    ScopeRecord scope = requireActive(scopeId);
    authorize(securityContext, scope, MetadataOperation.APPROVE_WORKING);
    return versions.revokeLatestToRejectedWorking(
        GlossaryVersioningService.GLOSSARY_TERM,
        recordId,
        scope.technicalBusinessVersion(),
        securityContext.getUserPrincipal().getName());
  }

  @GET
  @Path("/scopes/{scopeId}/stats")
  public Map<String, Long> stats(
      @Context SecurityContext securityContext, @PathParam("scopeId") UUID scopeId) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    return service.stats(scopeId, can(securityContext, scope, MetadataOperation.EDIT_WORKING));
  }

  @GET
  @Path("/scopes/{scopeId}/cde-options")
  public Map<String, Object> cdeOptions(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @QueryParam("search") String search,
      @QueryParam("limit") @DefaultValue("25") int limit,
      @QueryParam("offset") @DefaultValue("0") int offset) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    List<TechnicalDictionaryService.CdeOption> data =
        service.cdeOptions(scopeId, search, limit, offset);
    return Map.of("data", data, "paging", Map.of("limit", limit, "offset", offset));
  }

  @GET
  @Path("/scopes/{scopeId}/export")
  @Produces(TechnicalDictionaryExcelExporter.XLSX_MEDIA_TYPE)
  public Response export(
      @Context SecurityContext securityContext,
      @PathParam("scopeId") UUID scopeId,
      @QueryParam("search") String search,
      @QueryParam("status") String status,
      @QueryParam("versionView") @DefaultValue("LATEST") String versionView) {
    ScopeRecord scope = service.getScope(scopeId);
    authorize(securityContext, scope, MetadataOperation.VIEW_BASIC);
    boolean includeWorking = can(securityContext, scope, MetadataOperation.EDIT_WORKING);
    List<RecordView> rows =
        service.listRecords(
            scopeId, search, status, "ALL_VERSIONS".equals(versionView), includeWorking);
    ExportedWorkbook workbook = null;
    try {
      workbook = TechnicalDictionaryExcelExporter.write(rows, scope.technicalBusinessVersion());
      java.nio.file.Path file = workbook.path();
      StreamingOutput stream =
          output -> {
            try {
              Files.copy(file, output);
            } finally {
              Files.deleteIfExists(file);
            }
          };
      String filename =
          "Technical_Dictionary_v"
              + scope.technicalBusinessVersion()
              + "_"
              + LocalDate.now()
              + ".xlsx";
      return Response.ok(stream, TechnicalDictionaryExcelExporter.XLSX_MEDIA_TYPE)
          .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
          .header("X-Exported-Row-Count", workbook.rowCount())
          .build();
    } catch (java.io.IOException exception) {
      if (workbook != null) {
        try {
          Files.deleteIfExists(workbook.path());
        } catch (java.io.IOException ignored) {
          // The temporary file is also registered for process cleanup by its owning directory.
        }
      }
      throw TechnicalDictionaryService.error(
          Response.Status.INTERNAL_SERVER_ERROR, "EXPORT_FAILED", "Technical export failed");
    }
  }

  private WorkingVersionRecord transition(
      SecurityContext securityContext,
      UUID scopeId,
      UUID recordId,
      RevisionRequest request,
      EntityStatus from,
      EntityStatus to,
      MetadataOperation operation) {
    ScopeRecord scope = requireActive(scopeId);
    authorize(securityContext, scope, operation);
    return versions.transition(
        GlossaryVersioningService.GLOSSARY_TERM,
        recordId,
        scope.technicalBusinessVersion(),
        request.expectedWorkingRevision(),
        from,
        to,
        securityContext.getUserPrincipal().getName(),
        working -> validateCdeRelation(scope, JsonUtils.readValue(working.payload(), Map.class)));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> mergeBusinessPayload(
      UUID recordId, ScopeRecord scope, Map<String, Object> changes) {
    WorkingVersionRecord current =
        versions.getWorking(
            GlossaryVersioningService.GLOSSARY_TERM,
            recordId,
            scope.technicalBusinessVersion());
    Map<String, Object> payload = JsonUtils.readValue(current.payload(), Map.class);
    if (changes != null) {
      for (Map.Entry<String, Object> entry : changes.entrySet()) {
        if (List.of(
                "id", "fullyQualifiedName", "glossary", "businessVersion",
                "parentBusinessVersion", "workingRevision", "snapshotId", "entityStatus",
                "createdAt", "createdBy", "updatedAt", "updatedBy", "submittedAt",
                "submittedBy", "publishedAt", "publishedBy", "archivedAt", "archivedBy")
            .contains(entry.getKey())) {
          continue;
        }
        if ("extension".equals(entry.getKey())
            && payload.get("extension") instanceof Map<?, ?> existing
            && entry.getValue() instanceof Map<?, ?> incoming) {
          Map<String, Object> mergedExtension = new java.util.LinkedHashMap<>();
          existing.forEach((key, value) -> mergedExtension.put(String.valueOf(key), value));
          incoming.forEach((key, value) -> mergedExtension.put(String.valueOf(key), value));
          payload.put("extension", mergedExtension);
        } else {
          payload.put(entry.getKey(), entry.getValue());
        }
      }
    }
    return payload;
  }

  @SuppressWarnings("unchecked")
  private void validateCdeRelation(ScopeRecord scope, Map<?, ?> payload) {
    Object extensionValue = payload.get("extension");
    if (extensionValue instanceof Map<?, ?> extension
        && extension.get("cdeDataDictionaryVersionId") != null
        && !scope.dataDictionaryVersionId()
            .toString()
            .equals(String.valueOf(extension.get("cdeDataDictionaryVersionId")))) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT,
          "SCOPE_MISMATCH",
          "CDE relation carries a different Data Dictionary version identity");
    }
    Object related = payload.get("relatedTerms");
    if (related == null) {
      return;
    }
    if (!(related instanceof List<?> relations) || relations.size() > 1) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT, "SCOPE_MISMATCH", "At most one exact CDE relation is allowed");
    }
    if (relations.isEmpty()) {
      return;
    }
    Object context = ((Map<?, ?>) relations.get(0)).get("versionContext");
    if (!(context instanceof Map<?, ?> versionContext)
        || versionContext.get("snapshotId") == null
        || !scope.dataDictionaryBusinessVersion()
            .equals(String.valueOf(versionContext.get("parentBusinessVersion")))) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT,
          "SCOPE_MISMATCH",
          "CDE relation must belong to the exact bound Data Dictionary scope");
    }
    PublishedSnapshotRecord cde =
        Entity.getJdbi()
            .onDemand(org.openmetadata.service.jdbi3.GlossaryVersionDAO.class)
            .findSnapshot(UUID.fromString(String.valueOf(versionContext.get("snapshotId"))));
    if (cde == null
        || !scope.dataDictionaryGlossaryId().equals(cde.glossaryId())
        || !scope.dataDictionaryBusinessVersion().equals(cde.parentBusinessVersion())
        || cde.archivedAt() != null) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT,
          cde == null ? "CDE_VERSION_NOT_FOUND" : "CDE_NOT_APPROVED",
          "CDE is not an active Approved version in the bound Data Dictionary scope");
    }
  }

  private ScopeRecord requireActive(UUID scopeId) {
    ScopeRecord scope = service.getScope(scopeId);
    if (!"Active".equals(scope.scopeStatus())) {
      throw TechnicalDictionaryService.error(
          Response.Status.CONFLICT, "SCOPE_NOT_ACTIVE", "Technical scope is not Active");
    }
    return scope;
  }

  private void authorize(
      SecurityContext securityContext, ScopeRecord scope, MetadataOperation operation) {
    UUID glossaryId = scope == null ? technicalGlossary().getId() : scope.technicalGlossaryId();
    authorizer.authorize(
        securityContext,
        new OperationContext(GLOSSARY, operation),
        new ResourceContext<>(GLOSSARY, glossaryId, null));
  }

  private boolean can(
      SecurityContext securityContext, ScopeRecord scope, MetadataOperation operation) {
    try {
      authorize(securityContext, scope, operation);
      return true;
    } catch (RuntimeException ignored) {
      return false;
    }
  }

  private Glossary technicalGlossary() {
    return service.listScopes().stream()
        .findFirst()
        .map(scope -> Entity.getEntity(GLOSSARY, scope.technicalGlossaryId(), "id,name", Include.ALL))
        .orElseGet(
            () ->
                Entity.getJdbi()
                    .onDemand(org.openmetadata.service.jdbi3.CollectionDAO.class)
                    .glossaryDAO()
                    .findEntityByName(
                        FullyQualifiedName.quoteName("Technical Dictionary"), Include.ALL));
  }

  public record CreateScopeRequest(UUID dataDictionaryVersionId) {}

  public record RevisionRequest(long expectedWorkingRevision) {}

  public record SaveWorkingRequest(
      long expectedWorkingRevision, Map<String, Object> businessFields) {}
}
