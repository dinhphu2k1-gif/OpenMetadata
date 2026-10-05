/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import com.fasterxml.jackson.core.type.TypeReference;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalColumnIndex;
import org.openmetadata.service.glossary.technical.TechnicalColumnIndex.ColumnDocument;
import org.openmetadata.service.glossary.technical.TechnicalColumnSource;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.glossary.technical.TechnicalExcelExporter;
import org.openmetadata.service.glossary.technical.TechnicalHistory;
import org.openmetadata.service.glossary.technical.TechnicalOutbox;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRecordDeclaration;
import org.openmetadata.service.glossary.technical.TechnicalRecordReview;
import org.openmetadata.service.glossary.technical.TechnicalRecordService;
import org.openmetadata.service.glossary.technical.TechnicalRecordUpdate;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentBuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexRebuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchCriteria;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchParameters;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchService;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.SnapshotRow;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.SnapshotSummary;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * The unversioned Technical Dictionary: list, statistics, Column declaration, editing, history,
 * export and the snapshots of replaced Data Dictionary versions. Lists are read from
 * `technical_dictionary_search_index`; every write goes to the database first and is then
 * synchronized to the index and to the Columns.
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
  private static final String DEFAULT_HISTORY_LIMIT = "20";
  private static final int MAX_HISTORY_LIMIT = 100;
  private static final String DATA = "data";
  private static final String EXPORT_FILE_STEM = "TuDienKyThuat_Agribank_TDDLv";

  private final TechnicalDictionaryAccess access;
  private final TechnicalSearchService searchService = new TechnicalSearchService();
  private final TechnicalRecordService recordService = new TechnicalRecordService();

  public TechnicalDictionaryResource(Authorizer authorizer) {
    this.access = new TechnicalDictionaryAccess(authorizer);
  }

  @GET
  @Path("/context")
  @Operation(
      operationId = "getTechnicalDictionaryContext",
      summary = "The bound Data Dictionary version, the last reset and the caller's capabilities")
  public Map<String, Object> context(@Context SecurityContext securityContext) {
    final TechnicalDictionaryAccess.Capabilities capabilities = access.requireView(securityContext);
    final TechnicalDictionaryDAO.StateRow state = TechnicalDictionaryState.row();
    final Map<String, Object> context = new LinkedHashMap<>();
    context.put("glossaryId", TechnicalCatalog.requireGlossary().getId());
    context.put("dataDictionaryVersion", TechnicalDictionaryState.activeVersion().orElse(null));
    context.put("previousDataDictionaryVersion", state.previousDataDictionaryVersion());
    context.put("resetAt", state.resetAt());
    context.put("resetBy", state.resetBy());
    context.put("capabilities", capabilities.asMap());
    return context;
  }

  @GET
  @Path("/search")
  @Operation(
      operationId = "searchTechnicalDictionaryRecords",
      summary = "Search the declared Columns of the Technical Dictionary")
  public Map<String, Object> search(
      @Context SecurityContext securityContext,
      @QueryParam("q") String q,
      @QueryParam("sourceServices") String sourceServices,
      @QueryParam("cdeMapping") String cdeMapping,
      @QueryParam("cdeTermIds") String cdeTermIds,
      @QueryParam("systemOwnerIds") String systemOwnerIds,
      @QueryParam("sourceStatuses") String sourceStatuses,
      @QueryParam("statuses") String statuses,
      @QueryParam("elementTypes") String elementTypes,
      @QueryParam("generationTypes") String generationTypes,
      @QueryParam("creationMethods") String creationMethods,
      @QueryParam("timeliness") String timeliness,
      @DefaultValue(DEFAULT_PAGE_SIZE) @QueryParam("limit") int limit,
      @DefaultValue("0") @QueryParam("offset") int offset) {
    access.requireView(securityContext);
    final Map<String, String> parameters =
        TechnicalSearchParameters.parameters(
            q,
            sourceServices,
            cdeMapping,
            cdeTermIds,
            systemOwnerIds,
            sourceStatuses,
            statuses,
            elementTypes,
            generationTypes,
            creationMethods,
            timeliness);
    final String version = requireVersion();
    TechnicalOutbox.flush();
    return searchService.search(
        TechnicalSearchParameters.criteria(version, parameters, limit, offset));
  }

  @GET
  @Path("/stats")
  @Operation(
      operationId = "getTechnicalDictionaryIndexStats",
      summary = "Declared Columns, tables, sources and mapped Columns")
  public Map<String, Long> stats(@Context SecurityContext securityContext) {
    access.requireView(securityContext);
    final String version = requireVersion();
    TechnicalOutbox.flush();
    return searchService.stats(TechnicalSearchCriteria.scopeOnly(version));
  }

  @GET
  @Path("/columns")
  @Operation(
      operationId = "searchTechnicalDictionaryColumns",
      summary = "Find physical Columns to declare; declared Columns are marked")
  public Map<String, Object> columns(
      @Context SecurityContext securityContext,
      @QueryParam("q") String q,
      @DefaultValue(DEFAULT_COLUMN_LIMIT) @Min(1) @Max(MAX_COLUMN_LIMIT) @QueryParam("limit")
          int limit) {
    access.requireEdit(securityContext);
    final List<ColumnDocument> columns = findColumns(q, limit);
    final Map<String, TechnicalRecord> declared = declaredRecords(columns);
    return Map.of(DATA, columns.stream().map(column -> columnView(column, declared)).toList());
  }

  @POST
  @Path("/records")
  @Operation(
      operationId = "declareTechnicalDictionaryColumn",
      summary = "Declare a Column and send the new record for independent approval")
  public Response declare(
      @Context SecurityContext securityContext, @NotNull TechnicalRecordDeclaration declaration) {
    access.requireEdit(securityContext);
    final TechnicalRecord created =
        recordService.declare(declaration, securityContext.getUserPrincipal().getName());
    return Response.status(Response.Status.CREATED).entity(row(created)).build();
  }

  @GET
  @Path("/records/{id}")
  @Operation(operationId = "getTechnicalDictionaryRecord", summary = "One declared Column")
  public Map<String, Object> get(
      @Context SecurityContext securityContext, @PathParam("id") UUID recordId) {
    access.requireView(securityContext);
    return row(requireRecord(recordId));
  }

  @PATCH
  @Path("/records/{id}")
  @Operation(
      operationId = "updateTechnicalDictionaryRecord",
      summary =
          "Replace editable values; rejected records return to review, approved edits are immediate")
  public Map<String, Object> update(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID recordId,
      @NotNull TechnicalRecordUpdate update) {
    access.requireEdit(securityContext);
    if (update.expectedRevision() == null) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "expectedRevision is required");
    }
    return row(
        recordService.update(
            recordId,
            update.expectedRevision(),
            update.values(),
            securityContext.getUserPrincipal().getName()));
  }

  @POST
  @Path("/records/{id}/approve")
  @Operation(operationId = "approveTechnicalDictionaryRecord", summary = "Approve a new record")
  public Map<String, Object> approve(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID recordId,
      @NotNull TechnicalRecordReview review) {
    access.requireApprove(securityContext);
    requireExpectedRevision(review);
    return row(
        recordService.approve(
            recordId, review.expectedRevision(), securityContext.getUserPrincipal().getName()));
  }

  @POST
  @Path("/records/{id}/reject")
  @Operation(operationId = "rejectTechnicalDictionaryRecord", summary = "Reject a new record")
  public Map<String, Object> reject(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID recordId,
      @NotNull TechnicalRecordReview review) {
    access.requireApprove(securityContext);
    requireExpectedRevision(review);
    return row(
        recordService.reject(
            recordId,
            review.expectedRevision(),
            review.comment(),
            securityContext.getUserPrincipal().getName()));
  }

  @DELETE
  @Path("/records/{id}")
  @Operation(
      operationId = "deleteTechnicalDictionaryRecord",
      summary = "Cancel the declaration of a Column")
  public Map<String, Object> delete(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID recordId,
      @NotNull @QueryParam("expectedRevision") Long expectedRevision) {
    access.requireEdit(securityContext);
    if (expectedRevision == null) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "expectedRevision is required");
    }
    recordService.delete(recordId, expectedRevision, securityContext.getUserPrincipal().getName());
    final Map<String, Object> result = new LinkedHashMap<>();
    result.put("termId", recordId);
    result.put("deleted", true);
    return result;
  }

  @GET
  @Path("/records/{id}/history")
  @Operation(
      operationId = "getTechnicalDictionaryRecordHistory",
      summary = "Who changed a record and when, newest first")
  public Map<String, Object> history(
      @Context SecurityContext securityContext,
      @PathParam("id") UUID recordId,
      @DefaultValue(DEFAULT_HISTORY_LIMIT) @Min(1) @Max(MAX_HISTORY_LIMIT) @QueryParam("limit")
          int limit,
      @DefaultValue("0") @Min(0) @QueryParam("offset") int offset) {
    access.requireView(securityContext);
    return new TechnicalHistory().page(recordId.toString(), limit, offset);
  }

  @GET
  @Path("/export")
  @Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Operation(
      operationId = "exportTechnicalDictionary",
      summary = "Export every declared Column of the Technical Dictionary as Excel")
  public Response export(@Context SecurityContext securityContext) {
    access.requireView(securityContext);
    final String version = requireVersion();
    TechnicalOutbox.flush();
    final TechnicalSearchCriteria criteria = TechnicalSearchCriteria.scopeOnly(version);
    return TechnicalWorkbookResponses.download(
        securityContext.getUserPrincipal().getName(),
        EXPORT_FILE_STEM + version,
        () ->
            TechnicalExcelExporter.write(visitor -> searchService.scanRows(criteria, visitor), ""));
  }

  @GET
  @Path("/snapshots")
  @Operation(
      operationId = "listTechnicalDictionarySnapshots",
      summary = "The frozen CDE bindings of replaced Data Dictionary versions")
  public Map<String, Object> snapshots(@Context SecurityContext securityContext) {
    access.requireView(securityContext);
    final List<Map<String, Object>> summaries =
        dao().listSnapshotSummaries().stream()
            .sorted(
                Comparator.comparing(
                        SnapshotSummary::dataDictionaryVersion, GlossaryBusinessVersion::compare)
                    .reversed())
            .map(TechnicalDictionaryResource::summary)
            .toList();
    return Map.of(DATA, summaries);
  }

  @GET
  @Path("/snapshots/{dataDictionaryVersion}/export")
  @Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Operation(
      operationId = "exportTechnicalDictionarySnapshot",
      summary = "Export the frozen bindings of one replaced Data Dictionary version")
  public Response exportSnapshot(
      @Context SecurityContext securityContext,
      @PathParam("dataDictionaryVersion") String version) {
    access.requireView(securityContext);
    return TechnicalWorkbookResponses.download(
        securityContext.getUserPrincipal().getName(),
        EXPORT_FILE_STEM + version + "_banchup",
        () -> TechnicalExcelExporter.write(visitor -> snapshotRows(version).forEach(visitor), ""));
  }

  @POST
  @Path("/index/rebuild")
  @Operation(
      operationId = "rebuildTechnicalDictionaryIndex",
      summary = "Rebuild the Technical Dictionary search index from the database")
  public Map<String, Object> rebuildIndex(@Context SecurityContext securityContext) {
    access.requireAdmin(securityContext);
    return TechnicalIndexRebuilder.rebuild();
  }

  private static String requireVersion() {
    return TechnicalDictionaryState.activeVersion()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.conflict(
                    TechnicalDictionaryErrors.DATA_DICTIONARY_NOT_ACTIVE,
                    "There is no active Approved Data Dictionary version"));
  }

  private static void requireExpectedRevision(TechnicalRecordReview review) {
    if (review.expectedRevision() == null) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "expectedRevision is required");
    }
  }

  private static TechnicalRecord requireRecord(UUID recordId) {
    final TechnicalRecord record = dao().findById(recordId.toString());
    if (record == null) {
      throw TechnicalDictionaryErrors.notFound(
          TechnicalDictionaryErrors.RECORD_NOT_FOUND,
          String.format("Technical Dictionary record %s was not found", recordId));
    }
    return record;
  }

  private static Map<String, Object> row(TechnicalRecord record) {
    return new TechnicalDocumentBuilder()
        .row(record, TechnicalDictionaryState.row().dataDictionaryVersion());
  }

  private static List<Map<String, Object>> snapshotRows(String version) {
    final List<Map<String, Object>> rows = new java.util.ArrayList<>();
    String after = "";
    List<SnapshotRow> page = dao().listSnapshotsAfter(version, after, SNAPSHOT_PAGE);
    while (!page.isEmpty()) {
      page.forEach(
          snapshot -> rows.add(JsonUtils.readValue(snapshot.payload(), new TypeReference<>() {})));
      after = page.getLast().recordId();
      page = dao().listSnapshotsAfter(version, after, SNAPSHOT_PAGE);
    }
    rows.sort(Comparator.comparing(row -> String.valueOf(row.get("columnFqn")).toLowerCase()));
    return rows;
  }

  private static final int SNAPSHOT_PAGE = 1_000;

  private static Map<String, Object> summary(SnapshotSummary summary) {
    final Map<String, Object> view = new LinkedHashMap<>();
    view.put("dataDictionaryVersion", summary.dataDictionaryVersion());
    view.put("bindings", summary.bindings());
    view.put("frozenAt", summary.frozenAt());
    return view;
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

  private static Map<String, TechnicalRecord> declaredRecords(List<ColumnDocument> columns) {
    final Map<String, TechnicalRecord> declared = new LinkedHashMap<>();
    if (!columns.isEmpty()) {
      dao()
          .findByColumnKeys(columns.stream().map(column -> column.toSource().columnKey()).toList())
          .forEach(record -> declared.put(record.columnKey(), record));
    }
    return declared;
  }

  private static Map<String, Object> columnView(
      ColumnDocument document, Map<String, TechnicalRecord> declared) {
    final TechnicalColumnSource column = document.toSource();
    final TechnicalRecord record = declared.get(column.columnKey());
    final Map<String, Object> view = new LinkedHashMap<>(column.sourceExtension());
    view.put("columnKey", column.columnKey());
    view.put("columnFqn", column.columnFqn());
    view.put("description", column.description());
    view.put("declared", record != null);
    view.put("termId", record == null ? null : record.id());
    return view;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
