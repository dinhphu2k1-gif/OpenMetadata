/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.StateRow;

/**
 * Applies a validated import plan in one database transaction. The transaction holds the state lock
 * exclusively, so the Data Dictionary version and the ranks cannot change underneath it. Every row
 * re-verifies the revision captured by the preview, so a stale preview fails as a whole, and the
 * ranks are checked on the final state.
 */
public final class TechnicalImportCommitter {
  private static final int FLUSH_BATCHES = 20;

  private final TechnicalRecordService service = new TechnicalRecordService();

  public record CommitResult(int committed, int pendingApproval, int updated) {}

  /** Returns written rows split between new records awaiting approval and effective updates. */
  public CommitResult commit(String previewVersion, List<PlannedRow> rows, String actor) {
    final List<PlannedRow> mutating = rows.stream().filter(PlannedRow::mutates).toList();
    CommitResult result = new CommitResult(0, 0, 0);
    try {
      result =
          Entity.getJdbi()
              .inTransaction(
                  handle ->
                      apply(
                          handle.attach(TechnicalDictionaryDAO.class),
                          previewVersion,
                          mutating,
                          actor));
    } catch (UnableToExecuteStatementException exception) {
      throw conflict("A record was changed concurrently while the import was committing");
    }
    TechnicalOutbox.flush(FLUSH_BATCHES);
    return result;
  }

  private CommitResult apply(
      TechnicalDictionaryDAO dao, String previewVersion, List<PlannedRow> rows, String actor) {
    final StateRow state = TechnicalRecordService.lockState(dao, true);
    final String version = TechnicalDictionaryState.requireActiveVersion(state);
    if (!version.equals(previewVersion)) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.IMPORT_SESSION_INVALID,
          "The Data Dictionary version changed after the preview; preview the file again");
    }
    final List<TechnicalRecord> touched = new ArrayList<>();
    rows.stream()
        .sorted(Comparator.comparing(PlannedRow::rowNumber))
        .forEach(row -> touched.add(write(dao, version, row, actor)));
    service.requireFinalRanks(dao, touched);
    final int pendingApproval = (int) touched.stream().filter(TechnicalRecord::isInReview).count();
    return new CommitResult(touched.size(), pendingApproval, touched.size() - pendingApproval);
  }

  private TechnicalRecord write(
      TechnicalDictionaryDAO dao, String version, PlannedRow row, String actor) {
    return TechnicalImportPlan.CREATE_RECORD.equals(row.action())
        ? declare(dao, version, row, actor)
        : update(dao, version, row, actor);
  }

  private TechnicalRecord declare(
      TechnicalDictionaryDAO dao, String version, PlannedRow row, String actor) {
    return service.create(
        dao,
        version,
        row.column(),
        TechnicalImportPatch.merge(TechnicalRecordValues.EMPTY, row.patch()),
        TechnicalRecordAudit.IMPORT,
        false,
        actor);
  }

  private TechnicalRecord update(
      TechnicalDictionaryDAO dao, String version, PlannedRow row, String actor) {
    final TechnicalRecord current = dao.findById(row.recordId());
    if (current == null || current.revision() != row.expectedRevision()) {
      throw conflict("Record " + row.location() + " changed after the preview");
    }
    return service.change(
        dao,
        version,
        current,
        TechnicalImportPatch.merge(TechnicalRecordValues.of(current), row.patch()),
        TechnicalRecordAudit.IMPORT,
        false,
        actor);
  }

  private static RuntimeException conflict(String message) {
    return TechnicalDictionaryErrors.conflict(TechnicalDictionaryErrors.IMPORT_CONFLICT, message);
  }
}
