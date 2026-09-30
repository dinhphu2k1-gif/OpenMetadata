/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

/**
 * Keeps declared Technical Dictionary records of open catalog versions aligned with Table
 * metadata: Draft snapshots are refreshed, and vanished or drifted Columns are tracked as
 * operational source state. Records whose source state changed are re-synchronized to the
 * Technical Dictionary index; no record is created here.
 */
public class TechnicalColumnSync {
  private static final String TABLE_FIELDS = "columns";

  private final TechnicalRecordWriter writer = new TechnicalRecordWriter();

  public void onTableChanged(UUID tableId, List<Column> removedColumns) {
    final Table table = Entity.getEntity(Entity.TABLE, tableId, TABLE_FIELDS, Include.ALL);
    final Set<UUID> changed = new LinkedHashSet<>();
    TechnicalCatalog.findGlossary()
        .ifPresent(
            technical ->
                TechnicalCatalog.openScopes(technical.getId())
                    .forEach(scope -> changed.addAll(sync(technical, scope, table, removedColumns))));
    TechnicalIndexSync.refresh(changed);
  }

  public void onTableRemoved(Table table) {
    final Set<UUID> changed = new LinkedHashSet<>();
    TechnicalCatalog.findGlossary()
        .ifPresent(
            technical ->
                TechnicalCatalog.openScopes(technical.getId())
                    .forEach(
                        scope ->
                            changed.addAll(
                                markUnavailable(
                                    technical, scope, TechnicalColumnSource.columnsOf(table)))));
    TechnicalIndexSync.refresh(changed);
  }

  private Set<UUID> sync(
      Glossary technical, String scope, Table table, List<Column> removedColumns) {
    final Set<UUID> changed = new LinkedHashSet<>();
    if (Boolean.TRUE.equals(table.getDeleted())) {
      changed.addAll(markUnavailable(technical, scope, TechnicalColumnSource.columnsOf(table)));
    } else {
      final List<TechnicalColumnSource> current = TechnicalColumnSource.columnsOf(table);
      final Map<String, UUID> records = recordsFor(technical, scope, current);
      final SourceStates states = new SourceStates(technical.getId(), scope);
      for (TechnicalColumnSource column : declared(current, records)) {
        final UUID termId = records.get(column.columnKey());
        if (refresh(states, termId, column)) {
          changed.add(termId);
        }
      }
      changed.addAll(markUnavailable(technical, scope, removedSources(table, removedColumns)));
    }
    return changed;
  }

  /** Returns true when the operational state of the record changed. */
  private boolean refresh(SourceStates states, UUID termId, TechnicalColumnSource column) {
    final boolean draftRefreshed =
        writer.refreshDraftSource(termId, states.scope(), column, TechnicalCatalog.SYSTEM_ACTOR);
    final boolean inSync =
        draftRefreshed || writer.isRepresentationInSync(termId, states.scope(), column);
    return states.apply(
        column,
        inSync ? TechnicalDictionaryProfile.SOURCE_AVAILABLE : TechnicalDictionaryProfile.SOURCE_CHANGED);
  }

  private static Set<UUID> markUnavailable(
      Glossary technical, String scope, List<TechnicalColumnSource> columns) {
    final Map<String, UUID> records = recordsFor(technical, scope, columns);
    final SourceStates states = new SourceStates(technical.getId(), scope);
    final Set<UUID> changed = new LinkedHashSet<>();
    for (TechnicalColumnSource column : declared(columns, records)) {
      if (states.apply(column, TechnicalDictionaryProfile.SOURCE_UNAVAILABLE)) {
        changed.add(records.get(column.columnKey()));
      }
    }
    return changed;
  }

  private static List<TechnicalColumnSource> declared(
      List<TechnicalColumnSource> columns, Map<String, UUID> records) {
    return columns.stream().filter(column -> records.containsKey(column.columnKey())).toList();
  }

  private static List<TechnicalColumnSource> removedSources(
      Table table, List<Column> removedColumns) {
    final List<String> currentKeys =
        TechnicalColumnSource.columnsOf(table).stream()
            .map(TechnicalColumnSource::columnKey)
            .toList();
    return removedColumns.stream()
        .filter(column -> column.getFullyQualifiedName() != null)
        .map(TechnicalColumnSource::of)
        .filter(column -> !currentKeys.contains(column.columnKey()))
        .toList();
  }

  private static Map<String, UUID> recordsFor(
      Glossary technical, String scope, List<TechnicalColumnSource> columns) {
    final List<String> keys = columns.stream().map(TechnicalColumnSource::columnKey).toList();
    return keys.isEmpty()
        ? Map.of()
        : stateDao().listRecordsByNames(TechnicalCatalog.recordHashPrefix(technical), keys).stream()
            .filter(identity -> scope.equals(identity.parentBusinessVersion()))
            .collect(
                Collectors.toMap(
                    RecordIdentity::columnKey, RecordIdentity::termId, (left, right) -> left));
  }

  private static TechnicalSourceStateDAO stateDao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }

  /** Source states of one scope, read once, so a write can tell whether a state changed. */
  private static final class SourceStates {
    private final UUID glossaryId;
    private final String scope;
    private final Map<String, String> before;

    private SourceStates(UUID glossaryId, String scope) {
      this.glossaryId = glossaryId;
      this.scope = scope;
      this.before = TechnicalSourceStates.statusesOf(glossaryId, scope);
    }

    private String scope() {
      return scope;
    }

    private boolean apply(TechnicalColumnSource column, String status) {
      if (TechnicalDictionaryProfile.SOURCE_AVAILABLE.equals(status)) {
        TechnicalSourceStates.clear(glossaryId, scope, column.columnKey());
      } else {
        TechnicalSourceStates.mark(glossaryId, scope, column.columnKey(), column.columnFqn(), status);
      }
      return !status.equals(
          before.getOrDefault(column.columnKey(), TechnicalDictionaryProfile.SOURCE_AVAILABLE));
    }
  }
}
