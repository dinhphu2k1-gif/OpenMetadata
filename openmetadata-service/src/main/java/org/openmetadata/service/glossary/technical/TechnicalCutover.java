/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.dq.DqTestOutbox;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentBuilder;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexFields;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.SnapshotRow;

/**
 * Refreshes the Technical Dictionary when the Data Dictionary replaces its active version. It runs
 * inside the Data Dictionary approval transaction: the records bound to a CDE are frozen as a
 * snapshot of the replaced version, every record is deleted, and the dictionary is bound to the new
 * version. A failure rolls the approval back, so the approver never sees the new version active
 * while the Technical Dictionary still references the old one.
 */
public final class TechnicalCutover {
  private static final int PAGE_SIZE = 500;
  private static final String FIRST_KEY = "";

  private TechnicalCutover() {}

  /**
   * Called for the approval of a glossary version. {@code previousVersion} is null for the first
   * approved version.
   */
  public static void onGlossaryPublished(
      Handle handle, UUID glossaryId, String previousVersion, String newVersion, String actor) {
    DqTestOutbox.onGlossaryPublished(handle, glossaryId);
    if (isDataDictionary(glossaryId)) {
      final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
      dao.lockStateExclusive();
      if (previousVersion == null) {
        dao.setActiveVersion(newVersion);
      } else {
        replace(dao, previousVersion, newVersion, actor);
      }
    }
  }

  private static void replace(
      TechnicalDictionaryDAO dao, String previousVersion, String newVersion, String actor) {
    final TechnicalDocumentBuilder rows = new TechnicalDocumentBuilder();
    final long now = System.currentTimeMillis();
    List<TechnicalRecord> page = dao.listAfter(FIRST_KEY, PAGE_SIZE);
    while (!page.isEmpty()) {
      page.forEach(record -> freeze(dao, rows, record, previousVersion, now, actor));
      page = page.size() < PAGE_SIZE ? List.of() : dao.listAfter(page.getLast().id(), PAGE_SIZE);
    }
    dao.deleteAllChangeRequests();
    dao.deleteAllRecords();
    dao.recordReset(newVersion, previousVersion, now, actor);
    TechnicalOutbox.enqueueReset(dao, previousVersion);
  }

  private static void freeze(
      TechnicalDictionaryDAO dao,
      TechnicalDocumentBuilder rows,
      TechnicalRecord record,
      String previousVersion,
      long now,
      String actor) {
    if (record.isApproved() && record.hasCde()) {
      dao.insertSnapshot(snapshot(rows.row(record, previousVersion), record, previousVersion, now));
    }
    TechnicalRecordAudit.record(
        dao, TechnicalRecordAudit.RESET, record, null, previousVersion, actor);
    final TechnicalRecordChangeRequest request = dao.findChangeRequest(record.id());
    if (request != null) {
      TechnicalRecordAudit.recordChange(
          dao,
          TechnicalRecordAudit.RESET_CHANGE,
          request,
          record,
          request.isDelete()
              ? null
              : proposed(record, TechnicalChangeRequestService.values(request)),
          previousVersion,
          actor);
    }
  }

  private static TechnicalRecord proposed(TechnicalRecord record, TechnicalRecordValues values) {
    return record.toBuilder()
        .cdeTermId(values.cde() == null ? null : values.cde().toString())
        .rank(values.rank())
        .elementType(values.elementType())
        .generationType(values.generationType())
        .creationMethod(values.creationMethod())
        .timeliness(values.timeliness())
        .systemOwnerId(TechnicalOwners.serialize(values.systemOwners()))
        .build();
  }

  private static SnapshotRow snapshot(
      Map<String, Object> row, TechnicalRecord record, String version, long frozenAt) {
    final Map<?, ?> cde =
        row.get(TechnicalIndexFields.CDE) instanceof Map<?, ?> value ? value : Map.of();
    return new SnapshotRow(
        version,
        record.id(),
        record.columnKey(),
        record.cdeTermId(),
        text(cde.get(TechnicalIndexFields.CODE)),
        text(cde.get(TechnicalIndexFields.NAME)),
        record.rank(),
        record.columnFqn(),
        JsonUtils.pojoToJson(row),
        frozenAt);
  }

  private static String text(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static boolean isDataDictionary(UUID glossaryId) {
    boolean result = false;
    try {
      result = TechnicalDictionaryState.dataDictionary().getId().equals(glossaryId);
    } catch (org.openmetadata.service.exception.EntityNotFoundException exception) {
      result = false;
    }
    return result;
  }

  /** Column FQNs removed by one reset, for tests and diagnostics. */
  static List<String> removedColumns(TechnicalDictionaryDAO dao, String version) {
    final List<String> columns = new ArrayList<>();
    String after = FIRST_KEY;
    List<TechnicalDictionaryDAO.AuditRow> page = dao.listResetAfter(version, after, PAGE_SIZE);
    while (!page.isEmpty()) {
      page.forEach(audit -> columns.add(audit.columnFqn()));
      after = page.getLast().id();
      page = dao.listResetAfter(version, after, PAGE_SIZE);
    }
    return columns;
  }
}
