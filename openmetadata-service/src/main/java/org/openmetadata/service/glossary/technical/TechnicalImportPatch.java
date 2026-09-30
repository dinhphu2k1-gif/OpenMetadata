/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;

/** Applies the editable changes of an import row to a working payload. */
public final class TechnicalImportPatch {
  private TechnicalImportPatch() {}

  public static GlossaryTerm apply(GlossaryTerm term, RowPatch patch) {
    applyExtension(term, patch);
    if (patch.cde().specified()) {
      term.setRelatedTerms(patch.cde().value() == null ? List.of() : List.of(patch.cde().value()));
    }
    term.setTags(applyTags(term.getTags(), patch.tags()));
    return term;
  }

  private static void applyExtension(GlossaryTerm term, RowPatch patch) {
    final Map<String, Object> extension = TechnicalRecordValidator.extension(term.getExtension());
    put(extension, TechnicalDictionaryProfile.SURVIVORSHIP_RANK, patch.rank());
    put(
        extension,
        TechnicalDictionaryProfile.SYSTEM_OWNER,
        new Field<>(
            patch.systemOwner().specified(),
            patch.systemOwner().value() == null
                ? null
                : JsonUtils.readValue(
                    JsonUtils.pojoToJson(patch.systemOwner().value()), Map.class)));
    term.setExtension(extension);
  }

  private static void put(Map<String, Object> extension, String key, Field<?> field) {
    if (field.specified()) {
      if (field.value() == null) {
        extension.remove(key);
      } else {
        extension.put(key, field.value());
      }
    }
  }

  private static List<TagLabel> applyTags(
      List<TagLabel> current, Map<String, Field<TagLabel>> changes) {
    final List<TagLabel> result = new ArrayList<>();
    for (TagLabel tag : listOrEmpty(current)) {
      if (!isReplaced(tag, changes)) {
        result.add(tag);
      }
    }
    changes.values().stream()
        .filter(field -> field.specified() && field.value() != null)
        .forEach(field -> result.add(field.value()));
    return result;
  }

  private static boolean isReplaced(TagLabel tag, Map<String, Field<TagLabel>> changes) {
    return changes.entrySet().stream()
        .anyMatch(
            entry ->
                entry.getValue().specified() && tag.getTagFQN().startsWith(entry.getKey() + "."));
  }
}
