/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.glossary.notification.GovernedDecisionNotices.Recipient;

/**
 * Tells data stewards that governed requests wait for their review, and tells submitters how their
 * requests were decided. Callers report each committed submission or decision; a failure to notify
 * is logged and never fails the workflow action. Inside {@link #collectDuring} the signals of a
 * batch are merged and dispatched once when it ends.
 */
@Slf4j
public final class GovernedReviewNotifier {
  private static final ThreadLocal<Batch> BATCH = new ThreadLocal<>();

  private GovernedReviewNotifier() {}

  private record Batch(
      Map<ReviewQueue, ReviewSignal> signals, Map<Recipient, DecisionSummary> decisions) {
    static Batch empty() {
      return new Batch(new LinkedHashMap<>(), new LinkedHashMap<>());
    }
  }

  public static void glossaryTermSubmitted(UUID glossaryId, String actor) {
    if (glossaryId != null) {
      signal(ReviewQueue.glossaryTerms(glossaryId), ReviewSignal.submittedBy(actor));
    }
  }

  /** A change of the queue that no submitter needs to hear about, such as a withdrawal. */
  public static void glossaryTermDecided(UUID glossaryId, String actor) {
    if (glossaryId != null) {
      signal(ReviewQueue.glossaryTerms(glossaryId), ReviewSignal.decidedBy(actor));
    }
  }

  public static void glossaryTermReviewed(
      UUID glossaryId, String reviewer, ReviewDecision decision) {
    if (glossaryId != null) {
      reviewed(ReviewQueue.glossaryTerms(glossaryId), reviewer, decision);
    }
  }

  public static void technicalRequestSubmitted(String actor) {
    signal(ReviewQueue.technicalDictionary(), ReviewSignal.submittedBy(actor));
  }

  public static void technicalRequestDecided(String actor) {
    signal(ReviewQueue.technicalDictionary(), ReviewSignal.decidedBy(actor));
  }

  public static void technicalRequestReviewed(String reviewer, ReviewDecision decision) {
    reviewed(ReviewQueue.technicalDictionary(), reviewer, decision);
  }

  /** Runs {@code work}, deferring its signals until it ends; nested calls join the outer batch. */
  public static void collectDuring(Runnable work) {
    if (BATCH.get() == null) {
      BATCH.set(Batch.empty());
      try {
        work.run();
      } finally {
        final Batch collected = BATCH.get();
        BATCH.remove();
        collected.signals().forEach(GovernedReviewNotifier::dispatch);
        collected.decisions().forEach(GovernedReviewNotifier::dispatchDecision);
      }
    } else {
      work.run();
    }
  }

  private static void reviewed(ReviewQueue queue, String reviewer, ReviewDecision decision) {
    signal(queue, ReviewSignal.decidedBy(reviewer));
    if (decision != null && decision.submitter() != null) {
      final Recipient recipient = new Recipient(queue, reviewer, decision.submitter());
      final DecisionSummary summary = DecisionSummary.of(decision);
      final Batch batch = BATCH.get();
      if (batch == null) {
        dispatchDecision(recipient, summary);
      } else {
        batch.decisions().merge(recipient, summary, DecisionSummary::merge);
      }
    }
  }

  private static void signal(ReviewQueue queue, ReviewSignal signal) {
    final Batch batch = BATCH.get();
    if (batch == null) {
      dispatch(queue, signal);
    } else {
      batch.signals().merge(queue, signal, ReviewSignal::merge);
    }
  }

  private static void dispatch(ReviewQueue queue, ReviewSignal signal) {
    try {
      GovernedReviewTasks.sync(queue, signal);
    } catch (RuntimeException exception) {
      // The request itself is committed; a missed notification must not turn it into an error.
      LOG.warn("Failed to notify data stewards about review queue {}", queue, exception);
    }
  }

  private static void dispatchDecision(Recipient recipient, DecisionSummary summary) {
    try {
      GovernedDecisionNotices.send(recipient, summary);
    } catch (RuntimeException exception) {
      LOG.warn("Failed to tell {} about decided requests", recipient.submitter(), exception);
    }
  }
}
