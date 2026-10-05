/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.AuditRow;

/** Change history of Technical Dictionary records; rows outlive the records they describe. */
public final class TechnicalRecordAudit {
  public static final String CREATE = "CREATE";
  public static final String UPDATE = "UPDATE";
  public static final String APPROVE = "APPROVE";
  public static final String REJECT = "REJECT";
  public static final String RESUBMIT = "RESUBMIT";
  public static final String DELETE = "DELETE";
  public static final String IMPORT = "IMPORT";
  public static final String RESET = "RESET";

  private static final String FIELD = "field";
  private static final String OLD_VALUE = "oldValue";
  private static final String NEW_VALUE = "newValue";

  private TechnicalRecordAudit() {}

  /** Writes one audit row; {@code before} is null for a creation and {@code after} for a removal. */
  public static void record(
      TechnicalDictionaryDAO dao,
      String action,
      TechnicalRecord before,
      TechnicalRecord after,
      String dataDictionaryVersion,
      String actor) {
    final TechnicalRecord subject = after == null ? before : after;
    dao.insertAudit(
        new AuditRow(
            UUID.randomUUID().toString(),
            subject.id(),
            subject.columnFqn(),
            dataDictionaryVersion,
            action,
            JsonUtils.pojoToJson(changes(before, after)),
            actor,
            System.currentTimeMillis()));
  }

  /** The editable and source fields that differ, as {@code [{field, oldValue, newValue}]}. */
  static List<Map<String, Object>> changes(TechnicalRecord before, TechnicalRecord after) {
    final Map<String, String> from = fields(before);
    final Map<String, String> to = fields(after);
    final List<Map<String, Object>> changes = new ArrayList<>();
    to.keySet().stream()
        .filter(field -> !Objects.equals(from.get(field), to.get(field)))
        .forEach(field -> changes.add(change(field, from.get(field), to.get(field))));
    from.keySet().stream()
        .filter(field -> !to.containsKey(field))
        .forEach(field -> changes.add(change(field, from.get(field), null)));
    return changes;
  }

  private static Map<String, Object> change(String field, String oldValue, String newValue) {
    final Map<String, Object> change = new LinkedHashMap<>();
    change.put(FIELD, field);
    change.put(OLD_VALUE, oldValue);
    change.put(NEW_VALUE, newValue);
    return change;
  }

  private static Map<String, String> fields(TechnicalRecord record) {
    final Map<String, String> fields = new LinkedHashMap<>();
    if (record != null) {
      put(fields, "cde", record.cdeTermId());
      put(fields, "rank", record.rank());
      put(fields, "elementType", record.elementType());
      put(fields, "generationType", record.generationType());
      put(fields, "creationMethod", record.creationMethod());
      put(fields, "timeliness", record.timeliness());
      put(fields, "systemOwner", record.systemOwnerId());
      put(fields, "dataType", record.dataType());
      put(fields, "description", record.description());
      put(fields, "sourceStatus", record.sourceStatus());
      put(fields, "status", record.status());
      put(fields, "submittedAt", record.submittedAt());
      put(fields, "submittedBy", record.submittedBy());
      put(fields, "reviewedAt", record.reviewedAt());
      put(fields, "reviewedBy", record.reviewedBy());
      put(fields, "reviewComment", record.reviewComment());
    }
    return fields;
  }

  private static void put(Map<String, String> fields, String name, Object value) {
    if (value != null) {
      fields.put(name, String.valueOf(value));
    }
  }
}
