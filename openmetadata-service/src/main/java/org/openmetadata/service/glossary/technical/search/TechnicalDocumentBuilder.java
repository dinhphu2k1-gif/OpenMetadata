/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.technical.TechnicalCdeInfo;
import org.openmetadata.service.glossary.technical.TechnicalDeletedRecords;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.glossary.technical.TechnicalOwnerRef;
import org.openmetadata.service.glossary.technical.TechnicalOwners;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRecordChangeRequest;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex.IndexAction;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.DeletedRow;

/**
 * Builds the flat search documents of Technical Dictionary records. A document is always rebuilt
 * as a whole from the database, so writing it again is safe. The same flat shape is the row of the
 * list API and the payload of a Data Dictionary snapshot.
 */
public final class TechnicalDocumentBuilder {
  private static final int MAX_CACHED_REFERENCES = 2_000;

  private final Cache<String, TechnicalCdeInfo> cdes =
      Caffeine.newBuilder().maximumSize(MAX_CACHED_REFERENCES).build();
  private final Cache<String, Optional<String>> tagLabels =
      Caffeine.newBuilder().maximumSize(MAX_CACHED_REFERENCES).build();
  private final Cache<String, Optional<EntityReference>> teams =
      Caffeine.newBuilder().maximumSize(MAX_CACHED_REFERENCES).build();

  /**
   * One upsert per existing or deleted-and-kept record and one delete per id that has neither.
   */
  public List<IndexAction> build(Collection<String> recordIds) {
    final Map<String, TechnicalRecord> found = new LinkedHashMap<>();
    final Map<String, DeletedRow> deleted = new LinkedHashMap<>();
    if (!recordIds.isEmpty()) {
      final List<String> ids = List.copyOf(recordIds);
      dao().findByIds(ids).forEach(record -> found.put(record.id(), record));
      dao().findDeletedByIds(ids).forEach(row -> deleted.put(row.id(), row));
    }
    final List<IndexAction> actions = new ArrayList<>();
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    for (String id : recordIds) {
      actions.add(action(id, found.get(id), deleted.get(id), version));
    }
    return actions;
  }

  private IndexAction action(
      String id, TechnicalRecord record, DeletedRow deleted, String version) {
    final IndexAction action;
    if (record != null) {
      action = new IndexAction(id, row(record, version));
    } else if (deleted != null) {
      action = new IndexAction(id, deletedRow(deleted, version));
    } else {
      action = IndexAction.delete(id);
    }
    return action;
  }

  /** Upserts for records already read, used by the index rebuild. */
  public List<IndexAction> upserts(List<TechnicalRecord> records) {
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    return records.stream()
        .map(record -> new IndexAction(record.id(), row(record, version)))
        .toList();
  }

  /** Upserts for deleted records already read, used by the index rebuild. */
  public List<IndexAction> deletedUpserts(List<DeletedRow> rows) {
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    return rows.stream()
        .map(deleted -> new IndexAction(deleted.id(), deletedRow(deleted, version)))
        .toList();
  }

  /** The last Approved row of a deleted record, read-only and without a pending change. */
  public Map<String, Object> deletedRow(DeletedRow deleted, String dataDictionaryVersion) {
    final Map<String, Object> row =
        row(TechnicalDeletedRecords.record(deleted), dataDictionaryVersion);
    row.put(TechnicalIndexFields.HAS_PENDING_CHANGE, false);
    row.remove(TechnicalIndexFields.CHANGE_REQUEST_ID);
    row.remove(TechnicalIndexFields.CHANGE_REQUEST_STATUS);
    row.remove(TechnicalIndexFields.CHANGE_OPERATION);
    row.remove(TechnicalIndexFields.CHANGE_CREATED_BY);
    row.put(TechnicalIndexFields.DELETED, true);
    row.put(TechnicalIndexFields.DELETED_AT, deleted.deletedAt());
    row.put(TechnicalIndexFields.DELETED_BY, deleted.deletedBy());
    return row;
  }

  /** The flat row of one record in the given Data Dictionary version. */
  public Map<String, Object> row(TechnicalRecord record, String dataDictionaryVersion) {
    final Map<String, Object> row = new LinkedHashMap<>();
    row.put(TechnicalIndexFields.TERM_ID, record.id());
    row.put(TechnicalIndexFields.COLUMN_KEY, record.columnKey());
    row.put(TechnicalIndexFields.COLUMN_FQN, record.columnFqn());
    putLocation(row, record);
    putSource(row, record);
    row.put(TechnicalIndexFields.DATA_DICTIONARY_VERSION, dataDictionaryVersion);
    row.put(TechnicalIndexFields.REVISION, record.revision());
    row.put(TechnicalIndexFields.STATUS, record.status());
    putIfPresent(row, TechnicalIndexFields.SUBMITTED_AT, record.submittedAt());
    putIfPresent(row, TechnicalIndexFields.SUBMITTED_BY, record.submittedBy());
    putIfPresent(row, TechnicalIndexFields.REVIEWED_AT, record.reviewedAt());
    putIfPresent(row, TechnicalIndexFields.REVIEWED_BY, record.reviewedBy());
    putIfPresent(row, TechnicalIndexFields.REVIEW_COMMENT, record.reviewComment());
    putCde(row, record, dataDictionaryVersion);
    putIfPresent(row, TechnicalIndexFields.RANK, record.rank());
    putTag(row, TechnicalIndexFields.ELEMENT_TYPE, record.elementType());
    putTag(row, TechnicalIndexFields.GENERATION_TYPE, record.generationType());
    putTag(row, TechnicalIndexFields.CREATION_METHOD, record.creationMethod());
    putTag(row, TechnicalIndexFields.TIMELINESS, record.timeliness());
    putSystemOwners(row, record.systemOwnerId());
    row.put(TechnicalIndexFields.CREATED_AT, record.createdAt());
    row.put(TechnicalIndexFields.CREATED_BY, record.createdBy());
    row.put(TechnicalIndexFields.UPDATED_AT, record.updatedAt());
    row.put(TechnicalIndexFields.UPDATED_BY, record.updatedBy());
    putChangeRequest(row, record.id());
    return row;
  }

  private static void putChangeRequest(Map<String, Object> row, String recordId) {
    final TechnicalRecordChangeRequest request = dao().findChangeRequest(recordId);
    row.put(TechnicalIndexFields.HAS_PENDING_CHANGE, request != null);
    if (request != null) {
      row.put(TechnicalIndexFields.CHANGE_REQUEST_ID, request.id());
      row.put(TechnicalIndexFields.CHANGE_REQUEST_STATUS, request.status());
      row.put(TechnicalIndexFields.CHANGE_OPERATION, request.operation());
      row.put(TechnicalIndexFields.CHANGE_CREATED_BY, request.createdBy());
    }
  }

  private static void putLocation(Map<String, Object> row, TechnicalRecord record) {
    putIfPresent(row, TechnicalIndexFields.SERVICE, record.sourceService());
    putIfPresent(row, TechnicalIndexFields.DATABASE, record.sourceDatabase());
    putIfPresent(row, TechnicalIndexFields.SCHEMA, record.sourceSchema());
    putIfPresent(row, TechnicalIndexFields.TABLE, record.sourceTable());
    putIfPresent(row, TechnicalIndexFields.COLUMN, record.sourceColumn());
    row.put(TechnicalIndexFields.TABLE_KEY, tableKey(record));
  }

  private static void putSource(Map<String, Object> row, TechnicalRecord record) {
    putIfPresent(row, TechnicalIndexFields.DATA_TYPE, record.dataType());
    putIfPresent(row, TechnicalIndexFields.DATA_LENGTH, record.dataLength());
    putIfPresent(row, TechnicalIndexFields.PRECISION, record.dataPrecision());
    putIfPresent(row, TechnicalIndexFields.SCALE, record.dataScale());
    putIfPresent(row, TechnicalIndexFields.DESCRIPTION, record.description());
    row.put(TechnicalIndexFields.SOURCE_STATUS, record.sourceStatus());
  }

  private void putCde(Map<String, Object> row, TechnicalRecord record, String version) {
    if (record.hasCde()) {
      final TechnicalCdeInfo info = cde(record.cdeTermId(), version);
      final Map<String, Object> cde = new LinkedHashMap<>();
      cde.put(TechnicalIndexFields.ID, record.cdeTermId());
      cde.put(TechnicalIndexFields.CODE, info.code());
      cde.put(TechnicalIndexFields.NAME, info.name());
      cde.put(TechnicalIndexFields.BUSINESS_VERSION, info.businessVersion());
      putIfPresent(cde, TechnicalIndexFields.ASSIGNED_AT, record.cdeAssignedAt());
      putIfPresent(cde, TechnicalIndexFields.ASSIGNED_BY, record.cdeAssignedBy());
      row.put(TechnicalIndexFields.CDE, cde);
      row.put(TechnicalIndexFields.DATA_OWNERS, owners(info));
    }
  }

  private static List<Map<String, Object>> owners(TechnicalCdeInfo info) {
    return info.owners().stream()
        .map(
            owner -> {
              final Map<String, Object> value = new LinkedHashMap<>();
              value.put(TechnicalIndexFields.ID, String.valueOf(owner.getId()));
              value.put(TechnicalIndexFields.NAME, label(owner));
              return value;
            })
        .toList();
  }

  private void putTag(Map<String, Object> row, String field, String tagFqn) {
    if (!nullOrEmpty(tagFqn)) {
      final Map<String, Object> tag = new LinkedHashMap<>();
      tag.put(TechnicalIndexFields.FQN, tagFqn);
      tag.put(TechnicalIndexFields.LABEL, tagLabel(tagFqn));
      row.put(field, tag);
    }
  }

  private void putSystemOwners(Map<String, Object> row, String stored) {
    final List<Map<String, Object>> owners = new ArrayList<>();
    for (TechnicalOwnerRef ref : TechnicalOwners.parse(stored)) {
      final Optional<EntityReference> found = owner(ref);
      if (found.isPresent()) {
        final Map<String, Object> owner = new LinkedHashMap<>();
        owner.put(TechnicalIndexFields.ID, ref.id().toString());
        owner.put(TechnicalIndexFields.NAME, label(found.get()));
        owner.put(TechnicalIndexFields.TYPE, ref.entityType());
        owners.add(owner);
      }
    }
    if (!owners.isEmpty()) {
      row.put(TechnicalIndexFields.SYSTEM_OWNERS, owners);
    }
  }

  private TechnicalCdeInfo cde(String cdeId, String version) {
    return cdes.get(
        cdeId + "@" + version, key -> TechnicalCdeInfo.resolve(UUID.fromString(cdeId), version));
  }

  private String tagLabel(String tagFqn) {
    return tagLabels
        .get(tagFqn, key -> lookupTag(tagFqn).map(TechnicalDocumentBuilder::label))
        .orElse(lastSegment(tagFqn));
  }

  private Optional<EntityReference> owner(TechnicalOwnerRef ref) {
    return teams.get(ref.entityType() + ":" + ref.id(), key -> lookupOwner(ref));
  }

  private static Optional<EntityReference> lookupTag(String tagFqn) {
    Optional<EntityReference> tag = Optional.empty();
    try {
      tag = Optional.of(Entity.getEntityReferenceByName(Entity.TAG, tagFqn, Include.NON_DELETED));
    } catch (EntityNotFoundException exception) {
      tag = Optional.empty();
    }
    return tag;
  }

  private static Optional<EntityReference> lookupOwner(TechnicalOwnerRef ref) {
    Optional<EntityReference> owner = Optional.empty();
    try {
      owner =
          Optional.of(
              Entity.getEntityReferenceById(ref.entityType(), ref.id(), Include.NON_DELETED));
    } catch (EntityNotFoundException exception) {
      owner = Optional.empty();
    }
    return owner;
  }

  static String tableKey(TechnicalRecord record) {
    return String.join(
            ".",
            nullToEmpty(record.sourceDatabase()),
            nullToEmpty(record.sourceSchema()),
            nullToEmpty(record.sourceTable()))
        .toLowerCase(Locale.ROOT);
  }

  private static String label(EntityReference reference) {
    return nullOrEmpty(reference.getDisplayName())
        ? reference.getName()
        : reference.getDisplayName();
  }

  private static String lastSegment(String fqn) {
    return fqn.substring(fqn.lastIndexOf('.') + 1);
  }

  private static String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }

  /** Ids of every record, kept deleted ones included, referencing one of the CDEs. */
  public static Set<String> recordIdsOfCdes(Collection<UUID> cdeIds) {
    final Set<String> ids = new HashSet<>();
    if (!cdeIds.isEmpty()) {
      final List<String> cdes = cdeIds.stream().map(UUID::toString).collect(Collectors.toList());
      ids.addAll(dao().listIdsByCde(cdes));
      ids.addAll(dao().listDeletedIdsByCde(cdes));
    }
    return Set.copyOf(ids);
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
