/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Approves or rejects many records in one request. Each record is reviewed on its own, so one that
 * cannot be reviewed (stale revision, not in review, own record, duplicate rank) is reported and
 * the others still go through.
 */
@Slf4j
public final class TechnicalBulkReview {
  public static final int MAX_ITEMS = 100;

  private TechnicalBulkReview() {}

  /** One record of the request as sent by the client. */
  public record RequestItem(String id, Long expectedRevision) {}

  /** The body of a bulk approve or reject request. */
  public record Request(List<RequestItem> items) {}

  /** One validated record of the request. */
  public record Item(UUID recordId, long expectedRevision) {}

  /** What happened to one record; {@code record} is set on success, {@code code} on failure. */
  public record Outcome(UUID recordId, TechnicalRecord record, String code, String message) {
    public boolean succeeded() {
      return record != null;
    }
  }

  /** Reviews one record in its own transaction. */
  @FunctionalInterface
  public interface Reviewer {
    TechnicalRecord review(UUID recordId, long expectedRevision);
  }

  /** The request items in order, or a 400 {@code TD_INVALID_FIELD} when the request is unusable. */
  public static List<Item> validate(Request request) {
    final List<RequestItem> requested = request == null ? null : request.items();
    if (nullOrEmpty(requested)) {
      throw invalid("items is required");
    }
    if (requested.size() > MAX_ITEMS) {
      throw invalid(String.format("At most %d records can be reviewed at once", MAX_ITEMS));
    }
    final Set<UUID> seen = new HashSet<>();
    final List<Item> items = new ArrayList<>(requested.size());
    for (final RequestItem item : requested) {
      final Item parsed = parse(item);
      if (!seen.add(parsed.recordId())) {
        throw invalid(String.format("Record %s is listed more than once", parsed.recordId()));
      }
      items.add(parsed);
    }
    return items;
  }

  /**
   * Reviews the items in order, one at a time, and returns one outcome per item in the same order.
   * {@code afterAll} runs once at the end, even when every item failed.
   */
  public static List<Outcome> run(List<Item> items, Reviewer reviewer, Runnable afterAll) {
    final List<Outcome> outcomes = new ArrayList<>(items.size());
    for (final Item item : items) {
      outcomes.add(reviewOne(item, reviewer));
    }
    afterAll.run();
    return outcomes;
  }

  private static Outcome reviewOne(Item item, Reviewer reviewer) {
    Outcome outcome;
    try {
      outcome =
          new Outcome(
              item.recordId(),
              reviewer.review(item.recordId(), item.expectedRevision()),
              null,
              null);
    } catch (WebApplicationException exception) {
      outcome =
          new Outcome(
              item.recordId(),
              null,
              TechnicalDictionaryErrors.codeOf(exception),
              exception.getMessage());
    } catch (RuntimeException exception) {
      LOG.error("Technical Dictionary record {} could not be reviewed", item.recordId(), exception);
      outcome =
          new Outcome(
              item.recordId(),
              null,
              TechnicalDictionaryErrors.INTERNAL_ERROR,
              "The record could not be reviewed");
    }
    return outcome;
  }

  private static Item parse(RequestItem item) {
    if (item == null || nullOrEmpty(item.id())) {
      throw invalid("Every item needs an id");
    }
    if (item.expectedRevision() == null) {
      throw invalid("expectedRevision is required");
    }
    return new Item(parseRecordId(item.id()), item.expectedRevision());
  }

  private static UUID parseRecordId(String id) {
    UUID recordId = null;
    try {
      recordId = UUID.fromString(id.trim());
    } catch (IllegalArgumentException exception) {
      throw invalid(String.format("'%s' is not a valid record id", id));
    }
    return recordId;
  }

  private static WebApplicationException invalid(String message) {
    return TechnicalDictionaryErrors.badRequest(TechnicalDictionaryErrors.INVALID_FIELD, message);
  }
}
