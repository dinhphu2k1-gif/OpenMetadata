/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.DqTestSpecs;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.dq.DqCatalog;
import org.openmetadata.service.glossary.dq.DqManagedGuard;
import org.openmetadata.service.glossary.dq.DqResultService;
import org.openmetadata.service.glossary.dq.DqRuleTestService;
import org.openmetadata.service.glossary.dq.DqTestOutbox;
import org.openmetadata.service.glossary.dq.DqTrendService;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Test execution of Data Quality Rules: declarations support (definitions, preview), schedule and
 * run of a Rule, results and trends of a Rule and of a CDE, and the reconcile administration.
 */
@Slf4j
@Path("/v1/glossaryTerms/dataQuality")
@Tag(name = "Glossaries", description = "Test execution and results of Data Quality Rules.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "dqRuleTests")
public class DqRuleTestResource {
  private static final String DEFAULT_LIMIT = "25";
  private static final int MAX_ERROR_BINDINGS = 50;

  private final Authorizer authorizer;
  private final DqRuleTestAccess access;

  public DqRuleTestResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.access = new DqRuleTestAccess(authorizer);
  }

  public record PreviewRequest(String cdeTermId, DqTestSpecs dataQualityTestSpecs) {}

  public record ScheduleRequest(String cron, String timezone) {}

  @GET
  @Path("/config")
  @Operation(operationId = "getDqRuleTestConfig", summary = "Feature flag and capabilities")
  public Map<String, Object> config(@Context SecurityContext securityContext) {
    final Map<String, Object> config = new LinkedHashMap<>(DqRuleTestService.config());
    config.put("capabilities", access.capabilities(securityContext).asMap());
    return config;
  }

  @GET
  @Path("/testDefinitions")
  @Operation(
      operationId = "listDqLibraryTestDefinitions",
      summary = "Column-level test definitions a library test may use")
  public List<Map<String, Object>> testDefinitions(@Context SecurityContext securityContext) {
    access.requireEdit(securityContext);
    return DqRuleTestService.libraryDefinitions();
  }

  @POST
  @Path("/preview")
  @Operation(
      operationId = "previewDqRuleTests",
      summary = "Columns of the CDE a set of test declarations would apply to")
  public Map<String, Object> preview(
      @Context SecurityContext securityContext, @Valid PreviewRequest request) {
    access.requireEdit(securityContext);
    return DqRuleTestService.preview(request.cdeTermId(), request.dataQualityTestSpecs());
  }

  @GET
  @Path("/rules/status")
  @Operation(
      operationId = "listDqRuleTestStatuses",
      summary = "Test result status of every effective Rule, for the list filter")
  public Map<String, String> ruleStatuses(@Context SecurityContext securityContext) {
    access.requireView(securityContext);
    return DqResultService.ruleStatuses();
  }

  @GET
  @Path("/rules/{ruleId}/results")
  @Operation(operationId = "getDqRuleResults", summary = "Results of the tests of a Rule")
  public Map<String, Object> ruleResults(
      @Context SecurityContext securityContext,
      @PathParam("ruleId") UUID ruleId,
      @QueryParam("specKey") String specKey,
      @DefaultValue("0") @QueryParam("offset") int offset,
      @DefaultValue(DEFAULT_LIMIT) @QueryParam("limit") int limit) {
    access.requireView(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqResultService.ruleResults(
        ruleId.toString(), specKey, tableViewer(securityContext), offset, limit);
  }

  @GET
  @Path("/rules/{ruleId}/trend")
  @Operation(operationId = "getDqRuleTrend", summary = "Daily pass rate of a Rule")
  public Map<String, Object> ruleTrend(
      @Context SecurityContext securityContext,
      @PathParam("ruleId") UUID ruleId,
      @DefaultValue("30") @QueryParam("days") int days,
      @QueryParam("specKey") String specKey) {
    access.requireView(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqTrendService.ruleTrend(ruleId.toString(), days, specKey);
  }

  @GET
  @Path("/rules/{ruleId}/schedule")
  @Operation(operationId = "getDqRuleSchedule", summary = "Schedule of a Rule")
  public Map<String, Object> schedule(
      @Context SecurityContext securityContext, @PathParam("ruleId") UUID ruleId) {
    access.requireView(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqRuleTestService.schedule(ruleId.toString());
  }

  @PUT
  @Path("/rules/{ruleId}/schedule")
  @Operation(operationId = "setDqRuleSchedule", summary = "Set or clear the schedule of a Rule")
  public Map<String, Object> setSchedule(
      @Context SecurityContext securityContext,
      @PathParam("ruleId") UUID ruleId,
      @Valid ScheduleRequest request) {
    access.requireEdit(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqRuleTestService.setSchedule(
        ruleId.toString(),
        request.cron(),
        request.timezone(),
        securityContext.getUserPrincipal().getName());
  }

  @POST
  @Path("/schedule/preview")
  @Operation(
      operationId = "previewDqRuleSchedule",
      summary = "Validate a schedule and list its next runs")
  public Map<String, Object> previewSchedule(
      @Context SecurityContext securityContext, @Valid ScheduleRequest request) {
    access.requireEdit(securityContext);
    return DqRuleTestService.previewSchedule(request.cron(), request.timezone());
  }

  @POST
  @Path("/rules/{ruleId}/run")
  @Operation(operationId = "runDqRuleTests", summary = "Run the tests of a Rule now")
  public Map<String, Object> run(
      @Context SecurityContext securityContext, @PathParam("ruleId") UUID ruleId) {
    access.requireEdit(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqRuleTestService.run(ruleId.toString(), securityContext.getUserPrincipal().getName());
  }

  @GET
  @Path("/rules/{ruleId}/run/latest")
  @Operation(operationId = "getDqRuleLatestRun", summary = "State of the latest run of a Rule")
  public Map<String, Object> latestRun(
      @Context SecurityContext securityContext, @PathParam("ruleId") UUID ruleId) {
    access.requireView(securityContext);
    DqCatalog.requireRule(ruleId);
    return DqRuleTestService.latestRun(ruleId.toString());
  }

  @GET
  @Path("/cdes/{cdeId}/results")
  @Operation(operationId = "getDqCdeResults", summary = "Results of all Rules of a CDE")
  public Map<String, Object> cdeResults(
      @Context SecurityContext securityContext,
      @PathParam("cdeId") UUID cdeId,
      @QueryParam("ruleId") String ruleId,
      @QueryParam("result") String result,
      @DefaultValue("0") @QueryParam("offset") int offset,
      @DefaultValue(DEFAULT_LIMIT) @QueryParam("limit") int limit) {
    access.requireView(securityContext);
    return DqResultService.cdeResults(
        cdeId.toString(), ruleId, result, tableViewer(securityContext), offset, limit);
  }

  @GET
  @Path("/cdes/{cdeId}/trend")
  @Operation(operationId = "getDqCdeTrend", summary = "Daily pass rate of a CDE")
  public Map<String, Object> cdeTrend(
      @Context SecurityContext securityContext,
      @PathParam("cdeId") UUID cdeId,
      @DefaultValue("30") @QueryParam("days") int days) {
    access.requireView(securityContext);
    return DqTrendService.cdeTrend(cdeId.toString(), days);
  }

  @GET
  @Path("/testCases/{testCaseId}/managedBy")
  @Operation(
      operationId = "getDqManagedTestCase",
      summary = "The Rule that manages a testcase, if any")
  public Map<String, Object> managedBy(
      @Context SecurityContext securityContext, @PathParam("testCaseId") UUID testCaseId) {
    final Map<String, Object> body = new LinkedHashMap<>();
    body.put("managed", false);
    DqManagedGuard.managedBy(testCaseId)
        .ifPresent(
            managed -> {
              body.put("managed", true);
              body.put("ruleId", managed.ruleId());
              body.put("ruleCode", managed.ruleCode());
              body.put("specKey", managed.specKey());
              body.put("specName", managed.specName());
            });
    return body;
  }

  @POST
  @Path("/reconcile")
  @Operation(operationId = "reconcileDqRuleTests", summary = "Reconcile every Rule (administrator)")
  public Map<String, Object> reconcileAll(@Context SecurityContext securityContext) {
    access.requireAdmin(securityContext);
    DqTestOutbox.enqueueAll(Entity.getJdbi().onDemand(DqRuleTestDAO.class));
    DqTestOutbox.drainAsync();
    return Map.of("queued", true);
  }

  @GET
  @Path("/reconcile/status")
  @Operation(operationId = "getDqReconcileStatus", summary = "Outbox lag and failed bindings")
  public Map<String, Object> reconcileStatus(@Context SecurityContext securityContext) {
    access.requireAdmin(securityContext);
    final DqRuleTestDAO dao = Entity.getJdbi().onDemand(DqRuleTestDAO.class);
    final Map<String, Object> status = new LinkedHashMap<>();
    status.put("outboxPending", DqTestOutbox.pendingCount());
    status.put("oldestPendingAt", DqTestOutbox.oldestPendingAt());
    status.put("rules", dao.listRuleExec().size());
    status.put(
        "pipelines", dao.listRuleExec().stream().filter(rule -> rule.pipelineId() != null).count());
    status.put("errorBindings", dao.countBindingsInState("ERROR"));
    status.put("errors", errorSample(dao));
    return status;
  }

  private static List<Map<String, Object>> errorSample(DqRuleTestDAO dao) {
    return dao.listBindingsInState("ERROR").stream()
        .limit(MAX_ERROR_BINDINGS)
        .map(
            binding -> {
              final Map<String, Object> entry = new LinkedHashMap<>();
              entry.put("ruleId", binding.ruleTermId());
              entry.put("specKey", binding.specKey());
              entry.put("columnFqn", binding.columnFqn());
              entry.put("reason", binding.stateReason());
              entry.put("lastError", binding.lastError());
              entry.put("attempts", binding.attempts());
              return entry;
            })
        .toList();
  }

  /** Whether the caller may see testcase rows of a Table: ViewTests (or ViewAll) on that Table. */
  private Predicate<String> tableViewer(SecurityContext securityContext) {
    final Map<String, Boolean> decisions = new HashMap<>();
    return tableFqn ->
        decisions.computeIfAbsent(tableFqn, fqn -> canViewTests(securityContext, fqn));
  }

  private boolean canViewTests(SecurityContext securityContext, String tableFqn) {
    boolean allowed = true;
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS),
          new ResourceContext<>(Entity.TABLE, null, tableFqn));
    } catch (AuthorizationException exception) {
      allowed = false;
    }
    return allowed;
  }
}
