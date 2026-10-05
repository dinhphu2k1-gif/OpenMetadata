/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.DataDictionaryResolver;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Projects the state of a Technical Dictionary record onto its physical Column: the CDE tag and the
 * four managed classification tags. The record in the database is the source of truth, so a
 * projection is recomputed from it and is idempotent. A Column without a record, or whose source is
 * unavailable, carries no managed tag.
 */
public class TechnicalColumnProjection {
  private static final String TABLE_FIELDS = "columns,tags";
  private static final String CDE_TAG_PREFIX = DataDictionaryResolver.DATA_DICTIONARY_NAME + ".";

  /** Recomputes the managed tags of the given Columns, updating each Table once. */
  public void projectColumns(Collection<String> columnFqns) {
    final Map<String, List<String>> byTable =
        columnFqns.stream()
            .distinct()
            .collect(
                Collectors.groupingBy(
                    FullyQualifiedName::getParentFQN, LinkedHashMap::new, Collectors.toList()));
    byTable.forEach(this::projectTable);
  }

  private void projectTable(String tableFqn, List<String> columnFqns) {
    final Table original = loadTable(tableFqn);
    if (original != null) {
      final Table updated = JsonUtils.deepCopy(original, Table.class);
      final Map<String, TechnicalRecord> records = recordsOf(columnFqns);
      final boolean changed =
          columnFqns.stream()
              .map(fqn -> apply(updated, fqn, desiredTags(records.get(fqn))))
              .reduce(false, Boolean::logicalOr);
      if (changed) {
        // A PATCH replaces the tags; a PUT would merge them with the stored ones, so a tag could
        // never be
        // removed and a changed value of a mutually exclusive classification would be rejected.
        repository()
            .patch(
                null,
                original.getId(),
                TechnicalCatalog.SYSTEM_ACTOR,
                JsonUtils.getJsonPatch(original, updated));
      }
    }
  }

  private boolean apply(Table table, String columnFqn, List<TagLabel> desired) {
    final Column column = findColumn(table, columnFqn);
    boolean changed = false;
    if (column != null && !sameTags(column.getTags(), desired)) {
      column.setTags(mergeManagedTags(column.getTags(), desired));
      changed = true;
    }
    return changed;
  }

  private static Map<String, TechnicalRecord> recordsOf(List<String> columnFqns) {
    final Map<String, TechnicalRecord> byFqn = new LinkedHashMap<>();
    dao()
        .findByColumnKeys(columnFqns.stream().map(TechnicalColumnSource::columnKey).toList())
        .forEach(record -> byFqn.put(record.columnFqn(), record));
    return byFqn;
  }

  private static List<TagLabel> desiredTags(TechnicalRecord record) {
    final List<TagLabel> tags = new ArrayList<>();
    if (record != null && record.isApproved() && record.isAvailable()) {
      cdeTag(record).ifPresent(tags::add);
      Stream.of(
              record.elementType(),
              record.generationType(),
              record.creationMethod(),
              record.timeliness())
          .filter(fqn -> fqn != null && !fqn.isBlank())
          .map(fqn -> label(fqn, TagLabel.TagSource.CLASSIFICATION))
          .forEach(tags::add);
    }
    return tags;
  }

  private static java.util.Optional<TagLabel> cdeTag(TechnicalRecord record) {
    java.util.Optional<TagLabel> tag = java.util.Optional.empty();
    final String version = TechnicalDictionaryState.row().dataDictionaryVersion();
    if (record.hasCde() && version != null) {
      final TechnicalCdeInfo info =
          TechnicalCdeInfo.resolve(java.util.UUID.fromString(record.cdeTermId()), version);
      if (info.isPresent() && !info.fullyQualifiedName().isEmpty()) {
        final TagLabel label = label(info.fullyQualifiedName(), TagLabel.TagSource.GLOSSARY);
        if (label.getName() == null) {
          label.setName(info.code());
          label.setDisplayName(info.name());
        }
        tag = java.util.Optional.of(label);
      }
    }
    return tag;
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

  /**
   * The label carries the tag's name, display name, description and style, as labels set from the UI
   * do. Search documents are built from the label as written, so without them the Column summary
   * shows the tag with no text.
   */
  private static TagLabel label(String tagFqn, TagLabel.TagSource source) {
    final TagLabel label =
        new TagLabel()
            .withTagFQN(tagFqn)
            .withSource(source)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED);
    TagLabelUtil.applyTagCommonFieldsGracefully(label);
    return label;
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

  private static TableRepository repository() {
    return (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
