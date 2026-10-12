/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.WebsocketNotificationHandler;

/**
 * Keeps at most one open OpenMetadata task per governed catalog, assigned to the data stewards,
 * while the catalog has In Review requests. A submission refreshes and re-announces the task through
 * the notification bell, the task WebSocket channel and a {@code THREAD_*} change event (so the
 * standard notification alerts can e-mail assignees); the task closes once nothing is pending.
 */
@Slf4j
final class GovernedReviewTasks {
  static final String CLOSING_COMMENT = "Không còn yêu cầu chờ duyệt.";
  private static final String MESSAGE_FORMAT = "%d yêu cầu đang chờ duyệt trong %s";
  private static final String CLEARED_MESSAGE_FORMAT = "Không còn yêu cầu chờ duyệt trong %s";

  /** Production runs one server instance, so a JVM lock keeps one open task per catalog. */
  private static final Object LOCK = new Object();

  private GovernedReviewTasks() {}

  static void sync(ReviewQueue queue, ReviewSignal signal) {
    final EntityReference glossary = queue.glossary();
    final EntityLink about = new EntityLink(Entity.GLOSSARY, glossary.getFullyQualifiedName());
    synchronized (LOCK) {
      final long pending = queue.pendingCount();
      final Thread open = findOpenTask(about);
      if (pending == 0) {
        close(open, clearedNotice(glossary), signal.actor());
      } else if (signal.submitted()) {
        announce(open, about, notice(glossary, pending), signal.actor());
      } else {
        refresh(open, notice(glossary, pending));
      }
    }
  }

  static Thread findOpenTask(EntityLink about) {
    Thread result = null;
    try {
      result = Entity.getFeedRepository().getTask(about, TaskType.Generic, TaskStatus.Open);
    } catch (EntityNotFoundException exception) {
      LOG.debug("No open review task about {}", about.getLinkString());
    }
    return result;
  }

  /** The readable message and the structured facts of the same state of the queue. */
  private record Notice(String message, GovernedNoticePayload payload) {}

  private static Notice notice(EntityReference glossary, long pending) {
    return new Notice(
        String.format(MESSAGE_FORMAT, pending, nameOf(glossary)),
        GovernedNoticePayload.pending(nameOf(glossary), pending));
  }

  private static Notice clearedNotice(EntityReference glossary) {
    return new Notice(
        String.format(CLEARED_MESSAGE_FORMAT, nameOf(glossary)),
        GovernedNoticePayload.pending(nameOf(glossary), 0));
  }

  private static String nameOf(EntityReference glossary) {
    return glossary.getDisplayName() == null ? glossary.getName() : glossary.getDisplayName();
  }

  private static void apply(Thread thread, Notice notice) {
    thread.withMessage(notice.message()).withFeedInfo(notice.payload().toFeedInfo());
  }

  /** The bell keeps listing closed tasks, so the message stops claiming that requests wait. */
  private static void close(Thread open, Notice cleared, String actor) {
    if (open != null) {
      apply(open, cleared);
      Entity.getFeedRepository()
          .closeTaskWithoutWorkflow(open, actor, new CloseTask().withComment(CLOSING_COMMENT));
    }
  }

  private static void announce(Thread open, EntityLink about, Notice notice, String submitter) {
    final List<EntityReference> stewards = DataStewardDirectory.stewardsExcept(submitter);
    if (stewards.isEmpty()) {
      LOG.info("No data steward to notify about {}", about.getLinkString());
    } else {
      final Thread thread =
          open == null
              ? create(about, notice, submitter, stewards)
              : reannounce(open, notice, submitter, stewards);
      recordChangeEvent(thread, open == null ? EventType.THREAD_CREATED : EventType.THREAD_UPDATED);
      WebsocketNotificationHandler.handleTaskNotification(thread);
    }
  }

  private static Thread create(
      EntityLink about, Notice notice, String submitter, List<EntityReference> stewards) {
    final long now = System.currentTimeMillis();
    final Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Task)
            .withAbout(about.getLinkString())
            .withThreadTs(now)
            .withCreatedBy(submitter)
            .withUpdatedBy(submitter)
            .withUpdatedAt(now)
            .withTask(
                new TaskDetails()
                    .withType(TaskType.Generic)
                    .withStatus(TaskStatus.Open)
                    .withAssignees(stewards));
    apply(thread, notice);
    return Entity.getFeedRepository().create(thread);
  }

  /**
   * Moves the open task to the latest submission: its submitter becomes the author and the thread
   * timestamp moves forward, so the bell lists it first and shows who asked last.
   */
  private static Thread reannounce(
      Thread open, Notice notice, String submitter, List<EntityReference> stewards) {
    final long now = System.currentTimeMillis();
    open.getTask().withAssignees(stewards);
    apply(open, notice);
    open.withThreadTs(now).withCreatedBy(submitter).withUpdatedBy(submitter).withUpdatedAt(now);
    Entity.getCollectionDAO().feedDAO().update(open.getId(), JsonUtils.pojoToJson(open));
    return open;
  }

  private static void refresh(Thread open, Notice notice) {
    if (open != null && !notice.message().equals(open.getMessage())) {
      apply(open, notice);
      Entity.getCollectionDAO().feedDAO().update(open.getId(), JsonUtils.pojoToJson(open));
    }
  }

  private static void recordChangeEvent(Thread thread, EventType eventType) {
    final ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(eventType)
            .withEntityId(thread.getId())
            .withEntityType(Entity.THREAD)
            .withUserName(thread.getUpdatedBy())
            .withTimestamp(thread.getUpdatedAt())
            .withEntity(thread);
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToMaskedJson(changeEvent));
  }
}
