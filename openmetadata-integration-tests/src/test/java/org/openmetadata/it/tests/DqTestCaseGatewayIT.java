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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.dq.DqRuleContext;
import org.openmetadata.service.glossary.dq.DqTestCaseGateway;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;

/**
 * The testcases a Data Quality Rule manages are updated in place when its declaration changes, and
 * a testcase that lost its relationships is repaired in place, keeping its id and results.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DqTestCaseGatewayIT {
  private static final String NOT_NULL_DEFINITION = "columnValuesToBeNotNull";

  @Test
  void changedDeclaration_updatesTheExistingTestCase(TestNamespace ns) {
    final ColumnRow column = column(createTable(ns, "dqUpd"));
    final DqTestSpec spec = spec("Not null");
    final TestCase created = upsert(rule(ns, "first"), spec, column);

    final TestCase updated = upsert(rule(ns, "second"), spec.withName("Not null 2"), column);

    assertEquals(created.getId(), updated.getId());
    assertEquals("second", updated.getDescription());
    assertLinked(updated.getId());
  }

  @Test
  void testCaseWithoutRelationships_isRepairedInPlace(TestNamespace ns) {
    final ColumnRow column = column(createTable(ns, "dqRep"));
    final DqTestSpec spec = spec("Not null");
    final TestCase created = upsert(rule(ns, "first"), spec, column);
    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(
            created.getId(),
            Entity.TEST_CASE,
            Relationship.CONTAINS.ordinal(),
            Entity.TEST_DEFINITION);

    final TestCase repaired = upsert(rule(ns, "second"), spec, column);

    assertEquals(created.getId(), repaired.getId());
    assertEquals("second", repaired.getDescription());
    assertLinked(repaired.getId());
  }

  private static TestCase upsert(DqRuleContext rule, DqTestSpec spec, ColumnRow column) {
    final TestDefinition definition = DqTestCaseGateway.definitionOf(rule, spec);
    return DqTestCaseGateway.upsert(rule, spec, definition, column);
  }

  private static void assertLinked(UUID testCaseId) {
    final TestCase testCase =
        Entity.getEntity(Entity.TEST_CASE, testCaseId, "testSuite,testDefinition", Include.ALL);
    assertNotNull(testCase.getTestSuite(), "basic test suite relationship");
    assertEquals(NOT_NULL_DEFINITION, testCase.getTestDefinition().getFullyQualifiedName());
    assertEquals(1, countTestDefinitionEdges(testCaseId));
  }

  private static DqRuleContext rule(TestNamespace ns, String description) {
    return new DqRuleContext(
        UUID.nameUUIDFromBytes(ns.prefix("rule").getBytes()),
        "DQIT",
        null,
        "Gateway rule",
        description,
        "1",
        "1.0",
        null,
        List.of(),
        null,
        null);
  }

  private static DqTestSpec spec(String name) {
    return new DqTestSpec()
        .withKey("t1")
        .withName(name)
        .withKind(DqTestSpecKind.LIBRARY)
        .withTestDefinitionFqn(NOT_NULL_DEFINITION);
  }

  private static ColumnRow column(Table table) {
    return new ColumnRow(
        UUID.randomUUID().toString(), table.getFullyQualifiedName() + ".id", "BIGINT", null);
  }

  private static Table createTable(TestNamespace ns, String prefix) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final String id = ns.uniqueShortId();
    final Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(prefix + "Db_" + id)
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    final DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(prefix + "Sc_" + id)
                    .withDatabase(database.getFullyQualifiedName()));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(prefix + "Tb_" + id)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static int countTestDefinitionEdges(UUID testCaseId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship WHERE toId = :id "
                            + "AND toEntity = 'testCase' AND fromEntity = 'testDefinition' "
                            + "AND relation = :rel")
                    .bind("id", testCaseId.toString())
                    .bind("rel", Relationship.CONTAINS.ordinal())
                    .mapTo(Integer.class)
                    .one());
  }
}
