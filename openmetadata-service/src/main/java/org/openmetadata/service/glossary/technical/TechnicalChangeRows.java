/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexFields;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * Lays an approved record that has a pending update out as two rows, as the Data Dictionary does:
 * the approved values, then the proposed values with the status of the change. Both keep the
 * record id; {@link #ROW_ROLE} tells them apart, and only the second carries the change. A pending delete has no proposed values and stays
 * one row.
 */
public final class TechnicalChangeRows {
  public static final String ROW_ROLE = "rowRole";
  public static final String APPROVED = "APPROVED";
  public static final String CHANGE = "CHANGE";

  private final TechnicalChangeRequestService requests;
  private final TechnicalDictionaryDAO dao;
  private final Function<TechnicalRecord, Map<String, Object>> rowBuilder;

  public TechnicalChangeRows(
      TechnicalChangeRequestService requests,
      TechnicalDictionaryDAO dao,
      Function<TechnicalRecord, Map<String, Object>> rowBuilder) {
    this.requests = requests;
    this.dao = dao;
    this.rowBuilder = rowBuilder;
  }

  /** Rows of a status filter keep only the halves of a pending update that show that status. */
  public List<Map<String, Object>> expand(List<Map<String, Object>> rows, List<String> statuses) {
    return statuses.isEmpty()
        ? expand(rows)
        : expand(rows).stream()
            .filter(row -> statuses.contains(String.valueOf(row.get(TechnicalIndexFields.STATUS))))
            .toList();
  }

  public List<Map<String, Object>> expand(List<Map<String, Object>> rows) {
    final List<String> pending =
        rows.stream()
            .filter(row -> Boolean.TRUE.equals(row.get(TechnicalIndexFields.HAS_PENDING_CHANGE)))
            .map(row -> String.valueOf(row.get(TechnicalIndexFields.TERM_ID)))
            .toList();
    if (pending.isEmpty()) {
      return rows;
    }
    final Map<String, TechnicalRecordChangeRequest> byRecord =
        dao.findChangeRequestsByRecordIds(pending).stream()
            .filter(TechnicalRecordChangeRequest::isUpdate)
            .collect(Collectors.toMap(TechnicalRecordChangeRequest::recordId, Function.identity()));
    final List<Map<String, Object>> expanded = new ArrayList<>();
    for (Map<String, Object> row : rows) {
      final TechnicalRecordChangeRequest request =
          byRecord.get(String.valueOf(row.get(TechnicalIndexFields.TERM_ID)));
      if (request == null) {
        expanded.add(row);
      } else {
        final Map<String, Object> approved = new LinkedHashMap<>(row);
        approved.put(ROW_ROLE, APPROVED);
        // The proposal belongs to the second row; this one is plain approved data.
        approved.put(TechnicalIndexFields.HAS_PENDING_CHANGE, false);
        approved.remove(TechnicalIndexFields.CHANGE_REQUEST_ID);
        approved.remove(TechnicalIndexFields.CHANGE_REQUEST_STATUS);
        approved.remove(TechnicalIndexFields.CHANGE_OPERATION);
        approved.remove(TechnicalIndexFields.CHANGE_CREATED_BY);
        expanded.add(approved);
        expanded.add(changeRow(request));
      }
    }
    return expanded;
  }

  private Map<String, Object> changeRow(TechnicalRecordChangeRequest request) {
    final TechnicalRecord proposed = requests.proposedRecord(request);
    final Map<String, Object> row = new LinkedHashMap<>(rowBuilder.apply(proposed));
    row.put(ROW_ROLE, CHANGE);
    row.put(TechnicalIndexFields.STATUS, recordStatus(request.status()));
    row.put(TechnicalIndexFields.REVISION, request.revision());
    row.put(TechnicalIndexFields.CREATED_BY, request.createdBy());
    row.put(TechnicalIndexFields.HAS_PENDING_CHANGE, true);
    row.put(TechnicalIndexFields.CHANGE_REQUEST_ID, request.id());
    row.put(TechnicalIndexFields.CHANGE_REQUEST_STATUS, request.status());
    row.put(TechnicalIndexFields.CHANGE_OPERATION, request.operation());
    row.put(TechnicalIndexFields.CHANGE_CREATED_BY, request.createdBy());
    return row;
  }

  private static String recordStatus(String changeStatus) {
    return TechnicalRecordChangeRequest.STATUS_IN_REVIEW.equals(changeStatus)
        ? TechnicalRecord.STATUS_IN_REVIEW
        : changeStatus;
  }
}
