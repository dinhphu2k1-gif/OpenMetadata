/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.technical.search.TechnicalIndexSync;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Declares one Column in a Technical Dictionary catalog version with its initial values (TDX-01).
 * The Column is read from the database, never from a search index, and the values go through the
 * same validation as Save Draft before the record is created.
 */
public class TechnicalRecordDeclarations {
  private static final String TABLE_FIELDS = "columns";
  private static final String TEAM = "team";

  private final TechnicalRecordWriter writer = new TechnicalRecordWriter();
  private final TechnicalRecordValidator validator = new TechnicalRecordValidator();
  private final TechnicalCdeReferenceResolver cdeResolver = new TechnicalCdeReferenceResolver();

  /** Creates the record and synchronizes its search document; returns the new record id. */
  public UUID declare(
      String parentBusinessVersion, TechnicalRecordDeclaration declaration, String actor) {
    final Glossary technical = TechnicalCatalog.requireGlossary();
    final TechnicalColumnSource column = requireColumn(declaration.columnFqn());
    requireUndeclared(technical, parentBusinessVersion, column);
    final UUID termId =
        writer.createDraft(
            technical,
            parentBusinessVersion,
            column,
            term -> withDeclaredValues(term, declaration),
            actor);
    if (termId == null) {
      throw alreadyDeclared(column);
    }
    TechnicalIndexSync.refresh(termId);
    return termId;
  }

  private GlossaryTerm withDeclaredValues(GlossaryTerm term, TechnicalRecordDeclaration values) {
    final GlossaryTerm requested =
        JsonUtils.deepCopy(term, GlossaryTerm.class)
            .withExtension(editableExtension(values))
            .withTags(tags(values));
    requested.setRelatedTerms(cdeResolver.resolveForDraft(requestedCde(values), term));
    final GlossaryTerm prepared = validator.prepareDraft(requested, term);
    TechnicalRankGuard.requireUnique(null, prepared);
    return prepared;
  }

  private static Map<String, Object> editableExtension(TechnicalRecordDeclaration values) {
    final Map<String, Object> extension = new LinkedHashMap<>();
    if (values.rank() != null) {
      extension.put(TechnicalDictionaryProfile.SURVIVORSHIP_RANK, values.rank());
    }
    if (values.systemOwnerId() != null) {
      extension.put(TechnicalDictionaryProfile.SYSTEM_OWNER, team(values.systemOwnerId()));
    }
    return extension;
  }

  private static Map<String, Object> team(UUID teamId) {
    EntityReference team = null;
    try {
      team = Entity.getEntityReferenceById(Entity.TEAM, teamId, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD,
          String.format("%s must reference an existing team", TechnicalDictionaryProfile.SYSTEM_OWNER));
    }
    final Map<String, Object> reference = TechnicalRecordValidator.extension(team);
    reference.put("type", TEAM);
    return reference;
  }

  private static List<TagLabel> tags(TechnicalRecordDeclaration values) {
    return Stream.of(
            values.elementType(),
            values.generationType(),
            values.creationMethod(),
            values.timeliness())
        .filter(Objects::nonNull)
        .filter(fqn -> !fqn.isBlank())
        .map(TechnicalRecordDeclarations::tag)
        .toList();
  }

  private static TagLabel tag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<TermRelation> requestedCde(TechnicalRecordDeclaration values) {
    return values.cde() == null
        ? List.of()
        : List.of(
            new TermRelation()
                .withTerm(new EntityReference().withId(values.cde()).withType(Entity.GLOSSARY_TERM)));
  }

  /** The top-level Column as stored in `table_entity`. */
  static TechnicalColumnSource requireColumn(String columnFqn) {
    if (nullOrEmpty(columnFqn)) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "columnFqn is required");
    }
    final Table table = findTable(FullyQualifiedName.getParentFQN(columnFqn));
    final List<TechnicalColumnSource> columns =
        table == null ? List.of() : TechnicalColumnSource.columnsOf(table);
    return columns.stream()
        .filter(column -> columnFqn.equals(column.columnFqn()))
        .findFirst()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.notFound(
                    TechnicalDictionaryErrors.COLUMN_NOT_FOUND,
                    String.format("Column '%s' was not found", columnFqn)));
  }

  private static Table findTable(String tableFqn) {
    Table table = null;
    try {
      table =
          nullOrEmpty(tableFqn)
              ? null
              : Entity.getEntityByName(Entity.TABLE, tableFqn, TABLE_FIELDS, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      table = null;
    }
    return table;
  }

  private static void requireUndeclared(
      Glossary technical, String parentBusinessVersion, TechnicalColumnSource column) {
    if (TechnicalRecordWriter.findRecord(technical, parentBusinessVersion, column.columnKey())
        != null) {
      throw alreadyDeclared(column);
    }
  }

  private static RuntimeException alreadyDeclared(TechnicalColumnSource column) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.COLUMN_ALREADY_DECLARED,
        String.format(
            "Column '%s' is already declared in this Technical Dictionary version",
            column.columnFqn()));
  }
}
