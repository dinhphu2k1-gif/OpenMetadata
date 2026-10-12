/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Tells a submitter how their requests were decided, as an OpenMetadata conversation that mentions
 * them: it lands in the Mentions tab of their notification bell and is pushed on the mention
 * WebSocket channel to them only. No reason is given, since rejecting needs none.
 */
@Slf4j
final class GovernedDecisionNotices {
  private GovernedDecisionNotices() {}

  record Recipient(ReviewQueue queue, String reviewer, String submitter) {}

  static void send(Recipient recipient, DecisionSummary summary) {
    final User submitter = activeHuman(recipient.submitter());
    if (submitter != null && !submitter.getName().equals(recipient.reviewer())) {
      final EntityReference glossary = recipient.queue().glossary();
      final Thread notice = Entity.getFeedRepository().create(notice(recipient, glossary, summary));
      WebSocketManager.getInstance()
          .sendToOne(
              submitter.getId(), WebSocketManager.MENTION_CHANNEL, JsonUtils.pojoToJson(notice));
    }
  }

  private static Thread notice(
      Recipient recipient, EntityReference glossary, DecisionSummary summary) {
    final long now = System.currentTimeMillis();
    final String mention =
        new EntityLink(Entity.USER, FullyQualifiedName.quoteName(recipient.submitter()))
            .getLinkString();
    final String catalogName =
        glossary.getDisplayName() == null ? glossary.getName() : glossary.getDisplayName();
    return new Thread()
        .withId(UUID.randomUUID())
        .withType(ThreadType.Conversation)
        .withGeneratedBy(Thread.GeneratedBy.SYSTEM)
        .withAbout(
            new EntityLink(Entity.GLOSSARY, glossary.getFullyQualifiedName()).getLinkString())
        .withMessage(mention + " " + summary.describe(catalogName))
        .withFeedInfo(GovernedNoticePayload.decision(catalogName, summary).toFeedInfo())
        .withThreadTs(now)
        .withCreatedBy(recipient.reviewer())
        .withUpdatedBy(recipient.reviewer())
        .withUpdatedAt(now);
  }

  private static User activeHuman(String userName) {
    User result = null;
    try {
      final User user = Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);
      result = Boolean.TRUE.equals(user.getIsBot()) ? null : user;
    } catch (EntityNotFoundException exception) {
      LOG.debug("Submitter {} no longer exists; no decision notice is sent", userName);
    }
    return result;
  }
}
