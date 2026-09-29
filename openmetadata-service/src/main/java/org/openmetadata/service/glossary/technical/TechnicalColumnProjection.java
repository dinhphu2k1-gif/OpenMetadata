/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.NotFoundException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/**
 * Projects the governed Technical Dictionary state of one Column onto the Column itself: the
 * exact-scope CDE tag and the four managed classification tags. The database snapshot stays the
 * source of truth, so the projection is recomputed and idempotent for every outbox event.
 */
public class TechnicalColumnProjection {
  private static final String TABLE_FIELDS = "columns,tags";
  private static final String CDE_TAG_PREFIX = DataDictionaryResolver.DATA_DICTIONARY_NAME + ".";

  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  /** Recomputes the projection of the Column referenced by a changed Technical snapshot. */
  public void onSnapshotChanged(PublishedSnapshotRecord snapshot) {
    final GlossaryTerm changed = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
    final String columnFqn = sourceColumnFqn(changed);
    if (columnFqn != null) {
      apply(columnFqn, desiredTags(snapshot.glossaryId(), changed.getName()));
    }
  }

  static List<TagLabel> mergeManagedTags(List<TagLabel> current, List<TagLabel> desired) {
    final List<TagLabel> result = new ArrayList<>();
    listOrEmpty(current).stream().filter(tag -> !isManaged(tag)).forEach(result::add);
    result.addAll(desired);
    return result;
  }

  static boolean isManaged(TagLabel tag) {
    final boolean managedCde =
        tag.getSource() == TagLabel.TagSource.GLOSSARY
            && tag.getTagFQN() != null
            && tag.getTagFQN().startsWith(CDE_TAG_PREFIX);
    return managedCde || TechnicalDictionaryProfile.isManagedClassification(tag.getTagFQN());
  }

  private List<TagLabel> desiredTags(UUID glossaryId, String columnKey) {
    return currentRecord(glossaryId, columnKey).map(this::tagsOf).orElse(List.of());
  }

  /** The Approved, still-active record of the highest catalog version that has one. */
  private Optional<GlossaryTerm> currentRecord(UUID glossaryId, String columnKey) {
    final String prefix =
        FullyQualifiedName.buildHash(TechnicalCatalog.requireGlossary().getFullyQualifiedName())
            + ".%";
    return stateDao().listRecordsByNames(prefix, List.of(columnKey)).stream()
        .sorted(
            Comparator.comparing(
                RecordIdentity::parentBusinessVersion, GlossaryBusinessVersion::compare))
        .map(identity -> activeSnapshot(glossaryId, identity))
        .flatMap(Optional::stream)
        .reduce((lower, higher) -> higher)
        .map(snapshot -> JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class));
  }

  private Optional<PublishedSnapshotRecord> activeSnapshot(
      UUID glossaryId, RecordIdentity identity) {
    PublishedSnapshotRecord snapshot = null;
    try {
      final PublishedSnapshotRecord latest =
          versioningService.getLatestPublishedInScope(
              Entity.GLOSSARY_TERM, identity.termId(), identity.parentBusinessVersion());
      snapshot = latest.archivedAt() == null && isAvailable(glossaryId, identity) ? latest : null;
    } catch (NotFoundException exception) {
      snapshot = null;
    }
    return Optional.ofNullable(snapshot);
  }

  private static boolean isAvailable(UUID glossaryId, RecordIdentity identity) {
    final String status =
        TechnicalSourceStates.statusOf(
            glossaryId, identity.parentBusinessVersion(), identity.columnKey());
    return !TechnicalDictionaryProfile.SOURCE_UNAVAILABLE.equals(status);
  }

  private List<TagLabel> tagsOf(GlossaryTerm record) {
    final List<TagLabel> tags = new ArrayList<>();
    if (!nullOrEmpty(record.getRelatedTerms())
        && record.getRelatedTerms().getFirst().getTerm() != null) {
      tags.add(
          label(
              record.getRelatedTerms().getFirst().getTerm().getFullyQualifiedName(),
              TagLabel.TagSource.GLOSSARY));
    }
    listOrEmpty(record.getTags()).stream()
        .filter(tag -> TechnicalDictionaryProfile.isManagedClassification(tag.getTagFQN()))
        .forEach(tag -> tags.add(label(tag.getTagFQN(), TagLabel.TagSource.CLASSIFICATION)));
    return tags;
  }

  private static TagLabel label(String tagFqn, TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private void apply(String columnFqn, List<TagLabel> desired) {
    final String tableFqn = FullyQualifiedName.getParentFQN(columnFqn);
    final Table original = loadTable(tableFqn);
    if (original != null) {
      final Table updated = JsonUtils.deepCopy(original, Table.class);
      final Column column = findColumn(updated, columnFqn);
      if (column != null && !sameTags(column.getTags(), desired)) {
        column.setTags(mergeManagedTags(column.getTags(), desired));
        repository().update(null, original, updated, TechnicalCatalog.SYSTEM_ACTOR);
      }
    }
  }

  private static boolean sameTags(List<TagLabel> current, List<TagLabel> desired) {
    final List<String> present =
        listOrEmpty(current).stream()
            .filter(TechnicalColumnProjection::isManaged)
            .map(TagLabel::getTagFQN)
            .sorted()
            .toList();
    return present.equals(desired.stream().map(TagLabel::getTagFQN).sorted().toList());
  }

  private static Column findColumn(Table table, String columnFqn) {
    return listOrEmpty(table.getColumns()).stream()
        .filter(column -> columnFqn.equals(column.getFullyQualifiedName()))
        .findFirst()
        .orElse(null);
  }

  private static Table loadTable(String tableFqn) {
    Table table = null;
    try {
      table = Entity.getEntityByName(Entity.TABLE, tableFqn, TABLE_FIELDS, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      table = null;
    }
    return table;
  }

  private static String sourceColumnFqn(GlossaryTerm term) {
    final Object value =
        TechnicalRecordValidator.extension(term.getExtension())
            .get(TechnicalDictionaryProfile.SOURCE_COLUMN_FQN);
    return value == null ? null : String.valueOf(value);
  }

  private static TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private static TechnicalSourceStateDAO stateDao() {
    return Entity.getJdbi().onDemand(TechnicalSourceStateDAO.class);
  }
}
