/*
 *  Copyright 2021 Collate
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

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;

class UserRepositoryDefaultPersonaTest {

  private static EntityReference reference(String type, String name) {
    return new EntityReference().withType(type).withName(name).withFullyQualifiedName(name);
  }

  @Test
  void adminNeverReceivesARestrictedPersona() {
    EntityReference basicRole = reference("role", UserRepository.BASIC_CONSUMER_ROLE);
    EntityReference basicPersona = reference("persona", UserRepository.BASIC_CONSUMER_PERSONA);

    assertNull(
        UserRepository.resolveDefaultPersona(true, List.of(basicRole), null, basicPersona, null));
  }

  @Test
  void basicConsumerReceivesTheSeededRestrictedPersona() {
    EntityReference basicRole = reference("role", UserRepository.BASIC_CONSUMER_ROLE);
    EntityReference basicPersona = reference("persona", UserRepository.BASIC_CONSUMER_PERSONA);
    EntityReference explicitPersona = reference("persona", "AnotherPersona");

    assertSame(
        basicPersona,
        UserRepository.resolveDefaultPersona(
            false, List.of(basicRole), explicitPersona, basicPersona, null));
  }

  @Test
  void nonBasicConsumerDoesNotKeepAStaleBasicConsumerPersona() {
    EntityReference dataConsumerRole = reference("role", "DataConsumer");
    EntityReference staleBasicPersona = reference("persona", UserRepository.BASIC_CONSUMER_PERSONA);

    assertNull(
        UserRepository.resolveDefaultPersona(
            false, List.of(dataConsumerRole), staleBasicPersona, staleBasicPersona, null));
  }

  @Test
  void nonBasicConsumerKeepsAnExplicitCustomPersona() {
    EntityReference dataStewardRole = reference("role", "DataSteward");
    EntityReference customPersona = reference("persona", "DataStewardPersona");
    EntityReference basicPersona = reference("persona", UserRepository.BASIC_CONSUMER_PERSONA);

    assertSame(
        customPersona,
        UserRepository.resolveDefaultPersona(
            false, List.of(dataStewardRole), customPersona, basicPersona, null));
  }

  @Test
  void regularUserFallsBackToTheSystemDefaultWhenConfigured() {
    EntityReference systemDefault = reference("persona", "CompanyDefault");
    EntityReference basicPersona = reference("persona", UserRepository.BASIC_CONSUMER_PERSONA);

    assertSame(
        systemDefault,
        UserRepository.resolveDefaultPersona(false, List.of(), null, basicPersona, systemDefault));
  }
}
