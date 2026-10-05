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
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AdminOnlyAccess;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Registered only in admin-only mode, after authentication. Lets Admin users and bots through and
 * rejects every other authenticated user, including one holding a token issued by the Portal.
 * Requests without a user (the public login and configuration endpoints) are left to the usual
 * authentication.
 */
@Slf4j
@Priority(Priorities.AUTHENTICATION + 100)
public class AdminOnlyFilter implements ContainerRequestFilter {
  @Override
  public void filter(ContainerRequestContext requestContext) {
    final Principal principal = requestContext.getSecurityContext().getUserPrincipal();
    final String path = normalize(requestContext.getUriInfo().getPath());
    if (principal != null && !isPublic(path) && !isAllowed(principal.getName())) {
      LOG.warn(
          "event=denied user={} method={} path={}",
          principal.getName(),
          requestContext.getMethod(),
          path);
      requestContext.abortWith(deniedResponse());
    }
  }

  static boolean isPublic(String path) {
    return JwtFilter.EXCLUDED_ENDPOINTS.contains(path);
  }

  private static boolean isAllowed(String userName) {
    try {
      return AdminOnlyAccess.isAllowed(SubjectContext.getSubjectContext(userName).user());
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private static Response deniedResponse() {
    return Response.status(Response.Status.FORBIDDEN)
        .type(MediaType.APPLICATION_JSON_TYPE)
        .entity(
            Map.of(
                "code",
                Response.Status.FORBIDDEN.getStatusCode(),
                "message",
                AdminOnlyAccess.DENIED_MESSAGE))
        .build();
  }

  private static String normalize(String path) {
    return path == null ? "" : path.replaceAll("^/+|/+$", "");
  }
}
