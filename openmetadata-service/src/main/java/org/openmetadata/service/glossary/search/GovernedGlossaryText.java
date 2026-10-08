/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import java.text.Normalizer;
import java.util.Locale;

/** Search normalization shared by indexed values and query text. */
public final class GovernedGlossaryText {
  private GovernedGlossaryText() {}

  public static String normalize(final Object value) {
    final String compatibility =
        Normalizer.normalize(value == null ? "" : String.valueOf(value), Normalizer.Form.NFKC)
            .toLowerCase(Locale.ROOT)
            .replace('đ', 'd');
    return Normalizer.normalize(compatibility, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
  }

  public static String escapeWildcard(final String value) {
    return value.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }
}
