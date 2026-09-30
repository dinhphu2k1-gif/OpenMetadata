/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

/**
 * The self-managed `technical_dictionary_search_index`. Readers and writers always use the alias;
 * a rebuild fills a new physical index and then moves the alias. Every call goes through {@code
 * SearchClient.rawSearchRequest}, so it works on OpenSearch and Elasticsearch alike. The index is
 * intentionally not registered in `indexMapping.json`, so the OpenMetadata reindex never touches
 * it.
 */
public final class TechnicalSearchIndex {
  public static final String INDEX_NAME = "technical_dictionary_search_index";

  private static final String MAPPING_RESOURCE =
      "/elasticsearch/technical_dictionary_index_mapping.json";
  private static final String GET = "GET";
  private static final String PUT = "PUT";
  private static final String POST = "POST";
  private static final String DELETE = "DELETE";
  private static final String INDEX_ACTION = "index";
  private static final String DELETE_ACTION = "delete";
  private static final String WAIT_FOR_REFRESH = "refresh=wait_for";
  private static final String REQUIRE_ALIAS = "require_alias=true";
  private static final String NEW_LINE = "\n";
  private static final int FIRST_ERROR_STATUS = 300;
  private static final int NOT_FOUND = 404;
  private static final String META = "_meta";
  private static final String MAPPING_HASH = "mappingHash";

  private TechnicalSearchIndex() {}

  /** One bulk operation: an upsert of {@code document}, or a delete when it is null. */
  public record IndexAction(String termId, Map<String, Object> document) {
    public static IndexAction delete(String termId) {
      return new IndexAction(termId, null);
    }

    public boolean isDelete() {
      return document == null;
    }
  }

  public static String alias() {
    return Entity.getSearchRepository().getIndexOrAliasName(INDEX_NAME);
  }

  public static boolean aliasExists() {
    return isSuccess(execute(GET, "/_alias/" + alias(), null));
  }

  /** A concrete index that carries the alias name, created by a write before the alias existed. */
  public static boolean strayIndexExists() {
    return !aliasExists() && isSuccess(execute(GET, "/" + alias(), null));
  }

  public static String createPhysicalIndex() {
    final String name = alias() + "_" + System.currentTimeMillis();
    requireSuccess(execute(PUT, "/" + name, mappingWithHash()), "create index " + name);
    return name;
  }

  /** True when the aliased index was created from the mapping shipped with this server. */
  public static boolean mappingIsCurrent() {
    final RawSearchResponse response = execute(GET, "/" + alias() + "/_mapping", null);
    boolean current = false;
    if (isSuccess(response)) {
      final JsonNode indices = JsonUtils.readTree(response.body());
      final String expected = mappingHash();
      for (JsonNode index : indices) {
        current = expected.equals(index.path("mappings").path(META).path(MAPPING_HASH).asText());
      }
    }
    return current;
  }

  private static String mappingWithHash() {
    final ObjectNode definition = (ObjectNode) JsonUtils.readTree(mapping());
    final ObjectNode mappings = (ObjectNode) definition.path("mappings");
    mappings.putObject(META).put(MAPPING_HASH, mappingHash());
    return definition.toString();
  }

  private static String mappingHash() {
    String hash = null;
    try {
      final byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(mapping().getBytes(StandardCharsets.UTF_8));
      hash = HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
    return hash;
  }

  public static void deleteIndex(String name) {
    final RawSearchResponse response = execute(DELETE, "/" + name, null);
    if (!isSuccess(response) && response.statusCode() != NOT_FOUND) {
      throw failure("delete index " + name, response);
    }
  }

  public static void refreshIndex(String name) {
    requireSuccess(execute(POST, "/" + name + "/_refresh", null), "refresh index " + name);
  }

  /** Points the alias at {@code physicalIndex} only and drops the indices it pointed at before. */
  public static void switchAlias(String physicalIndex) {
    final List<String> previous = aliasedIndices();
    final List<Object> actions = new ArrayList<>();
    previous.forEach(index -> actions.add(aliasAction("remove", index)));
    actions.add(aliasAction("add", physicalIndex));
    requireSuccess(
        execute(POST, "/_aliases", JsonUtils.pojoToJson(Map.of("actions", actions))),
        "switch alias to " + physicalIndex);
    previous.stream().filter(index -> !index.equals(physicalIndex)).forEach(TechnicalSearchIndex::deleteIndex);
  }

  private static List<String> aliasedIndices() {
    final RawSearchResponse response = execute(GET, "/_alias/" + alias(), null);
    final List<String> indices = new ArrayList<>();
    if (isSuccess(response)) {
      JsonUtils.readTree(response.body()).fieldNames().forEachRemaining(indices::add);
    }
    return indices;
  }

  private static Map<String, Object> aliasAction(String action, String index) {
    return Map.of(action, Map.of("index", index, "alias", alias()));
  }

  /** Writes through the alias; returns the term ids whose operation failed. */
  public static List<String> bulk(Collection<IndexAction> actions, boolean waitForRefresh) {
    final String parameters = waitForRefresh ? REQUIRE_ALIAS + "&" + WAIT_FOR_REFRESH : REQUIRE_ALIAS;
    return bulk(alias(), actions, parameters);
  }

  /** Writes into one physical index during a rebuild. */
  public static List<String> bulkInto(String physicalIndex, Collection<IndexAction> actions) {
    return bulk(physicalIndex, actions, "");
  }

  private static List<String> bulk(
      String target, Collection<IndexAction> actions, String parameters) {
    List<String> failed = List.of();
    if (!actions.isEmpty()) {
      final String endpoint = parameters.isEmpty() ? "/_bulk" : "/_bulk?" + parameters;
      final RawSearchResponse response = execute(POST, endpoint, ndjson(target, actions));
      requireSuccess(response, "bulk write into " + target);
      failed = failedItems(JsonUtils.readTree(response.body()));
    }
    return failed;
  }

  private static String ndjson(String target, Collection<IndexAction> actions) {
    final StringBuilder body = new StringBuilder();
    for (IndexAction action : actions) {
      final String operation = action.isDelete() ? DELETE_ACTION : INDEX_ACTION;
      final Map<String, Object> metadata = new LinkedHashMap<>();
      metadata.put("_index", target);
      metadata.put("_id", action.termId());
      body.append(JsonUtils.pojoToJson(Map.of(operation, metadata))).append(NEW_LINE);
      if (!action.isDelete()) {
        body.append(JsonUtils.pojoToJson(action.document())).append(NEW_LINE);
      }
    }
    return body.toString();
  }

  static List<String> failedItems(JsonNode response) {
    final List<String> failed = new ArrayList<>();
    if (response.path("errors").asBoolean(false)) {
      for (JsonNode item : response.path("items")) {
        addIfFailed(failed, item);
      }
    }
    return failed;
  }

  private static void addIfFailed(List<String> failed, JsonNode item) {
    final boolean isDelete = item.has(DELETE_ACTION);
    final JsonNode result = isDelete ? item.path(DELETE_ACTION) : item.path(INDEX_ACTION);
    final int status = result.path("status").asInt();
    final boolean missingOnDelete = isDelete && status == NOT_FOUND;
    if (status >= FIRST_ERROR_STATUS && !missingOnDelete) {
      failed.add(result.path("_id").asText());
    }
  }

  public static JsonNode search(Map<String, Object> body) {
    final RawSearchResponse response =
        execute(POST, "/" + alias() + "/_search", JsonUtils.pojoToJson(body));
    requireSuccess(response, "search");
    return JsonUtils.readTree(response.body());
  }

  private static String mapping() {
    String content = null;
    try (InputStream stream = TechnicalSearchIndex.class.getResourceAsStream(MAPPING_RESOURCE)) {
      if (stream == null) {
        throw new IllegalStateException("Missing index mapping " + MAPPING_RESOURCE);
      }
      content = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read index mapping " + MAPPING_RESOURCE, exception);
    }
    return content;
  }

  private static RawSearchResponse execute(String method, String endpoint, String body) {
    RawSearchResponse response = null;
    try {
      response =
          Entity.getSearchRepository().getSearchClient().rawSearchRequest(method, endpoint, body);
    } catch (IOException | UnsupportedOperationException exception) {
      throw new TechnicalIndexUnavailableException(
          String.format("Search engine request %s %s failed", method, endpoint), exception);
    }
    return response;
  }

  private static boolean isSuccess(RawSearchResponse response) {
    return response.statusCode() < FIRST_ERROR_STATUS;
  }

  private static void requireSuccess(RawSearchResponse response, String operation) {
    if (!isSuccess(response)) {
      throw failure(operation, response);
    }
  }

  private static TechnicalIndexUnavailableException failure(
      String operation, RawSearchResponse response) {
    return new TechnicalIndexUnavailableException(
        String.format(
            "Technical Dictionary index operation '%s' failed with status %d: %s",
            operation, response.statusCode(), response.body()));
  }
}
