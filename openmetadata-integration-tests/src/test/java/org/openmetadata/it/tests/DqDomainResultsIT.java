/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Results and trend of the Data Quality Rules of a Domain. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DqDomainResultsIT {
  private static final String BASE = "/v1/glossaryTerms/dataQuality/domains/";
  private static final int NOT_FOUND = 404;

  @Test
  void domainWithoutRulesHasEmptyResults(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Domain domain = createDomain(client, ns.prefix("dq_domain"));

    final JsonNode results = get(client, BASE + domain.getId() + "/results");

    assertEquals(domain.getId().toString(), results.get("domainId").asText());
    assertEquals(0, results.get("summary").get("rules").asInt());
    assertEquals(0, results.get("summary").get("testCases").asInt());
    assertTrue(results.get("rules").isEmpty());
    assertTrue(results.get("testCases").isEmpty());
    assertEquals(0, results.get("paging").get("total").asInt());
  }

  @Test
  void domainWithoutRulesHasEmptyTrend(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Domain domain = createDomain(client, ns.prefix("dq_domain_trend"));

    final JsonNode trend =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                BASE + domain.getId() + "/trend",
                null,
                JsonNode.class,
                RequestOptions.builder().queryParam("days", "90").build());

    assertEquals(90, trend.get("days").asInt());
    assertTrue(trend.get("points").isEmpty());
  }

  @Test
  void unknownDomainIsNotFound() {
    final OpenMetadataClient client = SdkClients.adminClient();

    final OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> get(client, BASE + UUID.randomUUID() + "/results"));

    assertEquals(NOT_FOUND, error.getStatusCode());
  }

  private static JsonNode get(OpenMetadataClient client, String path) {
    return client.getHttpClient().execute(HttpMethod.GET, path, null, JsonNode.class);
  }

  private static Domain createDomain(OpenMetadataClient client, String name) {
    final CreateDomain request = new CreateDomain();
    request.setName(name);
    request.setDescription("Domain for Data Quality Rule results");
    request.setDomainType(CreateDomain.DomainType.AGGREGATE);
    return client.domains().create(request);
  }
}
