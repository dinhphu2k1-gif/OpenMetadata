/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityStatus;

/**
 * Applies one workflow action to the working records selected by the caller, one bounded chunk per
 * call. Every record runs in its own transaction, so a failing record never blocks the others; the
 * caller repeats the call with the number of failures as offset until nothing is left.
 */
@Slf4j
public class GovernedBulkWorkflowService {
  public static final int DEFAULT_LIMIT = 500;
  public static final int MAX_LIMIT = 1_000;
  private static final int MAX_FAILURE_SAMPLES = 200;
  private static final String WORKING_RECORD = "working";

  private final Consumer<Collection<UUID>> sideEffectFlusher;

  public GovernedBulkWorkflowService() {
    this(
        ids ->
            new GlossaryVersioningService()
                .flushSideEffects(GlossaryVersioningService.GLOSSARY_TERM, ids));
  }

  GovernedBulkWorkflowService(Consumer<Collection<UUID>> sideEffectFlusher) {
    this.sideEffectFlusher = sideEffectFlusher;
  }

  /** Workflow actions with the record status each one applies to. */
  public enum Action {
    SUBMIT(EntityStatus.DRAFT),
    APPROVE(EntityStatus.IN_REVIEW),
    REJECT(EntityStatus.IN_REVIEW);

    private final EntityStatus requiredStatus;

    Action(EntityStatus requiredStatus) {
      this.requiredStatus = requiredStatus;
    }

    public EntityStatus requiredStatus() {
      return requiredStatus;
    }

    public static Action from(String value) {
      try {
        return valueOf(value.toUpperCase(Locale.ROOT));
      } catch (IllegalArgumentException | NullPointerException exception) {
        throw new BadRequestException("Unsupported bulk workflow action: " + value);
      }
    }
  }

  /** Bulk request body. Selection is by explicit ids and/or filter criteria. */
  public record Request(
      UUID glossaryId,
      String parentBusinessVersion,
      List<UUID> termIds,
      Map<String, String> criteria,
      Boolean dryRun,
      Integer offset,
      Integer limit) {

    public int effectiveOffset() {
      return offset == null || offset < 0 ? 0 : offset;
    }

    public int effectiveLimit() {
      return limit == null || limit < 1 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
    }

    public boolean isDryRun() {
      return Boolean.TRUE.equals(dryRun);
    }
  }

  /** Applies the action to one working row inside its own transaction. */
  @FunctionalInterface
  public interface RowAction {
    void apply(Map<String, Object> row, Set<UUID> chunkTermIds);
  }

  /** Returns an error code per term id that must not be attempted, decided for the whole chunk. */
  @FunctionalInterface
  public interface ChunkPrecheck extends Function<List<Map<String, Object>>, Map<UUID, String>> {}

  public Map<String, Object> run(
      Action action,
      Request request,
      List<Map<String, Object>> matchedRows,
      RowAction rowAction,
      ChunkPrecheck precheck) {
    final List<Map<String, Object>> eligible = eligibleRows(action, matchedRows);
    final int from = Math.min(request.effectiveOffset(), eligible.size());
    final List<Map<String, Object>> chunk =
        eligible.subList(from, Math.min(from + request.effectiveLimit(), eligible.size()));
    final Outcome outcome = new Outcome();
    if (!request.isDryRun()) {
      execute(chunk, rowAction, precheck, outcome);
    }
    return response(action, request, matchedRows.size(), eligible.size(), chunk, outcome);
  }

  public static UUID termId(Map<String, Object> row) {
    return UUID.fromString(String.valueOf(row.get("termId")));
  }

  private static List<Map<String, Object>> eligibleRows(
      Action action, List<Map<String, Object>> matchedRows) {
    return matchedRows.stream()
        .filter(row -> WORKING_RECORD.equals(row.get("recordType")))
        .filter(row -> action.requiredStatus().value().equals(row.get("entityStatus")))
        .toList();
  }

  private void execute(
      List<Map<String, Object>> chunk,
      RowAction rowAction,
      ChunkPrecheck precheck,
      Outcome outcome) {
    final Set<UUID> chunkIds =
        chunk.stream()
            .map(GovernedBulkWorkflowService::termId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    final Map<UUID, String> rejected = precheck == null ? Map.of() : precheck.apply(chunk);
    GlossaryVersioningService.runWithDeferredSideEffects(
        () -> chunk.forEach(row -> executeRow(row, chunkIds, rejected, rowAction, outcome)));
    sideEffectFlusher.accept(outcome.succeededIds);
  }

  private void executeRow(
      Map<String, Object> row,
      Set<UUID> chunkIds,
      Map<UUID, String> rejected,
      RowAction rowAction,
      Outcome outcome) {
    final UUID termId = termId(row);
    if (rejected.containsKey(termId)) {
      outcome.fail(termId, rejected.get(termId), "Rejected by the batch pre-check");
    } else {
      try {
        rowAction.apply(row, chunkIds);
        outcome.succeededIds.add(termId);
      } catch (WebApplicationException exception) {
        outcome.fail(termId, codeOf(exception), exception.getMessage());
      } catch (RuntimeException exception) {
        // A single record must not abort the batch; the failure is reported to the caller.
        LOG.warn("Bulk workflow failed for term {}", termId, exception);
        outcome.fail(termId, "INTERNAL_ERROR", String.valueOf(exception.getMessage()));
      }
    }
  }

  private static String codeOf(WebApplicationException exception) {
    return exception.getResponse().getEntity() instanceof Map<?, ?> body && body.get("code") != null
        ? String.valueOf(body.get("code"))
        : "HTTP_" + exception.getResponse().getStatus();
  }

  private static Map<String, Object> response(
      Action action,
      Request request,
      int matched,
      int eligible,
      List<Map<String, Object>> chunk,
      Outcome outcome) {
    final Map<String, Object> result = new LinkedHashMap<>();
    result.put("action", action.name());
    result.put("dryRun", request.isDryRun());
    result.put("matched", matched);
    result.put("eligible", eligible);
    result.put("ineligible", matched - eligible);
    result.put("attempted", request.isDryRun() ? 0 : chunk.size());
    result.put("succeeded", outcome.succeededIds.size());
    result.put("failedCount", outcome.failedCount);
    result.put("failures", outcome.failures);
    result.put("remaining", Math.max(0, eligible - request.effectiveOffset() - chunk.size()));
    return result;
  }

  private static final class Outcome {
    private final List<UUID> succeededIds = new ArrayList<>();
    private final List<Map<String, String>> failures = new ArrayList<>();
    private int failedCount;

    private void fail(UUID termId, String code, String message) {
      failedCount++;
      if (failures.size() < MAX_FAILURE_SAMPLES) {
        final Map<String, String> failure = new LinkedHashMap<>();
        failure.put("termId", termId.toString());
        failure.put("code", code);
        failure.put("message", message);
        failures.add(failure);
      }
    }
  }
}
