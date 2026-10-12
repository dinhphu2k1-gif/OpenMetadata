/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Structured facts of a governed review notification, so the notification bell builds its own
 * localized sentence and link instead of parsing the message text. Carried in the free-form
 * {@code feedInfo.entitySpecificInfo.entity} of the thread, which the stock UI reads only for its
 * own card styles; the message stays readable for e-mail alerts and the activity feed.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GovernedNoticePayload(
    Kind kind,
    String catalogName,
    Long pendingCount,
    Integer approvedCount,
    Integer rejectedCount,
    String requestName,
    ReviewDecision.RecordRef record) {
  static final String ENTITY_KEY = "entity";
  static final String PAYLOAD_KEY = "governedReview";

  public enum Kind {
    PENDING,
    DECISION
  }

  static GovernedNoticePayload pending(String catalogName, long pendingCount) {
    return new GovernedNoticePayload(
        Kind.PENDING, catalogName, pendingCount, null, null, null, null);
  }

  static GovernedNoticePayload decision(String catalogName, DecisionSummary summary) {
    return new GovernedNoticePayload(
        Kind.DECISION,
        catalogName,
        null,
        summary.approvedCount(),
        summary.rejectedCount(),
        summary.onlyRequestName(),
        summary.onlyRecord());
  }

  FeedInfo toFeedInfo() {
    final Map<?, ?> asMap = JsonUtils.readValue(JsonUtils.pojoToJson(this), Map.class);
    return new FeedInfo().withEntitySpecificInfo(Map.of(ENTITY_KEY, Map.of(PAYLOAD_KEY, asMap)));
  }
}
