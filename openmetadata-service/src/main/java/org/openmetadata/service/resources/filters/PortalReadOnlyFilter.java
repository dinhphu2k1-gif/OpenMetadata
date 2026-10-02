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

package org.openmetadata.service.resources.filters;

import jakarta.annotation.Priority;
import jakarta.ws.rs.HttpMethod;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;

/**
 * Registered only in Portal mode. Reads pass through to the usual authentication and RBAC; every
 * request that could change data is rejected, except the few POST endpoints that only log in or
 * read.
 */
@Slf4j
@PreMatching
@Priority(Priorities.AUTHENTICATION - 100)
public class PortalReadOnlyFilter implements ContainerRequestFilter {
  private static final Set<String> READ_METHODS =
      Set.of(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS);

  /** Paths relative to the API root, for example {@code v1/users/login}. */
  static final Set<String> ALLOWED_POST_PATHS =
      Set.of("v1/users/login", "v1/users/refresh", "v1/users/logout", "v1/search/aggregate");

  @Override
  public void filter(ContainerRequestContext requestContext) {
    final String method = requestContext.getMethod();
    final String path = requestContext.getUriInfo().getPath();
    if (!isAllowed(method, path)) {
      LOG.debug("Portal rejected {} {}", method, path);
      requestContext.abortWith(readOnlyResponse());
    }
  }

  private static Response readOnlyResponse() {
    return Response.status(Response.Status.FORBIDDEN)
        .type(MediaType.APPLICATION_JSON_TYPE)
        .entity(
            Map.of(
                "code",
                Response.Status.FORBIDDEN.getStatusCode(),
                "message",
                "The Portal is read-only"))
        .build();
  }

  static boolean isAllowed(String method, String path) {
    return READ_METHODS.contains(method)
        || (HttpMethod.POST.equals(method) && ALLOWED_POST_PATHS.contains(normalize(path)));
  }

  private static String normalize(String path) {
    return path == null ? "" : path.replaceAll("^/+|/+$", "");
  }
}
