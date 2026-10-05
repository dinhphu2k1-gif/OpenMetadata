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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Admin-only mode keeps the OpenMetadata server and UI for administrators: only Admin users and
 * bots may log in and call the API, everyone else uses the Portal. It never applies to the Portal
 * server itself.
 */
@Getter
@Setter
public class AdminOnlyConfiguration {
  private static volatile boolean active = false;

  @JsonProperty private boolean enabled = false;

  /** Set once at startup. The Portal server ignores the setting. */
  public static void activate(AdminOnlyConfiguration configuration, PortalConfiguration portal) {
    active = configuration.isEnabled() && !portal.isEnabled();
  }

  /** True when only Admin users and bots may use this server. */
  public static boolean isActive() {
    return active;
  }
}
