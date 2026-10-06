package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * End-to-end flow of the Technical Dictionary read through its own search index: declare a Column,
 * find it, edit, submit, approve, read as a consumer, delete another Draft.
 *
 * <p>Isolated because the flow approves the Technical Dictionary catalog version so that consumers
 * can read it, which changes state shared with other tests of the same glossary.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class TechnicalDictionaryIT {
  private static final String TECHNICAL_GLOSSARY = "Technical Dictionary";
  private static final String BASE = "/v1/glossaryTerms/technical";
  private static final String DRAFT = "Draft";
  private static final String IN_REVIEW = "In Review";
  private static final String APPROVED = "Approved";
  private static final int BULK_REVIEW_LIMIT = 100;

  @Test
  void declareSearchEditApproveConsumerReadAndDeleteDraft(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTable(ns, "brcd", "name");
    String glossaryId = technicalGlossaryId(admin);
    String scope = openCatalogScope(admin, glossaryId);
    String approvedColumn = table.getFullyQualifiedName() + ".brcd";
    String draftColumn = table.getFullyQualifiedName() + ".name";
    long approvedBefore = stats(admin, glossaryId, scope).path("approved").asLong();

    JsonNode declared = declare(admin, glossaryId, scope, approvedColumn);
    String termId = declared.path("termId").asText();
    assertEquals(DRAFT, declared.path("entityStatus").asText());
    assertFalse(declared.path("hasPublished").asBoolean());
    assertEquals(termId, search(admin, glossaryId, scope, approvedColumn).path("termId").asText());

    ApiException duplicate =
        assertThrows(ApiException.class, () -> declare(admin, glossaryId, scope, approvedColumn));
    assertEquals(409, duplicate.getStatusCode());
    assertTrue(String.valueOf(duplicate.getResponseBody()).contains("TD_COLUMN_ALREADY_DECLARED"));

    long revision = declared.path("workingRevision").asLong();
    JsonNode edited = editDescription(admin, termId, scope, revision);
    assertTrue(edited.path("workingRevision").asLong() > revision);
    transition(admin, termId, scope, "submit", edited.path("workingRevision").asLong());
    JsonNode inReview = search(admin, glossaryId, scope, approvedColumn);
    assertEquals(IN_REVIEW, inReview.path("entityStatus").asText());
    transition(admin, termId, scope, "approve", inReview.path("workingRevision").asLong());
    JsonNode approved = search(admin, glossaryId, scope, approvedColumn);
    assertEquals(APPROVED, approved.path("entityStatus").asText());
    assertTrue(approved.path("hasPublished").asBoolean());
    assertEquals(approvedBefore + 1, stats(admin, glossaryId, scope).path("approved").asLong());

    approveCatalogIfWorking(admin, glossaryId);
    assertEquals(
        termId, search(SdkClients.dataConsumerClient(), glossaryId, scope, approvedColumn).path("termId").asText());

    JsonNode other = declare(admin, glossaryId, scope, draftColumn);
    ApiException cannotDeleteApproved =
        assertThrows(ApiException.class, () -> delete(admin, termId, scope));
    assertEquals(409, cannotDeleteApproved.getStatusCode());
    delete(admin, other.path("termId").asText(), scope);
    assertTrue(searchRows(admin, glossaryId, scope, draftColumn).isEmpty());
  }

  @Test
  void bulkReviewRejectsAnUnusableBody() {
    OpenMetadataClient admin = SdkClients.adminClient();
    String recordId = UUID.randomUUID().toString();
    List<Map<String, Object>> overTheLimit =
        IntStream.range(0, BULK_REVIEW_LIMIT + 1)
            .mapToObj(index -> bulkItem(UUID.randomUUID().toString(), 1))
            .toList();
    List<List<Map<String, Object>>> unusable =
        List.of(
            List.of(),
            List.of(Map.of("id", recordId)),
            List.of(Map.of("id", "not-a-uuid", "expectedRevision", 1)),
            List.of(bulkItem(recordId, 1), bulkItem(recordId, 2)),
            overTheLimit);

    for (String action : List.of("submit", "approve", "reject")) {
      for (List<Map<String, Object>> items : unusable) {
        ApiException invalid =
            assertThrows(ApiException.class, () -> bulkReview(admin, action, items));
        assertEquals(400, invalid.getStatusCode());
        assertTrue(String.valueOf(invalid.getResponseBody()).contains("TD_INVALID_FIELD"));
      }
    }
  }

  @Test
  void bulkReviewReportsAnUnknownRecordAndStillAnswers() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String unknown = UUID.randomUUID().toString();

    for (String action : List.of("submit", "approve", "reject")) {
      JsonNode result = bulkReview(admin, action, List.of(bulkItem(unknown, 1)));

      assertEquals(0, result.path("succeeded").asInt());
      assertEquals(1, result.path("failed").asInt());
      JsonNode outcome = result.path("results").get(0);
      assertEquals(unknown, outcome.path("termId").asText());
      assertEquals("FAILED", outcome.path("outcome").asText());
      assertTrue(outcome.path("code").asText().startsWith("TD_"));
      assertFalse(outcome.path("message").asText().isBlank());
    }
  }

  @Test
  void bulkReviewIsForEditorsAndApproversOnly() {
    OpenMetadataClient consumer = SdkClients.dataConsumerClient();

    for (String action : List.of("submit", "approve", "reject")) {
      ApiException forbidden =
          assertThrows(
              ApiException.class,
              () ->
                  bulkReview(consumer, action, List.of(bulkItem(UUID.randomUUID().toString(), 1))));
      assertEquals(403, forbidden.getStatusCode());
    }
  }

  private static Map<String, Object> bulkItem(String id, long expectedRevision) {
    return Map.of("id", id, "expectedRevision", expectedRevision);
  }

  private static JsonNode bulkReview(
      OpenMetadataClient client, String action, List<Map<String, Object>> items)
      throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            BASE + "/records/bulk/" + action,
            Map.of("items", items),
            JsonNode.class);
  }

  private static Table createTable(TestNamespace ns, String... columnNames) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    List<Column> columns =
        Arrays.stream(columnNames)
            .map(name -> Columns.build(name).withType(ColumnDataType.VARCHAR).withLength(50).create())
            .toList();
    return Tables.create()
        .name(ns.prefix("td_table"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(columns)
        .execute();
  }

  private static String technicalGlossaryId(OpenMetadataClient client) throws Exception {
    JsonNode glossary =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/glossaries/name/" + encode(TECHNICAL_GLOSSARY),
                null,
                JsonNode.class);
    assertNotNull(glossary.path("id").asText(null));
    return glossary.path("id").asText();
  }

  /** The catalog version that accepts records: the working version, or the active Approved one. */
  private static String openCatalogScope(OpenMetadataClient client, String glossaryId)
      throws Exception {
    String scope;
    try {
      scope =
          client
              .getHttpClient()
              .execute(HttpMethod.GET, "/v1/glossaries/" + glossaryId + "/working", null, JsonNode.class)
              .path("businessVersion")
              .asText();
    } catch (ApiException noWorking) {
      scope =
          client
              .getHttpClient()
              .execute(
                  HttpMethod.GET, "/v1/glossaries/" + glossaryId + "/published/latest", null, JsonNode.class)
              .path("businessVersion")
              .asText();
    }
    return scope;
  }

  /** Consumers only read an Approved catalog version. */
  private static void approveCatalogIfWorking(OpenMetadataClient client, String glossaryId)
      throws Exception {
    try {
      JsonNode working =
          client
              .getHttpClient()
              .execute(HttpMethod.GET, "/v1/glossaries/" + glossaryId + "/working", null, JsonNode.class);
      client
          .getHttpClient()
          .execute(
              HttpMethod.POST,
              "/v1/glossaries/" + glossaryId + "/working/approve",
              Map.of("expectedRevision", working.path("workingRevision").asLong()),
              JsonNode.class);
    } catch (ApiException alreadyApproved) {
      assertEquals(404, alreadyApproved.getStatusCode());
    }
  }

  private static JsonNode declare(
      OpenMetadataClient client, String glossaryId, String scope, String columnFqn)
      throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            BASE + "/records?glossary=" + glossaryId + "&parentBusinessVersion=" + scope,
            Map.of("columnFqn", columnFqn),
            JsonNode.class);
  }

  private static JsonNode searchRows(
      OpenMetadataClient client, String glossaryId, String scope, String columnFqn)
      throws Exception {
    String tableName = columnFqn.substring(0, columnFqn.lastIndexOf('.'));
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            BASE
                + "/search?glossary="
                + glossaryId
                + "&parentBusinessVersion="
                + scope
                + "&limit=50&q="
                + encode(tableName.substring(tableName.lastIndexOf('.') + 1)),
            null,
            JsonNode.class)
        .path("data");
  }

  private static JsonNode search(
      OpenMetadataClient client, String glossaryId, String scope, String columnFqn)
      throws Exception {
    for (JsonNode row : searchRows(client, glossaryId, scope, columnFqn)) {
      if (columnFqn.equals(row.path("extension").path("sourceColumnFqn").asText())) {
        return row;
      }
    }
    throw new AssertionError("Column " + columnFqn + " was not found in the Technical index");
  }

  private static JsonNode stats(OpenMetadataClient client, String glossaryId, String scope)
      throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            BASE + "/stats?glossary=" + glossaryId + "&parentBusinessVersion=" + scope,
            null,
            JsonNode.class);
  }

  private static JsonNode editDescription(
      OpenMetadataClient client, String termId, String scope, long revision) throws Exception {
    Map<String, Object> body =
        Map.of(
            "expectedRevision", revision,
            "description", "Edited by integration test",
            "owners", List.of(),
            "domains", List.of(),
            "tags", List.of(),
            "extension", Map.of());
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PATCH,
            "/v1/glossaryTerms/" + termId + "/working?parentBusinessVersion=" + scope,
            body,
            JsonNode.class);
  }

  private static void transition(
      OpenMetadataClient client, String termId, String scope, String action, long revision)
      throws Exception {
    client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/glossaryTerms/" + termId + "/working/" + action + "?parentBusinessVersion=" + scope,
            Map.of("expectedRevision", revision),
            JsonNode.class);
  }

  private static void delete(OpenMetadataClient client, String termId, String scope)
      throws Exception {
    client
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            BASE + "/records/" + UUID.fromString(termId) + "?parentBusinessVersion=" + scope,
            null,
            JsonNode.class);
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
