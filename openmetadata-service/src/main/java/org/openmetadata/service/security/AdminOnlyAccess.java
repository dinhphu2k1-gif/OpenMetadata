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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.config.AdminOnlyConfiguration;

/** Who may use the OpenMetadata server when it runs in admin-only mode. */
@Slf4j
public final class AdminOnlyAccess {
  public static final String DENIED_MESSAGE =
      "This account can only use the Portal. Only administrators can use OpenMetadata";

  private AdminOnlyAccess() {}

  /** Admin users and bots (ingestion and other service accounts) are allowed. */
  public static boolean isAllowed(User user) {
    return user != null
        && (Boolean.TRUE.equals(user.getIsAdmin()) || Boolean.TRUE.equals(user.getIsBot()));
  }

  /** Called when a login completes, before any token reaches the user. */
  public static void requireAllowedLogin(User user) {
    if (AdminOnlyConfiguration.isActive() && !isAllowed(user)) {
      LOG.warn("event=denied user={} reason=login", user == null ? null : user.getName());
      throw new AuthorizationException(DENIED_MESSAGE);
    }
  }
}
