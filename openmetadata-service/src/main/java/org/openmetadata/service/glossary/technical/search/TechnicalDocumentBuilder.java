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
import org.openmetadata.service.glossary.technical.TechnicalDictionaryState;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex.IndexAction;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

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

  /** One upsert per existing record and one delete per id that no longer has a record. */
  public List<IndexAction> build(Collection<String> recordIds) {
    final Map<String, TechnicalRecord> found = new LinkedHashMap<>();
    if (!recordIds.isEmpty()) {
      dao().findByIds(List.copyOf(recordIds)).forEach(record -> found.put(record.id(), record));
    }
    final List<IndexAction> actions = new ArrayList<>();
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    for (String id : recordIds) {
      final TechnicalRecord record = found.get(id);
      actions.add(
          record == null ? IndexAction.delete(id) : new IndexAction(id, row(record, version)));
    }
    return actions;
  }

  /** Upserts for records already read, used by the index rebuild. */
  public List<IndexAction> upserts(List<TechnicalRecord> records) {
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    return records.stream()
        .map(record -> new IndexAction(record.id(), row(record, version)))
        .toList();
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
    putSystemOwner(row, record.systemOwnerId());
    row.put(TechnicalIndexFields.CREATED_AT, record.createdAt());
    row.put(TechnicalIndexFields.CREATED_BY, record.createdBy());
    row.put(TechnicalIndexFields.UPDATED_AT, record.updatedAt());
    row.put(TechnicalIndexFields.UPDATED_BY, record.updatedBy());
    return row;
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

  private void putSystemOwner(Map<String, Object> row, String teamId) {
    if (teamId != null) {
      final Map<String, Object> owner = new LinkedHashMap<>();
      owner.put(TechnicalIndexFields.ID, teamId);
      owner.put(
          TechnicalIndexFields.NAME,
          team(teamId).map(TechnicalDocumentBuilder::label).orElse(teamId));
      row.put(TechnicalIndexFields.SYSTEM_OWNER, owner);
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

  private Optional<EntityReference> team(String teamId) {
    return teams.get(teamId, key -> lookupTeam(teamId));
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

  private static Optional<EntityReference> lookupTeam(String teamId) {
    Optional<EntityReference> team = Optional.empty();
    try {
      team =
          Optional.of(
              Entity.getEntityReferenceById(
                  Entity.TEAM, UUID.fromString(teamId), Include.NON_DELETED));
    } catch (EntityNotFoundException exception) {
      team = Optional.empty();
    }
    return team;
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

  /** Ids of every record referencing one of the CDEs, read from the database. */
  public static Set<String> recordIdsOfCdes(Collection<UUID> cdeIds) {
    return cdeIds.isEmpty()
        ? Set.of()
        : Set.copyOf(
            dao().listIdsByCde(cdeIds.stream().map(UUID::toString).collect(Collectors.toList())));
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
