/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.glossary.technical.TechnicalImportCommitter;
import org.openmetadata.service.glossary.technical.TechnicalImportCommitter.CommitResult;
import org.openmetadata.service.glossary.technical.TechnicalImportLookupsImpl;
import org.openmetadata.service.glossary.technical.TechnicalImportService;
import org.openmetadata.service.glossary.technical.TechnicalImportService.PreviewScope;
import org.openmetadata.service.glossary.technical.TechnicalImportSheet;
import org.openmetadata.service.glossary.technical.TechnicalImportTables;
import org.openmetadata.service.glossary.technical.TechnicalOutbox;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.versioning.CdeImportService;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

/**
 * Import of Technical Dictionary values from Excel: template, preview and atomic commit. A file
 * can update declared Columns and declare Columns that have no record yet. The preview binds the
 * session to the Data Dictionary version it was planned against.
 */
@Slf4j
@Path("/v1/glossaryTerms/import/technical")
@Tag(name = "Glossaries", description = "Technical Dictionary Excel import.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "technicalDictionaryImport")
public class TechnicalDictionaryImportResource {
  private static final TechnicalImportService IMPORTS = new TechnicalImportService();

  private final TechnicalDictionaryAccess access;
  private final TechnicalImportCommitter committer = new TechnicalImportCommitter();

  public TechnicalDictionaryImportResource(Authorizer authorizer) {
    this.access = new TechnicalDictionaryAccess(authorizer);
  }

  @GET
  @Path("/template")
  @Produces(CdeImportService.XLSX_MEDIA_TYPE)
  @Operation(
      operationId = "downloadTechnicalDictionaryImportTemplate",
      summary = "Download the Technical Dictionary XLSX import template")
  public Response template(@Context SecurityContext securityContext) {
    access.requireView(securityContext);
    return Response.ok(IMPORTS.template(), CdeImportService.XLSX_MEDIA_TYPE)
        .header(
            "Content-Disposition",
            "attachment; filename=\"Agribank_TuDienKyThuat_Import_Template.xlsx\"")
        .build();
  }

  @POST
  @Path("/preview")
  @Consumes(MediaType.MULTIPART_FORM_DATA)
  @Operation(
      operationId = "previewTechnicalDictionaryImport",
      summary = "Validate and preview an atomic Technical Dictionary import")
  public Map<String, Object> preview(
      @Context SecurityContext securityContext,
      @FormDataParam("file") InputStream input,
      @FormDataParam("file") FormDataContentDisposition fileDetail) {
    access.requireEdit(securityContext);
    final String version = activeVersion();
    TechnicalOutbox.flush();
    final byte[] fileBytes =
        TechnicalImportSheet.readBytes(input, fileDetail == null ? -1 : fileDetail.getSize());
    return IMPORTS.preview(
        fileBytes,
        new PreviewScope(version, securityContext.getUserPrincipal().getName()),
        TechnicalDictionaryImportResource::declaredRecordsOfTables,
        new TechnicalImportLookupsImpl(version));
  }

  @POST
  @Path("/{importSessionId}/commit")
  @Operation(
      operationId = "commitTechnicalDictionaryImport",
      summary = "Commit a validated Technical Dictionary import atomically")
  public Map<String, Object> commit(
      @Context SecurityContext securityContext,
      @PathParam("importSessionId") UUID importSessionId) {
    final String actor = securityContext.getUserPrincipal().getName();
    return IMPORTS.commit(
        importSessionId,
        actor,
        session -> {
          access.requireEdit(securityContext);
          final CommitResult result =
              committer.commit(session.dataDictionaryVersion(), session.rows(), actor);
          LOG.info(
              "Technical Dictionary import committed actor={} importSessionId={} dataDictionaryVersion={} rows={} fileHash={}",
              actor,
              importSessionId,
              session.dataDictionaryVersion(),
              result.committed(),
              session.fileHash());
          return Map.of(
              "importSessionId", importSessionId,
              "committed", result.committed(),
              "pendingApproval", result.pendingApproval(),
              "updated", result.updated(),
              "dataDictionaryVersion", session.dataDictionaryVersion());
        });
  }

  private static String activeVersion() {
    return TechnicalDictionaryState.activeVersion()
        .orElseThrow(
            () ->
                org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors.conflict(
                    org.openmetadata.service.glossary.technical.TechnicalDictionaryErrors
                        .DATA_DICTIONARY_NOT_ACTIVE,
                    "There is no active Approved Data Dictionary version"));
  }

  /** Declared records of the tables named in the file. */
  private static List<TechnicalRecord> declaredRecordsOfTables(TechnicalImportSheet sheet) {
    final TechnicalDictionaryDAO dao = Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
    return TechnicalImportTables.of(sheet).stream()
        .flatMap(
            table ->
                dao
                    .listByTable(
                        lower(table.database()), lower(table.schema()), lower(table.table()))
                    .stream())
        .toList();
  }

  private static String lower(String value) {
    return value.trim().toLowerCase(Locale.ROOT);
  }
}
