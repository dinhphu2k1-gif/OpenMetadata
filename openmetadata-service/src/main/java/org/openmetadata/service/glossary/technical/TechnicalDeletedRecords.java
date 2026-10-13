/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.List;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.DeletedRow;

/**
 * Approved records whose deletion was approved. The last Approved state is kept so it can still be
 * listed ("show deleted") and opened read-only until the next Data Dictionary cutover clears it.
 */
public final class TechnicalDeletedRecords {
  private TechnicalDeletedRecords() {}

  /** Keeps the Approved state of a record about to be deleted, in the caller's transaction. */
  public static void remember(
      final TechnicalDictionaryDAO dao,
      final TechnicalRecord record,
      final String dataDictionaryVersion,
      final String actor) {
    dao.insertDeleted(
        new DeletedRow(
            record.id(),
            record.columnFqn(),
            record.cdeTermId(),
            dataDictionaryVersion,
            JsonUtils.pojoToJson(record),
            System.currentTimeMillis(),
            actor));
  }

  /** Clears every kept record and queues the removal of their documents. */
  public static void clear(final TechnicalDictionaryDAO dao) {
    final List<String> ids = dao.listDeletedIds();
    dao.deleteAllDeleted();
    ids.forEach(id -> TechnicalOutbox.enqueueIndex(dao, id));
  }

  public static TechnicalRecord record(final DeletedRow deleted) {
    return JsonUtils.readValue(deleted.payload(), TechnicalRecord.class);
  }
}
