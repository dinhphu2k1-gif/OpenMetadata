/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.glossary.technical.TechnicalBulkReview.Item;
import org.openmetadata.service.glossary.technical.TechnicalBulkReview.Outcome;
import org.openmetadata.service.glossary.technical.TechnicalBulkReview.Request;
import org.openmetadata.service.glossary.technical.TechnicalBulkReview.RequestItem;

class TechnicalBulkReviewTest {
  private static final UUID FIRST = UUID.randomUUID();
  private static final UUID SECOND = UUID.randomUUID();
  private static final UUID THIRD = UUID.randomUUID();

  private static RequestItem requested(UUID id, Long revision) {
    return new RequestItem(id.toString(), revision);
  }

  private static String code(WebApplicationException exception) {
    return TechnicalDictionaryErrors.codeOf(exception);
  }

  private static TechnicalRecord reviewed(UUID id, long revision) {
    return TechnicalImportTestSupport.record("CUSTOMER", id.toString()).toBuilder()
        .id(id.toString())
        .revision(revision + 1)
        .build();
  }

  @Test
  void validatesTheItemsInOrder() {
    final List<Item> items =
        TechnicalBulkReview.validate(
            new Request(List.of(requested(FIRST, 3L), requested(SECOND, 1L))));

    assertEquals(List.of(new Item(FIRST, 3), new Item(SECOND, 1)), items);
  }

  @Test
  void rejectsAnEmptyOrMissingList() {
    assertEquals(
        TechnicalDictionaryErrors.INVALID_FIELD,
        code(
            assertThrows(WebApplicationException.class, () -> TechnicalBulkReview.validate(null))));
    assertEquals(
        TechnicalDictionaryErrors.INVALID_FIELD,
        code(
            assertThrows(
                WebApplicationException.class,
                () -> TechnicalBulkReview.validate(new Request(null)))));
    assertEquals(
        TechnicalDictionaryErrors.INVALID_FIELD,
        code(
            assertThrows(
                WebApplicationException.class,
                () -> TechnicalBulkReview.validate(new Request(List.of())))));
  }

  @Test
  void acceptsExactlyTheMaximumAndRejectsOneMore() {
    final List<RequestItem> maximum = new ArrayList<>();
    for (int index = 0; index < TechnicalBulkReview.MAX_ITEMS; index++) {
      maximum.add(requested(UUID.randomUUID(), 1L));
    }
    assertEquals(
        TechnicalBulkReview.MAX_ITEMS, TechnicalBulkReview.validate(new Request(maximum)).size());

    final List<RequestItem> tooMany = new ArrayList<>(maximum);
    tooMany.add(requested(UUID.randomUUID(), 1L));
    assertEquals(
        TechnicalDictionaryErrors.INVALID_FIELD,
        code(
            assertThrows(
                WebApplicationException.class,
                () -> TechnicalBulkReview.validate(new Request(tooMany)))));
  }

  @Test
  void rejectsAMissingRevisionABadIdAndADuplicate() {
    final List<Request> invalid =
        List.of(
            new Request(List.of(requested(FIRST, null))),
            new Request(List.of(new RequestItem("not-a-uuid", 1L))),
            new Request(List.of(new RequestItem(" ", 1L))),
            new Request(List.of(new RequestItem(null, 1L))),
            new Request(Collections.singletonList(null)),
            new Request(List.of(requested(FIRST, 1L), requested(FIRST, 2L))));

    invalid.forEach(
        request ->
            assertEquals(
                TechnicalDictionaryErrors.INVALID_FIELD,
                code(
                    assertThrows(
                        WebApplicationException.class,
                        () -> TechnicalBulkReview.validate(request)))));
  }

  @Test
  void reviewsEveryItemAndFlushesOnce() {
    final AtomicInteger flushes = new AtomicInteger();
    final List<Item> items = List.of(new Item(FIRST, 3), new Item(SECOND, 5));

    final List<Outcome> outcomes =
        TechnicalBulkReview.run(items, TechnicalBulkReviewTest::reviewed, flushes::incrementAndGet);

    assertEquals(2, outcomes.size());
    assertTrue(outcomes.stream().allMatch(Outcome::succeeded));
    assertEquals(FIRST, outcomes.get(0).recordId());
    assertEquals(4, outcomes.get(0).record().revision());
    assertEquals(SECOND, outcomes.get(1).recordId());
    assertNull(outcomes.get(0).code());
    assertEquals(1, flushes.get());
  }

  @Test
  void aFailedItemDoesNotStopTheOthersAndKeepsTheOrder() {
    final AtomicInteger flushes = new AtomicInteger();
    final List<Item> items = List.of(new Item(FIRST, 3), new Item(SECOND, 3), new Item(THIRD, 3));

    final List<Outcome> outcomes =
        TechnicalBulkReview.run(
            items,
            (recordId, revision) -> {
              if (SECOND.equals(recordId)) {
                throw TechnicalRecordService.revisionConflict();
              }
              return reviewed(recordId, revision);
            },
            flushes::incrementAndGet);

    assertEquals(List.of(FIRST, SECOND, THIRD), outcomes.stream().map(Outcome::recordId).toList());
    assertTrue(outcomes.get(0).succeeded());
    assertFalse(outcomes.get(1).succeeded());
    assertEquals(TechnicalDictionaryErrors.RECORD_REVISION_CONFLICT, outcomes.get(1).code());
    assertTrue(outcomes.get(2).succeeded());
    assertEquals(1, flushes.get());
  }

  @Test
  void reportsTheCodeAndMessageOfEachBusinessFailure() {
    final List<Item> items = List.of(new Item(FIRST, 3), new Item(SECOND, 3), new Item(THIRD, 3));

    final List<Outcome> outcomes =
        TechnicalBulkReview.run(
            items,
            (recordId, revision) -> {
              if (FIRST.equals(recordId)) {
                throw TechnicalDictionaryErrors.conflict(
                    TechnicalDictionaryErrors.RANK_DUPLICATE,
                    "Rank 1 of this CDE is already held by Column 'x'");
              }
              if (SECOND.equals(recordId)) {
                throw TechnicalDictionaryErrors.forbidden(
                    TechnicalDictionaryErrors.SELF_APPROVAL_FORBIDDEN,
                    "The creator cannot review their own Technical Dictionary record");
              }
              throw TechnicalDictionaryErrors.conflict(
                  TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION,
                  "Only a record in review can be approved or rejected");
            },
            () -> {});

    assertEquals(
        List.of(
            TechnicalDictionaryErrors.RANK_DUPLICATE,
            TechnicalDictionaryErrors.SELF_APPROVAL_FORBIDDEN,
            TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION),
        outcomes.stream().map(Outcome::code).toList());
    assertEquals("Rank 1 of this CDE is already held by Column 'x'", outcomes.get(0).message());
    assertTrue(outcomes.stream().noneMatch(Outcome::succeeded));
  }

  @Test
  void anUnexpectedErrorFailsOnlyThatItem() {
    final AtomicInteger flushes = new AtomicInteger();
    final List<Item> items = List.of(new Item(FIRST, 3), new Item(SECOND, 3));

    final List<Outcome> outcomes =
        TechnicalBulkReview.run(
            items,
            (recordId, revision) -> {
              if (FIRST.equals(recordId)) {
                throw new IllegalStateException("database is gone");
              }
              return reviewed(recordId, revision);
            },
            flushes::incrementAndGet);

    assertEquals(TechnicalDictionaryErrors.INTERNAL_ERROR, outcomes.get(0).code());
    assertFalse(outcomes.get(0).message().contains("database is gone"));
    assertTrue(outcomes.get(1).succeeded());
    assertEquals(1, flushes.get());
  }

  @Test
  void aRejectionBodyNeedsOnlyTheRevisionAndToleratesAnOldComment() throws Exception {
    final ObjectMapper mapper = new ObjectMapper();

    assertEquals(
        3L,
        mapper
            .readValue("{\"expectedRevision\":3}", TechnicalRecordReview.class)
            .expectedRevision());
    assertEquals(
        4L,
        mapper
            .readValue(
                "{\"expectedRevision\":4,\"comment\":\"sent by an older client\"}",
                TechnicalRecordReview.class)
            .expectedRevision());
  }

  @Test
  void theBulkBodyIsReadFromJson() throws Exception {
    final Request request =
        new ObjectMapper()
            .readValue(
                "{\"items\":[{\"id\":\"" + FIRST + "\",\"expectedRevision\":3}]}", Request.class);

    assertEquals(List.of(new Item(FIRST, 3)), TechnicalBulkReview.validate(request));
  }
}
