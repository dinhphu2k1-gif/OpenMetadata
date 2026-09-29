/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.events.lifecycle.handlers;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.glossary.technical.TechnicalColumnSync;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Propagates Table Column changes to Technical Dictionary records of open catalog versions. */
@Slf4j
public class TechnicalDictionaryColumnHandler implements EntityLifecycleEventHandler {
  public static final String HANDLER_NAME = "TechnicalDictionaryColumnHandler";
  private static final String COLUMNS_FIELD = "columns";

  private final TechnicalColumnSync sync = new TechnicalColumnSync();

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    if (entity instanceof Table table) {
      syncSafely(() -> sync.onTableChanged(table.getId(), List.of()), table);
    }
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (entity instanceof Table table) {
      syncSafely(
          () -> sync.onTableChanged(table.getId(), deletedColumns(changeDescription)), table);
    }
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    if (entity instanceof Table table) {
      syncSafely(
          isDeleted
              ? () -> sync.onTableRemoved(table)
              : () -> sync.onTableChanged(table.getId(), List.of()),
          table);
    }
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    if (entity instanceof Table table) {
      syncSafely(() -> sync.onTableRemoved(table), table);
    }
  }

  @Override
  public String getHandlerName() {
    return HANDLER_NAME;
  }

  static List<Column> deletedColumns(ChangeDescription changeDescription) {
    return changeDescription == null
        ? List.of()
        : listOrEmpty(changeDescription.getFieldsDeleted()).stream()
            .filter(change -> COLUMNS_FIELD.equals(change.getName()))
            .flatMap(change -> toColumns(change).stream())
            .toList();
  }

  private static List<Column> toColumns(FieldChange change) {
    final Object value = change.getOldValue();
    final String json = value instanceof String text ? text : JsonUtils.pojoToJson(value);
    return value == null ? List.of() : JsonUtils.readObjects(json, Column.class);
  }

  private static void syncSafely(Runnable action, Table table) {
    try {
      action.run();
    } catch (RuntimeException exception) {
      // Metadata ingestion must not fail because the Technical Dictionary projection lags behind.
      LOG.warn(
          "Technical Dictionary sync failed for table {}",
          table.getFullyQualifiedName(),
          exception);
    }
  }
}
