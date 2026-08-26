/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;

class BasicConsumerPolicyContractTest {
  private static final String POLICY_RESOURCE = "json/data/policy/BasicConsumerPolicy.json";
  private static final String PERSONA_NAVIGATION_RESOURCE =
      "json/data/document/docs/persona.BasicConsumerPersona.json";
  private static final Set<String> BUSINESS_RESOURCES =
      Set.of(
          "classification",
          "dataProduct",
          "document",
          "domain",
          "glossary",
          "glossaryTerm",
          "persona",
          "tag",
          "team",
          "testCase",
          "testSuite",
          "user");

  @Test
  void permitsOnlyReadOperationsOnBusinessMetadata() {
    JsonNode policy = loadPolicy();
    JsonNode allowRule = rule(policy, "BasicConsumerPolicy-ViewBusinessMetadata");

    assertEquals(BUSINESS_RESOURCES, values(allowRule.path("resources")));
    assertEquals(Set.of("ViewAll", "ViewBasic"), values(allowRule.path("operations")));
    assertEquals("allow", allowRule.path("effect").asText());
  }

  @Test
  void exposesOnlyTheApprovedBasicConsumerNavigationLeaves() {
    JsonNode document = loadJson(PERSONA_NAVIGATION_RESOURCE);
    Set<String> visibleLeaves = new java.util.HashSet<>();
    collectVisibleLeaves(document.path("data").path("navigation"), visibleLeaves);

    assertEquals(Set.of("/my-data", "/explore", "/domain", "/glossary", "/tags"), visibleLeaves);
  }

  @Test
  void deniesEveryCurrentOperationExceptTheTwoReadOperations() {
    JsonNode policy = loadPolicy();
    JsonNode denyRule = rule(policy, "BasicConsumerPolicy-DenyNonReadOperations");
    Set<String> expectedDeniedOperations =
        Arrays.stream(MetadataOperation.values())
            .map(MetadataOperation::value)
            .filter(operation -> !operation.startsWith("View") && !"All".equals(operation))
            .collect(Collectors.toSet());

    assertEquals(BUSINESS_RESOURCES, values(denyRule.path("resources")));
    assertEquals(expectedDeniedOperations, values(denyRule.path("operations")));
    assertEquals("deny", denyRule.path("effect").asText());
  }

  @Test
  void deniesAllOperationsOnCriticalTechnicalResources() {
    JsonNode policy = loadPolicy();
    JsonNode denyRule = rule(policy, "BasicConsumerPolicy-DenyNonBusinessResources");
    Set<String> deniedResources = values(denyRule.path("resources"));

    assertEquals(Set.of("All"), values(denyRule.path("operations")));
    assertEquals("deny", denyRule.path("effect").asText());
    assertTrue(
        Set.of(
                "table",
                "database",
                "databaseSchema",
                "dashboard",
                "pipeline",
                "topic",
                "metric",
                "thread",
                "role",
                "policy")
            .stream().allMatch(deniedResources::contains));
    assertTrue(BUSINESS_RESOURCES.stream().noneMatch(deniedResources::contains));
  }

  private JsonNode loadPolicy() {
    return loadJson(POLICY_RESOURCE);
  }

  private JsonNode loadJson(String resource) {
    try (InputStream input = getClass().getClassLoader().getResourceAsStream(resource)) {
      assertNotNull(input, "Could not locate " + resource + " on the test classpath");
      return JsonUtils.readTree(new String(input.readAllBytes(), StandardCharsets.UTF_8));
    } catch (Exception exception) {
      throw new AssertionError("Failed to read " + resource, exception);
    }
  }

  private void collectVisibleLeaves(JsonNode items, Set<String> visibleLeaves) {
    for (JsonNode item : items) {
      if (item.path("isHidden").asBoolean(false)) continue;
      JsonNode children = item.path("children");
      if (children.isArray() && !children.isEmpty()) {
        collectVisibleLeaves(children, visibleLeaves);
      } else {
        visibleLeaves.add(item.path("id").asText());
      }
    }
  }

  private JsonNode rule(JsonNode policy, String name) {
    List<JsonNode> rules = new java.util.ArrayList<>();
    policy.path("rules").forEach(rules::add);
    return rules.stream()
        .filter(rule -> name.equals(rule.path("name").asText()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Missing rule " + name));
  }

  private Set<String> values(JsonNode array) {
    return java.util.stream.StreamSupport.stream(array.spliterator(), false)
        .map(JsonNode::asText)
        .collect(Collectors.toSet());
  }
}
