package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class GlossaryWorkflowSupportTest {
  private GlossaryWorkflowRequest request(double version) {
    GlossaryWorkflowRequest request = new GlossaryWorkflowRequest();
    request.setExpectedNativeVersion(version);
    return request;
  }

  private SubjectContext administrator() {
    return new SubjectContext(new User().withName("admin").withIsAdmin(true), null);
  }

  @Test
  void validatesCompleteStateMachineForAdministrator() {
    SubjectContext subject = administrator();
    assertEquals(
        EntityStatus.DRAFT,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.CREATE_DRAFT,
            EntityStatus.APPROVED,
            1.0,
            request(1.0),
            subject,
            List.of(),
            List.of()));
    assertEquals(
        EntityStatus.IN_REVIEW,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.SUBMIT,
            EntityStatus.DRAFT,
            1.1,
            request(1.1),
            subject,
            List.of(),
            List.of()));
    assertEquals(
        EntityStatus.APPROVED,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.APPROVE,
            EntityStatus.IN_REVIEW,
            1.2,
            request(1.2),
            subject,
            List.of(),
            List.of()));
    assertEquals(
        EntityStatus.REJECTED,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.REJECT,
            EntityStatus.IN_REVIEW,
            1.2,
            request(1.2),
            subject,
            List.of(),
            List.of()));
    assertEquals(
        EntityStatus.DRAFT,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.REOPEN,
            EntityStatus.REJECTED,
            1.3,
            request(1.3),
            subject,
            List.of(),
            List.of()));
  }

  @Test
  void acceptsReasonlessReviewAndRejectsInvalidTransitionAndVersionConflict() {
    SubjectContext subject = administrator();
    assertEquals(
        EntityStatus.REJECTED,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.REJECT,
            EntityStatus.IN_REVIEW,
            1.0,
            request(1.0),
            subject,
            List.of(),
            List.of()));
    assertEquals(
        EntityStatus.DRAFT,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.REVOKE,
            EntityStatus.APPROVED,
            1.0,
            request(1.0),
            subject,
            List.of(),
            List.of()));
    assertThrows(
        BadRequestException.class,
        () ->
            GlossaryWorkflowSupport.validate(
                GlossaryWorkflowSupport.Action.APPROVE,
                EntityStatus.DRAFT,
                1.0,
                request(1.0),
                subject,
                List.of(),
                List.of()));
    assertEquals(
        409,
        assertThrows(
                WebApplicationException.class,
                () ->
                    GlossaryWorkflowSupport.validate(
                        GlossaryWorkflowSupport.Action.SUBMIT,
                        EntityStatus.DRAFT,
                        1.1,
                        request(1.0),
                        subject,
                        List.of(),
                        List.of()))
            .getResponse()
            .getStatus());
  }

  @Test
  void enforcesProposerAndReviewerAssignments() {
    SubjectContext proposer =
        new SubjectContext(
            new User()
                .withName("proposer")
                .withRoles(List.of(new EntityReference().withName("DataProposer"))),
            null);
    assertThrows(
        ForbiddenException.class,
        () ->
            GlossaryWorkflowSupport.validate(
                GlossaryWorkflowSupport.Action.APPROVE,
                EntityStatus.IN_REVIEW,
                1.0,
                request(1.0),
                proposer,
                List.of(),
                List.of()));

    SubjectContext reviewer = new SubjectContext(new User().withName("reviewer"), null);
    assertEquals(
        EntityStatus.APPROVED,
        GlossaryWorkflowSupport.validate(
            GlossaryWorkflowSupport.Action.APPROVE,
            EntityStatus.IN_REVIEW,
            1.0,
            request(1.0),
            reviewer,
            List.of(),
            List.of(new EntityReference().withType("user").withName("reviewer"))));
  }
}
