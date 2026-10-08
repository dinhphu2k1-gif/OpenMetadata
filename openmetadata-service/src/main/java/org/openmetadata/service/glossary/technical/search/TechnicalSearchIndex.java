/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.service.governance.search.GovernanceSearchIndex;
import org.openmetadata.service.governance.search.GovernanceSearchUnavailableException;

/** Technical Dictionary adapter over the shared self-managed governance index. */
public final class TechnicalSearchIndex {
  public static final String INDEX_NAME = "technical_dictionary_search_index";
  private static final GovernanceSearchIndex INDEX =
      new GovernanceSearchIndex(
          INDEX_NAME, "/elasticsearch/technical_dictionary_index_mapping.json");

  private TechnicalSearchIndex() {}

  public record IndexAction(String termId, Map<String, Object> document) {
    public static IndexAction delete(final String termId) {
      return new IndexAction(termId, null);
    }

    public boolean isDelete() {
      return document == null;
    }
  }

  public static String alias() {
    return INDEX.alias();
  }

  /** False while the engine circuit is open; reads then fail fast with the unavailable error. */
  public static boolean isReachable() {
    return INDEX.isReachable();
  }

  public static boolean aliasExists() {
    return translate(INDEX::aliasExists);
  }

  public static boolean strayIndexExists() {
    return translate(INDEX::strayIndexExists);
  }

  public static String createPhysicalIndex() {
    return translate(INDEX::createPhysicalIndex);
  }

  public static boolean mappingIsCurrent() {
    return translate(INDEX::mappingIsCurrent);
  }

  public static void deleteIndex(final String name) {
    run(() -> INDEX.deleteIndex(name));
  }

  public static void refreshIndex(final String name) {
    run(() -> INDEX.refreshIndex(name));
  }

  public static void switchAlias(final String physicalIndex) {
    run(() -> INDEX.switchAlias(physicalIndex));
  }

  public static List<String> bulk(
      final Collection<IndexAction> actions, final boolean waitForRefresh) {
    return translate(() -> INDEX.bulk(shared(actions), waitForRefresh));
  }

  public static List<String> bulkInto(
      final String physicalIndex, final Collection<IndexAction> actions) {
    return translate(() -> INDEX.bulkInto(physicalIndex, shared(actions)));
  }

  public static JsonNode search(final Map<String, Object> body) {
    return translate(() -> INDEX.search(body));
  }

  static List<String> failedItems(final JsonNode response) {
    return GovernanceSearchIndex.failedItems(response);
  }

  private static List<GovernanceSearchIndex.IndexAction> shared(
      final Collection<IndexAction> actions) {
    return actions.stream()
        .map(action -> new GovernanceSearchIndex.IndexAction(action.termId(), action.document()))
        .toList();
  }

  private static void run(final Runnable operation) {
    translate(
        () -> {
          operation.run();
          return Boolean.TRUE;
        });
  }

  private static <T> T translate(final Supplier<T> operation) {
    T result = null;
    try {
      result = operation.get();
    } catch (GovernanceSearchUnavailableException exception) {
      throw new TechnicalIndexUnavailableException(exception.getMessage(), exception);
    }
    return result;
  }
}
