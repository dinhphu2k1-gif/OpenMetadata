/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * Keeps declared Technical Dictionary records aligned with Table metadata. Ingestion that changes
 * the type, length or description of a declared Column updates the record directly; a Column that
 * disappeared, or whose Table was removed or renamed, becomes {@code Unavailable}, and one that
 * returns becomes {@code Available} again. Nothing is created here: declaring a Column is a user
 * action.
 */
public class TechnicalColumnSync {
  private static final String TABLE_FIELDS = "columns";

  public void onTableChanged(UUID tableId, List<Column> removedColumns) {
    final Table table = Entity.getEntity(Entity.TABLE, tableId, TABLE_FIELDS, Include.ALL);
    if (Boolean.TRUE.equals(table.getDeleted())) {
      onTableRemoved(table);
    } else {
      final List<TechnicalColumnSource> current = TechnicalColumnSource.columnsOf(table);
      final List<TechnicalColumnSource> removed = removedSources(current, removedColumns);
      apply(current, removed);
    }
  }

  public void onTableRemoved(Table table) {
    apply(List.of(), TechnicalColumnSource.columnsOf(table));
  }

  private static List<TechnicalColumnSource> removedSources(
      List<TechnicalColumnSource> current, List<Column> removedColumns) {
    final List<String> currentKeys =
        current.stream().map(TechnicalColumnSource::columnKey).toList();
    return removedColumns.stream()
        .filter(column -> column.getFullyQualifiedName() != null)
        .map(TechnicalColumnSource::of)
        .filter(column -> !currentKeys.contains(column.columnKey()))
        .toList();
  }

  private void apply(List<TechnicalColumnSource> present, List<TechnicalColumnSource> missing) {
    final List<String> keys = new ArrayList<>();
    present.forEach(column -> keys.add(column.columnKey()));
    missing.forEach(column -> keys.add(column.columnKey()));
    if (!keys.isEmpty() && syncRecords(keys, present, missing)) {
      TechnicalOutbox.flush();
    }
  }

  /** Returns true when at least one record changed. */
  private boolean syncRecords(
      List<String> keys, List<TechnicalColumnSource> present, List<TechnicalColumnSource> missing) {
    return Entity.getJdbi()
        .inTransaction(
            handle -> {
              final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
              final String version =
                  TechnicalRecordService.lockState(dao, false).dataDictionaryVersion();
              final Map<String, TechnicalRecord> records =
                  dao.findByColumnKeys(keys).stream()
                      .collect(Collectors.toMap(TechnicalRecord::columnKey, Function.identity()));
              boolean changed = false;
              for (TechnicalColumnSource column : present) {
                changed |= refresh(dao, version, records.get(column.columnKey()), column);
              }
              for (TechnicalColumnSource column : missing) {
                changed |= markUnavailable(dao, version, records.get(column.columnKey()));
              }
              return changed;
            });
  }

  private boolean refresh(
      TechnicalDictionaryDAO dao,
      String version,
      TechnicalRecord record,
      TechnicalColumnSource column) {
    final boolean changed =
        record != null
            && (!column.isSnapshotOf(record)
                || !TechnicalDictionaryProfile.SOURCE_AVAILABLE.equals(record.sourceStatus()));
    if (changed) {
      save(
          dao,
          version,
          record,
          column
              .into(record.toBuilder())
              .sourceStatus(TechnicalDictionaryProfile.SOURCE_AVAILABLE)
              .build());
    }
    return changed;
  }

  private boolean markUnavailable(
      TechnicalDictionaryDAO dao, String version, TechnicalRecord record) {
    final boolean changed = record != null && record.isAvailable();
    if (changed) {
      save(
          dao,
          version,
          record,
          record.toBuilder().sourceStatus(TechnicalDictionaryProfile.SOURCE_UNAVAILABLE).build());
    }
    return changed;
  }

  private static void save(
      TechnicalDictionaryDAO dao, String version, TechnicalRecord before, TechnicalRecord source) {
    final TechnicalRecord after =
        source.toBuilder()
            .revision(before.revision() + 1)
            .updatedAt(System.currentTimeMillis())
            .updatedBy(TechnicalCatalog.SYSTEM_ACTOR)
            .build();
    dao.updateSource(after);
    TechnicalRecordAudit.record(
        dao, TechnicalRecordAudit.UPDATE, before, after, version, TechnicalCatalog.SYSTEM_ACTOR);
    TechnicalOutbox.enqueueRecord(dao, after);
  }
}
