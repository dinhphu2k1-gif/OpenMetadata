package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.notification.GovernedReviewNotifier;
import org.openmetadata.service.glossary.notification.ReviewDecision;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;

/**
 * Data stewards see one open task per governed catalog in their notification bell while the
 * catalog has In Review requests; it follows the pending count and closes once nothing is pending.
 *
 * <p>Isolated and sequential because the only glossary this fork allows is the shared Data
 * Dictionary, whose pending count every test here changes. Each test leaves it empty.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class GovernedReviewNotificationIT {
  private static final String DATA_DICTIONARY = "Data Dictionary";
  private static final String SUBMITTER = "admin";
  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private final List<UUID> insertedRequests = new ArrayList<>();
  private Glossary glossary;

  @BeforeEach
  void requireAnEmptyReviewQueue() {
    glossary = SdkClients.adminClient().glossaries().getByName(DATA_DICTIONARY);
    assertEquals(0, pendingCount(), "Data Dictionary must start without In Review requests");
  }

  @AfterEach
  void emptyTheReviewQueue() {
    insertedRequests.forEach(GovernedReviewNotificationIT::deleteWorking);
    insertedRequests.clear();
    GovernedReviewNotifier.glossaryTermDecided(glossary.getId(), SUBMITTER);
  }

  @Test
  void stewardsGetOneReviewTaskThatFollowsThePendingRequests(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "steward");
    final UUID first = insertInReview();
    final UUID second = insertInReview();

    GovernedReviewNotifier.collectDuring(
        () -> {
          GovernedReviewNotifier.glossaryTermSubmitted(glossary.getId(), SUBMITTER);
          GovernedReviewNotifier.glossaryTermSubmitted(glossary.getId(), SUBMITTER);
        });

    final List<Thread> open = openReviewTasks(steward);
    assertEquals(1, open.size());
    final Thread task = open.getFirst();
    assertEquals(TaskType.Generic, task.getTask().getType());
    assertEquals(SUBMITTER, task.getCreatedBy());
    assertEquals(pendingMessage(2), task.getMessage());
    assertTrue(isAssigned(task, steward));
    final Map<?, ?> pendingFacts = facts(task);
    assertEquals("PENDING", pendingFacts.get("kind"));
    assertEquals(2, ((Number) pendingFacts.get("pendingCount")).intValue());
    assertEquals(nameOf(glossary), pendingFacts.get("catalogName"));

    decide(first);
    final Thread refreshed = findTask(steward, task.getId());
    assertEquals(TaskStatus.Open, refreshed.getTask().getStatus());
    assertEquals(pendingMessage(1), refreshed.getMessage());

    decide(second);
    final Thread closed = findTask(steward, task.getId());
    assertEquals(TaskStatus.Closed, closed.getTask().getStatus());
    assertEquals("Không còn yêu cầu chờ duyệt trong " + nameOf(glossary), closed.getMessage());
    assertEquals(0, ((Number) facts(closed).get("pendingCount")).intValue());
  }

  @Test
  void aNewSubmissionAfterTheQueueEmptiedOpensANewTask(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "stewardAgain");
    decide(submitOne(SUBMITTER));
    final Thread closed = reviewTasks(steward).getFirst();
    assertEquals(TaskStatus.Closed, closed.getTask().getStatus());

    submitOne(SUBMITTER);

    final List<Thread> open = openReviewTasks(steward);
    assertEquals(1, open.size());
    assertNotEquals(closed.getId(), open.getFirst().getId());
  }

  @Test
  void theSubmittingStewardIsNotAskedToReviewTheirOwnRequest(TestNamespace ns) throws Exception {
    final User maker = createSteward(ns, "maker");
    final User checker = createSteward(ns, "checker");

    submitOne(maker.getName());

    final Thread task = openReviewTasks(checker).getFirst();
    assertEquals(maker.getName(), task.getCreatedBy());
    assertTrue(isAssigned(task, checker));
    assertFalse(isAssigned(task, maker));
    assertTrue(openReviewTasks(maker).isEmpty());
  }

  @Test
  void aDecisionWithoutAnOpenTaskCreatesNothing(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "idle");
    insertInReview();

    GovernedReviewNotifier.glossaryTermDecided(glossary.getId(), SUBMITTER);

    assertTrue(openReviewTasks(steward).isEmpty());
  }

  @Test
  void theSubmitterHearsThatASingleRequestWasApproved(TestNamespace ns) throws Exception {
    final User submitter = createUser(ns, "approvedMaker", List.of());

    GovernedReviewNotifier.glossaryTermReviewed(
        glossary.getId(),
        SUBMITTER,
        ReviewDecision.approved(
            submitter.getName(),
            "Tên khách hàng",
            new ReviewDecision.RecordRef("term-1", "Data Dictionary.CDE001", "1.1", "1")));

    final List<Thread> notices = decisionNotices(submitter);
    assertEquals(1, notices.size());
    final Thread notice = notices.getFirst();
    final Map<?, ?> decisionFacts = facts(notice);
    assertEquals("DECISION", decisionFacts.get("kind"));
    assertEquals(1, ((Number) decisionFacts.get("approvedCount")).intValue());
    assertEquals("Tên khách hàng", decisionFacts.get("requestName"));
    assertEquals("term-1", ((Map<?, ?>) decisionFacts.get("record")).get("id"));
    assertEquals(ThreadType.Conversation, notice.getType());
    assertEquals(SUBMITTER, notice.getCreatedBy());
    assertTrue(
        notice
            .getMessage()
            .endsWith("Yêu cầu \"Tên khách hàng\" đã được duyệt trong " + nameOf(glossary)));
  }

  @Test
  void aBatchOfDecisionsReachesEachSubmitterOnce(TestNamespace ns) throws Exception {
    final User submitter = createUser(ns, "batchMaker", List.of());

    GovernedReviewNotifier.collectDuring(
        () -> {
          GovernedReviewNotifier.glossaryTermReviewed(
              glossary.getId(), SUBMITTER, ReviewDecision.approved(submitter.getName(), "A"));
          GovernedReviewNotifier.glossaryTermReviewed(
              glossary.getId(), SUBMITTER, ReviewDecision.approved(submitter.getName(), "B"));
          GovernedReviewNotifier.glossaryTermReviewed(
              glossary.getId(), SUBMITTER, ReviewDecision.rejected(submitter.getName(), "C"));
        });

    final List<Thread> notices = decisionNotices(submitter);
    assertEquals(1, notices.size());
    assertTrue(
        notices
            .getFirst()
            .getMessage()
            .endsWith("2 yêu cầu đã được duyệt, 1 yêu cầu bị từ chối trong " + nameOf(glossary)));
  }

  @Test
  void aRejectionCarriesNoReason(TestNamespace ns) throws Exception {
    final User submitter = createUser(ns, "rejectedMaker", List.of());

    GovernedReviewNotifier.glossaryTermReviewed(
        glossary.getId(),
        SUBMITTER,
        ReviewDecision.rejected(submitter.getName(), "Tên khách hàng"));

    assertTrue(
        decisionNotices(submitter)
            .getFirst()
            .getMessage()
            .endsWith("Yêu cầu \"Tên khách hàng\" đã bị từ chối trong " + nameOf(glossary)));
  }

  @Test
  void theEndpointListsTasksAndDecisionsNewestFirstWithTotals(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "inbox");
    final OpenMetadataClient client = clientOf(steward);
    submitOne(SUBMITTER);
    GovernedReviewNotifier.glossaryTermReviewed(
        glossary.getId(), SUBMITTER, ReviewDecision.approved(steward.getName(), "Tên khách hàng"));

    final JsonNode all = notifications(client, "ALL", 0L);

    assertEquals(2, all.path("paging").path("total").asInt());
    assertEquals(2, all.path("data").size());
    assertEquals("Conversation", all.path("data").get(0).path("type").asText());
    assertEquals("Task", all.path("data").get(1).path("type").asText());
    assertEquals(1, notifications(client, "PENDING", 0L).path("data").size());
    assertEquals(1, notifications(client, "DECISIONS", 0L).path("data").size());
    assertEquals(2, notifications(client, "ALL", 0L).path("unread").asInt());
    assertEquals(
        0,
        notifications(client, "ALL", System.currentTimeMillis() + 60_000).path("unread").asInt());
  }

  @Test
  void theEndpointPagesTheList(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "paged");
    final OpenMetadataClient client = clientOf(steward);
    submitOne(SUBMITTER);
    GovernedReviewNotifier.glossaryTermReviewed(
        glossary.getId(), SUBMITTER, ReviewDecision.rejected(steward.getName(), "X"));

    final JsonNode first = notifications(client, "ALL", 0L, 1, 0);
    final JsonNode second = notifications(client, "ALL", 0L, 1, 1);

    assertEquals(2, first.path("paging").path("total").asInt());
    assertEquals(1, first.path("data").size());
    assertEquals(1, second.path("data").size());
    assertNotEquals(
        first.path("data").get(0).path("id").asText(),
        second.path("data").get(0).path("id").asText());
  }

  @Test
  void theEndpointOnlyShowsTheCallersOwnNotifications(TestNamespace ns) throws Exception {
    final User steward = createSteward(ns, "owner");
    final User other = createUser(ns, "bystander", List.of());
    submitOne(SUBMITTER);
    GovernedReviewNotifier.glossaryTermReviewed(
        glossary.getId(), SUBMITTER, ReviewDecision.approved(steward.getName(), "Y"));

    final JsonNode bystanders = notifications(clientOf(other), "ALL", 0L);

    assertEquals(0, bystanders.path("data").size());
    assertEquals(0, bystanders.path("paging").path("total").asInt());
  }

  @Test
  void aTaskAssignedToATeamReachesItsMembers(TestNamespace ns) throws Exception {
    final Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("reviewers"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    final User member = createUser(ns, "member", List.of(), List.of(team.getId()));
    final CreateThread request =
        new CreateThread()
            .withMessage("Team task")
            .withAbout("<#E::glossary::" + glossary.getFullyQualifiedName() + "::description>")
            .withType(ThreadType.Task)
            .withTaskDetails(
                new CreateTaskDetails()
                    .withType(TaskType.RequestDescription)
                    .withAssignees(List.of(team.getEntityReference()))
                    .withOldValue(String.valueOf(glossary.getDescription()))
                    .withSuggestion("Suggested by the team task test"));
    final Thread created =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.POST, "/v1/feed", request, Thread.class);
    try {
      final JsonNode inbox = notifications(clientOf(member), "PENDING", 0L);

      assertEquals(1, inbox.path("data").size());
      assertEquals("Team task", inbox.path("data").get(0).path("message").asText());
    } finally {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.DELETE, "/v1/feed/" + created.getId(), null, Void.class);
    }
  }

  private UUID submitOne(String submitter) {
    final UUID request = insertInReview();
    GovernedReviewNotifier.glossaryTermSubmitted(glossary.getId(), submitter);
    return request;
  }

  private void decide(UUID request) {
    deleteWorking(request);
    insertedRequests.remove(request);
    GovernedReviewNotifier.glossaryTermDecided(glossary.getId(), SUBMITTER);
  }

  private UUID insertInReview() {
    final UUID termId = UUID.randomUUID();
    dao()
        .insertWorking(
            UUID.randomUUID(),
            GlossaryVersioningService.GLOSSARY_TERM,
            termId,
            glossary.getId(),
            "1",
            EntityStatus.IN_REVIEW.value(),
            0.1,
            "{}",
            System.currentTimeMillis(),
            SUBMITTER);
    insertedRequests.add(termId);
    return termId;
  }

  private long pendingCount() {
    return dao()
        .countWorkingByGlossaryAndStatus(
            GlossaryVersioningService.GLOSSARY_TERM,
            glossary.getId(),
            EntityStatus.IN_REVIEW.value());
  }

  private static void deleteWorking(UUID termId) {
    dao().deleteWorking(GlossaryVersioningService.GLOSSARY_TERM, termId, 1L);
  }

  private static GlossaryVersionDAO dao() {
    return Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
  }

  private static User createSteward(TestNamespace ns, String baseName) {
    final Role role = SdkClients.adminClient().roles().getByName("DATA_STEWARD");
    return createUser(ns, baseName, List.of(role.getId()));
  }

  private static User createUser(TestNamespace ns, String baseName, List<UUID> roles) {
    return createUser(ns, baseName, roles, List.of());
  }

  private static User createUser(
      TestNamespace ns, String baseName, List<UUID> roles, List<UUID> teams) {
    final String name = ns.shortPrefix(baseName);
    final CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.om.org")
            .withRoles(roles)
            .withTeams(teams);
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static OpenMetadataClient clientOf(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private static JsonNode notifications(OpenMetadataClient client, String group, long unreadSince)
      throws Exception {
    return notifications(client, group, unreadSince, 25, 0);
  }

  private static JsonNode notifications(
      OpenMetadataClient client, String group, long unreadSince, int limit, int offset)
      throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/feed/notifications?group="
                + group
                + "&limit="
                + limit
                + "&offset="
                + offset
                + "&unreadSince="
                + unreadSince,
            null,
            JsonNode.class);
  }

  /** What the Mentions tab of the bell lists for the user, narrowed to the glossary. */
  private List<Thread> decisionNotices(User user) throws Exception {
    final RequestOptions options =
        RequestOptions.builder()
            .queryParam("userId", user.getId().toString())
            .queryParam("filterType", "MENTIONS")
            .queryParam("limit", "100")
            .build();
    final String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    final String about = "<#E::glossary::" + glossary.getFullyQualifiedName() + ">";
    return MAPPER.readValue(response, FeedResourceIT.ThreadList.class).getData().stream()
        .filter(thread -> about.equals(thread.getAbout()))
        .toList();
  }

  /** What the notification bell lists for the user, narrowed to tasks about the glossary. */
  private List<Thread> reviewTasks(User user) throws Exception {
    final RequestOptions options =
        RequestOptions.builder()
            .queryParam("userId", user.getId().toString())
            .queryParam("filterType", "ASSIGNED_TO")
            .queryParam("type", ThreadType.Task.toString())
            .queryParam("limit", "100")
            .build();
    final String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/feed", null, options);
    final String about = "<#E::glossary::" + glossary.getFullyQualifiedName() + ">";
    return MAPPER.readValue(response, FeedResourceIT.ThreadList.class).getData().stream()
        .filter(thread -> about.equals(thread.getAbout()))
        .toList();
  }

  private List<Thread> openReviewTasks(User user) throws Exception {
    return reviewTasks(user).stream()
        .filter(task -> task.getTask().getStatus() == TaskStatus.Open)
        .toList();
  }

  private Thread findTask(User user, UUID threadId) throws Exception {
    return reviewTasks(user).stream()
        .filter(task -> threadId.equals(task.getId()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Review task " + threadId + " is not listed"));
  }

  private static Map<?, ?> facts(Thread thread) {
    final Map<?, ?> info = (Map<?, ?>) thread.getFeedInfo().getEntitySpecificInfo();
    return (Map<?, ?>) ((Map<?, ?>) info.get("entity")).get("governedReview");
  }

  private static boolean isAssigned(Thread task, User user) {
    final List<EntityReference> assignees = task.getTask().getAssignees();
    assertNotNull(assignees);
    return assignees.stream().anyMatch(assignee -> user.getId().equals(assignee.getId()));
  }

  private String pendingMessage(int pending) {
    return pending + " yêu cầu đang chờ duyệt trong " + nameOf(glossary);
  }

  private static String nameOf(Glossary glossary) {
    return glossary.getDisplayName() == null ? glossary.getName() : glossary.getDisplayName();
  }
}
