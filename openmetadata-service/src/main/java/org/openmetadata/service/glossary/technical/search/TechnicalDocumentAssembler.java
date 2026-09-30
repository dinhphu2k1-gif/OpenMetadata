/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityVersionContext;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.glossary.technical.TechnicalCdeInfo;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile;
import org.openmetadata.service.glossary.technical.TechnicalRecordValidator;
import org.openmetadata.service.glossary.versioning.CdeReleaseVersionType;

/**
 * Builds one index document from the representations of a record read from the database. The
 * document is always complete, so writing it again is idempotent.
 */
public final class TechnicalDocumentAssembler {
  private static final Map<String, String> TAG_FIELDS =
      Map.of(
          TechnicalIndexFields.ELEMENT_TYPE, TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION,
          TechnicalIndexFields.GENERATION_TYPE,
              TechnicalDictionaryProfile.GENERATION_TYPE_CLASSIFICATION,
          TechnicalIndexFields.CREATION_METHOD,
              TechnicalDictionaryProfile.CREATION_METHOD_CLASSIFICATION,
          TechnicalIndexFields.TIMELINESS, TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION);
  private static final Map<String, String> LOCATION_FIELDS = locationFields();
  private static final List<String> REFERENCE_FIELDS =
      List.of(
          TechnicalIndexFields.ID,
          TechnicalIndexFields.TYPE,
          TechnicalIndexFields.NAME,
          TechnicalIndexFields.DISPLAY_NAME,
          TechnicalIndexFields.FULLY_QUALIFIED_NAME);

  private TechnicalDocumentAssembler() {}

  private static Map<String, String> locationFields() {
    final Map<String, String> fields = new LinkedHashMap<>();
    fields.put(TechnicalIndexFields.COLUMN_FQN, TechnicalDictionaryProfile.SOURCE_COLUMN_FQN);
    fields.put(TechnicalIndexFields.SERVICE, TechnicalDictionaryProfile.SOURCE_SERVICE);
    fields.put(TechnicalIndexFields.DATABASE, TechnicalDictionaryProfile.SOURCE_DATABASE);
    fields.put(TechnicalIndexFields.SCHEMA, TechnicalDictionaryProfile.SOURCE_SCHEMA);
    fields.put(TechnicalIndexFields.TABLE, TechnicalDictionaryProfile.SOURCE_TABLE);
    fields.put(TechnicalIndexFields.COLUMN, TechnicalDictionaryProfile.SOURCE_COLUMN);
    fields.put(TechnicalIndexFields.DATA_TYPE, TechnicalDictionaryProfile.SOURCE_DATA_TYPE);
    fields.put(TechnicalIndexFields.DATA_LENGTH, TechnicalDictionaryProfile.SOURCE_DATA_LENGTH);
    fields.put(TechnicalIndexFields.PRECISION, TechnicalDictionaryProfile.SOURCE_PRECISION);
    fields.put(TechnicalIndexFields.SCALE, TechnicalDictionaryProfile.SOURCE_SCALE);
    return fields;
  }

  /** Database state of one record; {@code published} is null when it was never Approved. */
  public record RecordState(
      UUID termId,
      UUID glossaryId,
      String parentBusinessVersion,
      String columnKey,
      TechnicalRepresentation current,
      TechnicalRepresentation published,
      String sourceStatus) {}

  public static Map<String, Object> assemble(
      RecordState state, Function<UUID, TechnicalCdeInfo> cdes) {
    final Map<String, Object> document = new LinkedHashMap<>();
    document.put(TechnicalIndexFields.TERM_ID, state.termId().toString());
    document.put(TechnicalIndexFields.GLOSSARY_ID, state.glossaryId().toString());
    document.put(TechnicalIndexFields.PARENT_BUSINESS_VERSION, state.parentBusinessVersion());
    document.put(TechnicalIndexFields.COLUMN_KEY, state.columnKey());
    putLocation(document, state.current().payload());
    document.put(TechnicalIndexFields.SOURCE_STATUS, state.sourceStatus());
    document.put(TechnicalIndexFields.HAS_PUBLISHED, state.published() != null);
    document.put(TechnicalIndexFields.CURRENT, view(state.current(), state, cdes));
    if (state.published() != null) {
      document.put(TechnicalIndexFields.PUBLISHED, view(state.published(), state, cdes));
    }
    return document;
  }

  private static void putLocation(Map<String, Object> document, GlossaryTerm payload) {
    final Map<String, Object> source = TechnicalRecordValidator.extension(payload.getExtension());
    LOCATION_FIELDS.forEach((field, key) -> putValue(document, field, source.get(key)));
    document.put(TechnicalIndexFields.TABLE_KEY, tableKey(source));
    putText(document, TechnicalIndexFields.DESCRIPTION, payload.getDescription());
    putText(document, TechnicalIndexFields.DISPLAY_NAME, payload.getDisplayName());
  }

  static String tableKey(Map<String, Object> source) {
    return String.join(
        ".",
        String.valueOf(source.getOrDefault(TechnicalDictionaryProfile.SOURCE_DATABASE, "")),
        String.valueOf(source.getOrDefault(TechnicalDictionaryProfile.SOURCE_SCHEMA, "")),
        String.valueOf(source.getOrDefault(TechnicalDictionaryProfile.SOURCE_TABLE, "")));
  }

  private static Map<String, Object> view(
      TechnicalRepresentation representation,
      RecordState state,
      Function<UUID, TechnicalCdeInfo> cdes) {
    final Map<String, Object> view = new LinkedHashMap<>();
    putStatus(view, representation);
    final TermRelation relation = relationOf(representation.payload());
    final TechnicalCdeInfo cde =
        relation == null ? TechnicalCdeInfo.NONE : cdes.apply(relation.getTerm().getId());
    putValue(view, TechnicalIndexFields.CDE, cdeView(relation, cde, state.parentBusinessVersion()));
    view.put(TechnicalIndexFields.DATA_OWNERS, cde.owners().stream().map(TechnicalDocumentAssembler::reference).toList());
    putClassification(view, representation.payload());
    putExtensionFields(view, representation.payload());
    putValue(view, TechnicalIndexFields.UPDATED_AT, representation.updatedAt());
    putText(view, TechnicalIndexFields.UPDATED_BY, representation.updatedBy());
    return view;
  }

  private static void putStatus(Map<String, Object> view, TechnicalRepresentation representation) {
    view.put(TechnicalIndexFields.RECORD_TYPE, representation.recordType());
    view.put(TechnicalIndexFields.ENTITY_STATUS, representation.entityStatus());
    view.put(TechnicalIndexFields.BUSINESS_VERSION, representation.businessVersion());
    view.put(
        TechnicalIndexFields.RELEASE_VERSION_TYPE,
        CdeReleaseVersionType.fromBusinessVersion(representation.businessVersion()));
    putValue(view, TechnicalIndexFields.WORKING_REVISION, representation.workingRevision());
    putText(view, TechnicalIndexFields.SNAPSHOT_ID, representation.snapshotId());
  }

  private static TermRelation relationOf(GlossaryTerm payload) {
    final List<TermRelation> relations = payload.getRelatedTerms();
    final boolean mapped =
        !nullOrEmpty(relations)
            && relations.getFirst().getTerm() != null
            && relations.getFirst().getTerm().getId() != null;
    return mapped ? relations.getFirst() : null;
  }

  private static Map<String, Object> cdeView(
      TermRelation relation, TechnicalCdeInfo cde, String parentBusinessVersion) {
    Map<String, Object> view = null;
    if (relation != null) {
      final EntityVersionContext context = relation.getVersionContext();
      view = new LinkedHashMap<>();
      view.put(TechnicalIndexFields.ID, relation.getTerm().getId().toString());
      view.put(TechnicalIndexFields.CODE, cde.code());
      view.put(TechnicalIndexFields.NAME, cde.name());
      putText(view, TechnicalIndexFields.FULLY_QUALIFIED_NAME, relation.getTerm().getFullyQualifiedName());
      putText(view, TechnicalIndexFields.BUSINESS_VERSION, context == null ? null : context.getBusinessVersion());
      putText(view, TechnicalIndexFields.SNAPSHOT_ID, context == null ? null : context.getSnapshotId());
      putText(view, TechnicalIndexFields.PARENT_BUSINESS_VERSION, parentBusinessVersion);
    }
    return view;
  }

  private static void putClassification(Map<String, Object> view, GlossaryTerm payload) {
    TAG_FIELDS.forEach(
        (field, classification) ->
            listOrEmpty(payload.getTags()).stream()
                .filter(tag -> tag.getTagFQN() != null)
                .filter(tag -> tag.getTagFQN().startsWith(classification + "."))
                .findFirst()
                .ifPresent(tag -> view.put(field, tagView(tag))));
  }

  static Map<String, Object> tagView(TagLabel tag) {
    final Map<String, Object> view = new LinkedHashMap<>();
    view.put(TechnicalIndexFields.FQN, tag.getTagFQN());
    view.put(TechnicalIndexFields.LABEL, tagLabel(tag));
    putText(view, TechnicalIndexFields.NAME, tag.getName());
    return view;
  }

  private static String tagLabel(TagLabel tag) {
    final String fqn = tag.getTagFQN();
    final String fallback = fqn.substring(fqn.lastIndexOf('.') + 1);
    final String name = nullOrEmpty(tag.getName()) ? fallback : tag.getName();
    return nullOrEmpty(tag.getDisplayName()) ? name : tag.getDisplayName();
  }

  private static void putExtensionFields(Map<String, Object> view, GlossaryTerm payload) {
    final Map<String, Object> extension =
        TechnicalRecordValidator.extension(payload.getExtension());
    putValue(view, TechnicalIndexFields.RANK, TechnicalRecordValidator.rank(extension));
    if (extension.get(TechnicalDictionaryProfile.SYSTEM_OWNER) instanceof Map<?, ?> owner) {
      view.put(TechnicalIndexFields.SYSTEM_OWNER, subset(owner));
    }
  }

  private static Map<String, Object> reference(EntityReference reference) {
    return subset(TechnicalRecordValidator.extension(reference));
  }

  private static Map<String, Object> subset(Map<?, ?> source) {
    final Map<String, Object> result = new LinkedHashMap<>();
    REFERENCE_FIELDS.forEach(field -> putValue(result, field, source.get(field)));
    return result;
  }

  private static void putText(Map<String, Object> target, String field, Object value) {
    if (value != null && !String.valueOf(value).isEmpty()) {
      target.put(field, String.valueOf(value));
    }
  }

  private static void putValue(Map<String, Object> target, String field, Object value) {
    if (value != null) {
      target.put(field, value);
    }
  }
}
