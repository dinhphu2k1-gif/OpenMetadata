/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

/**
 * Per-request memo of row visibility decisions. Policy evaluation for a governed term depends only
 * on its owners, domains and tags (the parent glossary is constant inside one scope) and, for
 * working rows, on whether the caller created it, so identical signatures share one decision.
 */
final class GovernedRowAuthorizationCache {
  private static final int MAX_ENTRIES = 1_000;

  private final Cache<String, Boolean> decisions =
      Caffeine.newBuilder().maximumSize(MAX_ENTRIES).build();

  boolean publishedVisible(GlossaryTerm term, Supplier<Boolean> decision) {
    return decisions.get("published|" + signature(term), key -> decision.get());
  }

  boolean workingVisible(GlossaryTerm term, boolean createdByCaller, Supplier<Boolean> decision) {
    return decisions.get(
        "working|" + createdByCaller + "|" + signature(term), key -> decision.get());
  }

  static String signature(GlossaryTerm term) {
    return String.join(
        "|",
        ids(term.getOwners()),
        ids(term.getDomains()),
        listOrEmpty(term.getTags()).stream()
            .map(TagLabel::getTagFQN)
            .sorted()
            .collect(Collectors.joining(",")));
  }

  private static String ids(List<EntityReference> references) {
    return listOrEmpty(references).stream()
        .map(reference -> String.valueOf(reference.getId()))
        .sorted()
        .collect(Collectors.joining(","));
  }
}
