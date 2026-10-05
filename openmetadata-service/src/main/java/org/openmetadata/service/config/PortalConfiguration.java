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
 * Portal mode runs this same server as the Portal service for every non-admin role: it serves the
 * Portal UI build and leaves the pipeline service, the background workers and the seed data to the
 * OpenMetadata server. Login, users, roles, policies, search and writes stay exactly as in
 * OpenMetadata, governed by RBAC.
 */
@Getter
@Setter
public class PortalConfiguration {
  public static final String OPENMETADATA_ASSETS = "/assets";
  public static final String PORTAL_ASSETS = "/portal-assets";

  private static volatile boolean active = false;

  @JsonProperty private boolean enabled = false;

  /** Set once at startup, before any component that writes at startup or in the background. */
  public static void activate(PortalConfiguration configuration) {
    active = configuration.isEnabled();
  }

  /** True when this server is the Portal, which leaves startup writes and background work to OpenMetadata. */
  public static boolean isActive() {
    return active;
  }

  public String getAssetResourcePath() {
    return enabled ? PORTAL_ASSETS : OPENMETADATA_ASSETS;
  }
}
