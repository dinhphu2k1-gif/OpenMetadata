/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;

/** Applies the editable changes of an import row to the current values of a record. */
public final class TechnicalImportPatch {
  private TechnicalImportPatch() {}

  /** The values after the patch: absent columns keep the current value, empty cells clear it. */
  public static TechnicalRecordValues merge(TechnicalRecordValues current, RowPatch patch) {
    return new TechnicalRecordValues(
        pick(patch.cde(), current.cde(), TechnicalImportPatch::cdeId),
        pick(patch.rank(), current.rank(), rank -> rank),
        pick(
            tag(patch, TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION),
            current.elementType()),
        pick(
            tag(patch, TechnicalDictionaryProfile.GENERATION_TYPE_CLASSIFICATION),
            current.generationType()),
        pick(
            tag(patch, TechnicalDictionaryProfile.CREATION_METHOD_CLASSIFICATION),
            current.creationMethod()),
        pick(
            tag(patch, TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION), current.timeliness()),
        pick(patch.systemOwner(), current.systemOwnerId(), owner -> owner));
  }

  private static Field<String> tag(RowPatch patch, String classification) {
    return patch.tags().getOrDefault(classification, Field.absent());
  }

  private static String pick(Field<String> field, String current) {
    return pick(field, current, value -> value);
  }

  private static <T, V> V pick(Field<T> field, V current, java.util.function.Function<T, V> map) {
    return field.specified() ? (field.value() == null ? null : map.apply(field.value())) : current;
  }

  private static UUID cdeId(TechnicalCdeInfo info) {
    return UUID.fromString(info.id());
  }
}
