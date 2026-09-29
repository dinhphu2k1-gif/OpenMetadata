/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO.JobRecord;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO.TableSourceRecord;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.util.AsyncService;

/**
 * Creates `N.0 Draft` Technical Dictionary records for every catalogued Column of one catalog
 * version. Jobs are idempotent and checkpointed; their status is operational and independent of
 * the catalog workflow status.
 */
@Slf4j
public class TechnicalBootstrapJobService {
  public static final String PENDING = "Pending";
  public static final String RUNNING = "Running";
  public static final String SUCCEEDED = "Succeeded";
  public static final String FAILED = "Failed";

  private static final int TABLE_BATCH_SIZE = 100;
  private static final int MAX_ERROR_SAMPLES = 50;

  private final TechnicalRecordWriter writer = new TechnicalRecordWriter();

  /** Creates the job for a catalog version if missing and runs it when pending. */
  public JobRecord start(Glossary technical, String parentBusinessVersion, String actor) {
    final TechnicalColumnScope scope = TechnicalCatalog.configuredColumnScope();
    if (scope.isEmpty()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.COLUMN_SCOPE_EMPTY,
          "technicalDictionary.includeServices is empty; no Column can be catalogued");
    }
    JobRecord job = dao().findJobForScope(technical.getId(), parentBusinessVersion);
    if (job == null) {
      dao()
          .insertJob(
              UUID.randomUUID(),
              technical.getId(),
              parentBusinessVersion,
              PENDING,
              scope.toJson(),
              now(),
              actor);
      job = dao().findJobForScope(technical.getId(), parentBusinessVersion);
    }
    runIfPending(job, actor);
    return job;
  }

  public JobRecord retry(UUID jobId, String actor) {
    if (dao().resetJob(jobId, FAILED, PENDING, now(), actor) != 1) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.BOOTSTRAP_NOT_READY,
          "Only a Failed bootstrap job can be retried");
    }
    final JobRecord job = dao().findJob(jobId);
    runIfPending(job, actor);
    return job;
  }

  /** Re-queues jobs interrupted by a restart and starts jobs for open scopes without one. */
  public void resumeOnStartup(Glossary technical) {
    for (JobRecord job : dao().listJobs(technical.getId())) {
      if (RUNNING.equals(job.status())) {
        dao().transitionJob(job.jobId(), RUNNING, PENDING, now(), TechnicalCatalog.SYSTEM_ACTOR);
      }
      runIfPending(dao().findJob(job.jobId()), TechnicalCatalog.SYSTEM_ACTOR);
    }
    startMissingJobs(technical);
  }

  public List<JobRecord> list(UUID glossaryId) {
    return dao().listJobs(glossaryId);
  }

  public JobRecord find(UUID jobId) {
    return dao().findJob(jobId);
  }

  void run(UUID jobId, String actor) {
    if (dao().transitionJob(jobId, PENDING, RUNNING, now(), actor) == 1) {
      final JobRecord job = dao().findJob(jobId);
      final Progress progress = new Progress();
      try {
        process(job, progress, actor);
      } catch (RuntimeException exception) {
        // A job-level failure must still leave a queryable Failed job instead of a stuck Running
        // one.
        LOG.error("Technical Dictionary bootstrap job {} failed", jobId, exception);
        progress.recordError("job", exception);
      }
      finish(job, progress, actor);
    }
  }

  private void startMissingJobs(Glossary technical) {
    for (String scope : TechnicalCatalog.openScopes(technical.getId())) {
      if (dao().findJobForScope(technical.getId(), scope) == null) {
        startSafely(technical, scope);
      }
    }
  }

  private void startSafely(Glossary technical, String scope) {
    try {
      start(technical, scope, TechnicalCatalog.SYSTEM_ACTOR);
    } catch (WebApplicationException exception) {
      LOG.warn(
          "Technical Dictionary bootstrap for version {} not started: {}",
          scope,
          exception.getMessage());
    }
  }

  private void runIfPending(JobRecord job, String actor) {
    if (job != null && PENDING.equals(job.status())) {
      AsyncService.getInstance().execute(() -> run(job.jobId(), actor));
    }
  }

  private void process(JobRecord job, Progress progress, String actor) {
    final Glossary technical = TechnicalCatalog.requireGlossary();
    final RunContext context =
        new RunContext(
            technical,
            job.parentBusinessVersion(),
            TechnicalColumnScope.fromJson(job.columnScopeSnapshot()),
            new HashSet<>(
                stateDao()
                    .listRecordNames(
                        TechnicalCatalog.recordHashPrefix(technical), job.parentBusinessVersion())),
            progress,
            actor);
    String after = job.checkpoint() == null ? "" : job.checkpoint();
    List<TableSourceRecord> batch = dao().listTablesAfter(after, TABLE_BATCH_SIZE);
    while (!batch.isEmpty()) {
      batch.forEach(row -> processTable(row, context));
      after = batch.getLast().id();
      saveProgress(job.jobId(), progress, after);
      batch = dao().listTablesAfter(after, TABLE_BATCH_SIZE);
    }
  }

  private void processTable(TableSourceRecord row, RunContext context) {
    final Table table = JsonUtils.readValue(row.json(), Table.class);
    if (context.scope().matches(table)) {
      TechnicalColumnSource.columnsOf(table).forEach(column -> processColumn(column, context));
    }
  }

  private void processColumn(TechnicalColumnSource column, RunContext context) {
    final Progress progress = context.progress();
    progress.total++;
    if (!context.existingKeys().add(column.columnKey())) {
      progress.skipped++;
    } else {
      createRecord(column, context);
    }
    progress.processed++;
  }

  private void createRecord(TechnicalColumnSource column, RunContext context) {
    final Progress progress = context.progress();
    try {
      if (writer.createDraft(
          context.technical(), context.parentBusinessVersion(), column, context.actor())) {
        progress.created++;
      } else {
        progress.skipped++;
      }
    } catch (RuntimeException exception) {
      // One malformed Column must not abort the other Columns; it is reported and retryable.
      LOG.warn(
          "Unable to create Technical Dictionary record for {}", column.columnFqn(), exception);
      progress.recordError(column.columnFqn(), exception);
    }
  }

  private void saveProgress(UUID jobId, Progress progress, String checkpoint) {
    dao()
        .updateProgress(
            jobId,
            progress.total,
            progress.processed,
            progress.created,
            progress.skipped,
            progress.failed,
            checkpoint,
            now());
  }

  private void finish(JobRecord job, Progress progress, String actor) {
    final String status = progress.failed == 0 ? SUCCEEDED : FAILED;
    dao().finishJob(job.jobId(), status, progress.errorsJson(), now(), actor);
    LOG.info(
        "Technical Dictionary bootstrap for version {} finished: status={}, created={}, skipped={}, failed={}",
        job.parentBusinessVersion(),
        status,
        progress.created,
        progress.skipped,
        progress.failed);
  }

  private static long now() {
    return System.currentTimeMillis();
  }

  private static TechnicalBootstrapJobDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalBootstrapJobDAO.class);
  }

  private static TechnicalSourceStateDAO stateDao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }

  private record RunContext(
      Glossary technical,
      String parentBusinessVersion,
      TechnicalColumnScope scope,
      Set<String> existingKeys,
      Progress progress,
      String actor) {}

  private static final class Progress {
    private long total;
    private long processed;
    private long created;
    private long skipped;
    private long failed;
    private final List<Map<String, String>> errors = new ArrayList<>();

    private void recordError(String source, RuntimeException exception) {
      failed++;
      if (errors.size() < MAX_ERROR_SAMPLES) {
        final Map<String, String> sample = new LinkedHashMap<>();
        sample.put("source", source);
        sample.put("error", exception.getClass().getSimpleName());
        sample.put("message", String.valueOf(exception.getMessage()));
        errors.add(sample);
      }
    }

    private String errorsJson() {
      return errors.isEmpty() ? null : JsonUtils.pojoToJson(errors);
    }
  }
}
