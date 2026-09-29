/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO;
import org.openmetadata.service.jdbi3.TechnicalBootstrapJobDAO.JobRecord;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

/**
 * Keeps Technical Dictionary records of open catalog versions aligned with Table metadata: new
 * Columns get `N.0 Draft` records, Draft snapshots are refreshed, and vanished or drifted Columns
 * are tracked as operational source state.
 */
public class TechnicalColumnSync {
  private static final String TABLE_FIELDS = "columns";

  private final TechnicalRecordWriter writer = new TechnicalRecordWriter();

  public void onTableChanged(UUID tableId, List<Column> removedColumns) {
    final Table table = Entity.getEntity(Entity.TABLE, tableId, TABLE_FIELDS, Include.ALL);
    TechnicalCatalog.findGlossary()
        .ifPresent(
            technical ->
                openScopes(technical)
                    .forEach(scope -> sync(technical, scope, table, removedColumns)));
  }

  public void onTableRemoved(Table table) {
    TechnicalCatalog.findGlossary()
        .ifPresent(
            technical ->
                openScopes(technical)
                    .forEach(
                        scope ->
                            markUnavailable(
                                technical,
                                scope.version(),
                                TechnicalColumnSource.columnsOf(table))));
  }

  private void sync(Glossary technical, OpenScope scope, Table table, List<Column> removedColumns) {
    final List<TechnicalColumnSource> current = TechnicalColumnSource.columnsOf(table);
    if (scope.columnScope().matches(table)) {
      syncColumns(technical, scope.version(), current);
      markUnavailable(technical, scope.version(), removedSources(table, removedColumns));
    } else {
      markUnavailable(technical, scope.version(), current);
    }
  }

  private void syncColumns(Glossary technical, String scope, List<TechnicalColumnSource> columns) {
    final Map<String, UUID> records = recordsFor(technical, scope, columns);
    for (TechnicalColumnSource column : columns) {
      final UUID termId = records.get(column.columnKey());
      if (termId == null) {
        writer.createDraft(technical, scope, column, TechnicalCatalog.SYSTEM_ACTOR);
      } else {
        refresh(technical, scope, termId, column);
      }
    }
  }

  private void refresh(
      Glossary technical, String scope, UUID termId, TechnicalColumnSource column) {
    final boolean draftRefreshed =
        writer.refreshDraftSource(termId, scope, column, TechnicalCatalog.SYSTEM_ACTOR);
    if (draftRefreshed || writer.isRepresentationInSync(termId, scope, column)) {
      TechnicalSourceStates.clear(technical.getId(), scope, column.columnKey());
    } else {
      TechnicalSourceStates.mark(
          technical.getId(),
          scope,
          column.columnKey(),
          column.columnFqn(),
          TechnicalDictionaryProfile.SOURCE_CHANGED);
    }
  }

  private void markUnavailable(
      Glossary technical, String scope, List<TechnicalColumnSource> columns) {
    final Map<String, UUID> records = recordsFor(technical, scope, columns);
    columns.stream()
        .filter(column -> records.containsKey(column.columnKey()))
        .forEach(
            column ->
                TechnicalSourceStates.mark(
                    technical.getId(),
                    scope,
                    column.columnKey(),
                    column.columnFqn(),
                    TechnicalDictionaryProfile.SOURCE_UNAVAILABLE));
  }

  private static List<TechnicalColumnSource> removedSources(
      Table table, List<Column> removedColumns) {
    final List<String> currentKeys =
        TechnicalColumnSource.columnsOf(table).stream()
            .map(TechnicalColumnSource::columnKey)
            .toList();
    return removedColumns.stream()
        .filter(column -> column.getFullyQualifiedName() != null)
        .map(column -> TechnicalColumnSource.of(table, column))
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

  private static List<OpenScope> openScopes(Glossary technical) {
    return TechnicalCatalog.openScopes(technical.getId()).stream()
        .map(version -> openScope(technical, version))
        .flatMap(Optional::stream)
        .toList();
  }

  private static Optional<OpenScope> openScope(Glossary technical, String version) {
    final JobRecord job =
        Entity.getJdbi()
            .onDemand(TechnicalBootstrapJobDAO.class)
            .findJobForScope(technical.getId(), version);
    return job == null
        ? Optional.empty()
        : Optional.of(
            new OpenScope(version, TechnicalColumnScope.fromJson(job.columnScopeSnapshot())));
  }

  private static TechnicalSourceStateDAO stateDao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }

  private record OpenScope(String version, TechnicalColumnScope columnScope) {}
}
