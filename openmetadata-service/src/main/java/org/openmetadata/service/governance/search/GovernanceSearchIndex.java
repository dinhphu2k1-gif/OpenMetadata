/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

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
 * Self-managed search index with a blue/green alias and engine-neutral raw requests. A transport
 * failure or a server error opens a short circuit: alias reads and writes then fail fast without
 * calling the engine until {@link #RETRY_AFTER_MILLIS} has passed, so list reads fall back at once.
 */
public final class GovernanceSearchIndex {
  public static final long RETRY_AFTER_MILLIS = 15_000;
  private static final int FIRST_SERVER_ERROR_STATUS = 500;
  private static final String DELETE = "DELETE";
  private static final String DELETE_ACTION = "delete";
  private static final int FIRST_ERROR_STATUS = 300;
  private static final String GET = "GET";
  private static final String INDEX_ACTION = "index";
  private static final String MAPPING_HASH = "mappingHash";
  private static final String META = "_meta";
  private static final String NEW_LINE = "\n";
  private static final int NOT_FOUND = 404;
  private static final String POST = "POST";
  private static final String PUT = "PUT";
  private static final String REQUIRE_ALIAS = "require_alias=true";
  private static final String WAIT_FOR_REFRESH = "refresh=wait_for";

  private final String logicalName;
  private final String mappingResource;
  private final GovernanceSearchCircuit circuit =
      new GovernanceSearchCircuit(RETRY_AFTER_MILLIS, System::currentTimeMillis);

  public GovernanceSearchIndex(final String logicalName, final String mappingResource) {
    this.logicalName = logicalName;
    this.mappingResource = mappingResource;
  }

  public record IndexAction(String id, Map<String, Object> document) {
    public static IndexAction delete(final String id) {
      return new IndexAction(id, null);
    }

    public boolean isDelete() {
      return document == null;
    }
  }

  public String alias() {
    return Entity.getSearchRepository().getIndexOrAliasName(logicalName);
  }

  public boolean aliasExists() {
    return isSuccess(execute(GET, "/_alias/" + alias(), null));
  }

  public boolean strayIndexExists() {
    return !aliasExists() && isSuccess(execute(GET, "/" + alias(), null));
  }

  public String createPhysicalIndex() {
    final String name = alias() + "_" + System.currentTimeMillis();
    requireSuccess(execute(PUT, "/" + name, mappingWithHash()), "create index " + name);
    return name;
  }

  public boolean mappingIsCurrent() {
    final RawSearchResponse response = execute(GET, "/" + alias() + "/_mapping", null);
    boolean current = false;
    if (isSuccess(response)) {
      final String expected = mappingHash();
      for (JsonNode index : JsonUtils.readTree(response.body())) {
        current = expected.equals(index.path("mappings").path(META).path(MAPPING_HASH).asText());
      }
    }
    return current;
  }

  public void deleteIndex(final String name) {
    final RawSearchResponse response = execute(DELETE, "/" + name, null);
    if (!isSuccess(response) && response.statusCode() != NOT_FOUND) {
      throw failure("delete index " + name, response);
    }
  }

  public void refreshIndex(final String name) {
    requireSuccess(execute(POST, "/" + name + "/_refresh", null), "refresh index " + name);
  }

  public void switchAlias(final String physicalIndex) {
    final List<String> previous = aliasedIndices();
    final List<Object> actions = new ArrayList<>();
    previous.forEach(index -> actions.add(aliasAction("remove", index)));
    actions.add(aliasAction("add", physicalIndex));
    requireSuccess(
        execute(POST, "/_aliases", JsonUtils.pojoToJson(Map.of("actions", actions))),
        "switch alias to " + physicalIndex);
    previous.stream().filter(index -> !index.equals(physicalIndex)).forEach(this::deleteIndex);
  }

  public List<String> bulk(final Collection<IndexAction> actions, final boolean waitForRefresh) {
    requireReachable();
    final String parameters =
        waitForRefresh ? REQUIRE_ALIAS + "&" + WAIT_FOR_REFRESH : REQUIRE_ALIAS;
    return bulk(alias(), actions, parameters);
  }

  public List<String> bulkInto(final String physicalIndex, final Collection<IndexAction> actions) {
    return bulk(physicalIndex, actions, "");
  }

  public JsonNode search(final Map<String, Object> body) {
    requireReachable();
    final RawSearchResponse response =
        execute(POST, "/" + alias() + "/_search", JsonUtils.pojoToJson(body));
    requireSuccess(response, "search");
    return JsonUtils.readTree(response.body());
  }

  public boolean isAvailable() {
    return aliasExists();
  }

  /** False while the circuit is open after a recent transport failure or server error. */
  public boolean isReachable() {
    return circuit.allowsRequests();
  }

  private void requireReachable() {
    if (!isReachable()) {
      throw new GovernanceSearchUnavailableException(
          String.format("%s is unreachable; retrying after the circuit window", logicalName));
    }
  }

  private void recordReachability(final boolean reachable) {
    circuit.record(reachable);
  }

  private List<String> bulk(
      final String target, final Collection<IndexAction> actions, final String parameters) {
    List<String> failed = List.of();
    if (!actions.isEmpty()) {
      final String endpoint = parameters.isEmpty() ? "/_bulk" : "/_bulk?" + parameters;
      final RawSearchResponse response = execute(POST, endpoint, ndjson(target, actions));
      requireSuccess(response, "bulk write into " + target);
      failed = failedItems(JsonUtils.readTree(response.body()));
    }
    return failed;
  }

  private static String ndjson(final String target, final Collection<IndexAction> actions) {
    final StringBuilder body = new StringBuilder();
    for (IndexAction action : actions) {
      final String operation = action.isDelete() ? DELETE_ACTION : INDEX_ACTION;
      final Map<String, Object> metadata = new LinkedHashMap<>();
      metadata.put("_index", target);
      metadata.put("_id", action.id());
      body.append(JsonUtils.pojoToJson(Map.of(operation, metadata))).append(NEW_LINE);
      if (!action.isDelete()) {
        body.append(JsonUtils.pojoToJson(action.document())).append(NEW_LINE);
      }
    }
    return body.toString();
  }

  public static List<String> failedItems(final JsonNode response) {
    final List<String> failed = new ArrayList<>();
    if (response.path("errors").asBoolean(false)) {
      for (JsonNode item : response.path("items")) {
        addIfFailed(failed, item);
      }
    }
    return failed;
  }

  private static void addIfFailed(final List<String> failed, final JsonNode item) {
    final boolean isDelete = item.has(DELETE_ACTION);
    final JsonNode result = isDelete ? item.path(DELETE_ACTION) : item.path(INDEX_ACTION);
    final int status = result.path("status").asInt();
    if (status >= FIRST_ERROR_STATUS && !(isDelete && status == NOT_FOUND)) {
      failed.add(result.path("_id").asText());
    }
  }

  private List<String> aliasedIndices() {
    final RawSearchResponse response = execute(GET, "/_alias/" + alias(), null);
    final List<String> indices = new ArrayList<>();
    if (isSuccess(response)) {
      JsonUtils.readTree(response.body()).fieldNames().forEachRemaining(indices::add);
    }
    return indices;
  }

  private Map<String, Object> aliasAction(final String action, final String index) {
    return Map.of(action, Map.of("index", index, "alias", alias()));
  }

  private String mappingWithHash() {
    final ObjectNode definition = (ObjectNode) JsonUtils.readTree(mapping());
    final ObjectNode mappings = (ObjectNode) definition.path("mappings");
    mappings.putObject(META).put(MAPPING_HASH, mappingHash());
    return definition.toString();
  }

  private String mappingHash() {
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

  private String mapping() {
    String content = null;
    try (InputStream stream = GovernanceSearchIndex.class.getResourceAsStream(mappingResource)) {
      if (stream == null) {
        throw new IllegalStateException("Missing index mapping " + mappingResource);
      }
      content = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read index mapping " + mappingResource, exception);
    }
    return content;
  }

  private RawSearchResponse execute(final String method, final String endpoint, final String body) {
    RawSearchResponse response = null;
    try {
      response =
          Entity.getSearchRepository().getSearchClient().rawSearchRequest(method, endpoint, body);
      recordReachability(response.statusCode() < FIRST_SERVER_ERROR_STATUS);
    } catch (IOException | UnsupportedOperationException exception) {
      recordReachability(false);
      throw new GovernanceSearchUnavailableException(
          String.format("Search engine request %s %s failed", method, endpoint), exception);
    }
    return response;
  }

  private static boolean isSuccess(final RawSearchResponse response) {
    return response.statusCode() < FIRST_ERROR_STATUS;
  }

  private void requireSuccess(final RawSearchResponse response, final String operation) {
    if (!isSuccess(response)) {
      throw failure(operation, response);
    }
  }

  private GovernanceSearchUnavailableException failure(
      final String operation, final RawSearchResponse response) {
    return new GovernanceSearchUnavailableException(
        String.format(
            "%s operation '%s' failed with status %d: %s",
            logicalName, operation, response.statusCode(), response.body()));
  }
}
