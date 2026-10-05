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
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.config.AdminOnlyConfiguration;
import org.openmetadata.service.config.PortalConfiguration;

class AdminOnlyAccessTest {
  @AfterEach
  void reset() {
    AdminOnlyConfiguration.activate(new AdminOnlyConfiguration(), new PortalConfiguration());
  }

  @Test
  void allowsAdminsAndBotsOnly() {
    assertTrue(AdminOnlyAccess.isAllowed(new User().withIsAdmin(true)));
    assertTrue(AdminOnlyAccess.isAllowed(new User().withIsBot(true)));
    assertFalse(AdminOnlyAccess.isAllowed(new User().withIsAdmin(false).withIsBot(false)));
    assertFalse(AdminOnlyAccess.isAllowed(new User()));
    assertFalse(AdminOnlyAccess.isAllowed(null));
  }

  @Test
  void everyoneMayLogInWhenNotAdminOnly() {
    assertDoesNotThrow(() -> AdminOnlyAccess.requireAllowedLogin(new User().withName("steward")));
  }

  @Test
  void refusesTheLoginOfOtherUsersInAdminOnlyMode() {
    activate();

    assertThrows(
        AuthorizationException.class,
        () -> AdminOnlyAccess.requireAllowedLogin(new User().withName("steward")));
    assertDoesNotThrow(
        () -> AdminOnlyAccess.requireAllowedLogin(new User().withName("admin").withIsAdmin(true)));
    assertDoesNotThrow(
        () -> AdminOnlyAccess.requireAllowedLogin(new User().withName("bot").withIsBot(true)));
  }

  private static void activate() {
    AdminOnlyConfiguration configuration = new AdminOnlyConfiguration();
    configuration.setEnabled(true);
    AdminOnlyConfiguration.activate(configuration, new PortalConfiguration());
  }
}
