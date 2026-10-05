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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.security.Principal;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class AdminOnlyFilterTest {
  @Test
  void rejectsAnAuthenticatedUserWhoIsNotAnAdmin() {
    ContainerRequestContext request = request("steward", "v1/tables");

    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("steward"))
          .thenReturn(new SubjectContext(new User().withName("steward").withIsAdmin(false), null));

      new AdminOnlyFilter().filter(request);
    }

    ArgumentCaptor<Response> response = ArgumentCaptor.forClass(Response.class);
    verify(request).abortWith(response.capture());
    assertEquals(Response.Status.FORBIDDEN.getStatusCode(), response.getValue().getStatus());
  }

  @Test
  void rejectsAUserThatDoesNotExist() {
    ContainerRequestContext request = request("ghost", "v1/tables");

    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
      subjects
          .when(() -> SubjectContext.getSubjectContext("ghost"))
          .thenThrow(EntityNotFoundException.byMessage("not found"));

      new AdminOnlyFilter().filter(request);
    }

    verify(request).abortWith(any(Response.class));
  }

  @Test
  void letsAdminsAndBotsThrough() {
    for (User user :
        new User[] {
          new User().withName("admin").withIsAdmin(true),
          new User().withName("ingestion-bot").withIsBot(true)
        }) {
      ContainerRequestContext request = request(user.getName(), "v1/tables");

      try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
        subjects
            .when(() -> SubjectContext.getSubjectContext(user.getName()))
            .thenReturn(new SubjectContext(user, null));

        new AdminOnlyFilter().filter(request);
      }

      verify(request, never()).abortWith(any(Response.class));
    }
  }

  @Test
  void leavesPublicEndpointsAndAnonymousRequestsToAuthentication() {
    ContainerRequestContext anonymous = request(null, "v1/tables");
    ContainerRequestContext login = request("steward", "/v1/users/login/");

    new AdminOnlyFilter().filter(anonymous);
    new AdminOnlyFilter().filter(login);

    verify(anonymous, never()).abortWith(any(Response.class));
    verify(login, never()).abortWith(any(Response.class));
  }

  @Test
  void treatsOnlyTheLoginAndConfigurationEndpointsAsPublic() {
    assertTrue(AdminOnlyFilter.isPublic("v1/users/login"));
    assertTrue(AdminOnlyFilter.isPublic("v1/system/config/auth"));
    assertFalse(AdminOnlyFilter.isPublic("v1/users/loggedInUser"));
    assertFalse(AdminOnlyFilter.isPublic("v1/tables"));
  }

  private static ContainerRequestContext request(String userName, String path) {
    ContainerRequestContext request = mock(ContainerRequestContext.class);
    UriInfo uriInfo = mock(UriInfo.class);
    SecurityContext security = mock(SecurityContext.class);
    Principal principal = userName == null ? null : () -> userName;
    when(uriInfo.getPath()).thenReturn(path);
    when(security.getUserPrincipal()).thenReturn(principal);
    when(request.getUriInfo()).thenReturn(uriInfo);
    when(request.getSecurityContext()).thenReturn(security);
    when(request.getMethod()).thenReturn("GET");
    return request;
  }
}
