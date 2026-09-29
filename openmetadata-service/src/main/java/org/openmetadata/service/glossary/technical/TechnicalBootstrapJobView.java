/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO.JobRecord;

/** Client-facing projection of a bootstrap job; internal ids and scope snapshots stay private. */
public final class TechnicalBootstrapJobView {
  private TechnicalBootstrapJobView() {}

  public static Map<String, Object> of(JobRecord job) {
    final Map<String, Object> view = new LinkedHashMap<>();
    view.put("jobId", job.jobId());
    view.put("businessVersion", job.parentBusinessVersion());
    view.put("status", job.status());
    view.put("total", job.total());
    view.put("processed", job.processed());
    view.put("created", job.created());
    view.put("skipped", job.skipped());
    view.put("failed", job.failed());
    view.put(
        "errors",
        job.errorSummary() == null ? null : JsonUtils.readValue(job.errorSummary(), Object.class));
    view.put("updatedAt", job.updatedAt());
    return view;
  }
}
