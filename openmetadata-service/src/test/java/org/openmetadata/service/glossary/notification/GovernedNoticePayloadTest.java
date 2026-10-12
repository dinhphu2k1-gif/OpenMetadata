/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.FeedInfo;

class GovernedNoticePayloadTest {
  private static final String CATALOG = "Từ điển dữ liệu dùng chung";
  private static final ReviewDecision.RecordRef RECORD =
      new ReviewDecision.RecordRef("term-1", "Data Dictionary.CDE001", "1.1", "1");

  @Test
  void singleDecisionCarriesTheRequestAndWhereToOpenIt() {
    final DecisionSummary summary =
        DecisionSummary.of(ReviewDecision.approved("user3", "Tên khách hàng", RECORD));

    final Map<?, ?> facts = facts(GovernedNoticePayload.decision(CATALOG, summary));

    assertEquals("DECISION", facts.get("kind"));
    assertEquals(CATALOG, facts.get("catalogName"));
    assertEquals(1, facts.get("approvedCount"));
    assertEquals(0, facts.get("rejectedCount"));
    assertEquals("Tên khách hàng", facts.get("requestName"));
    final Map<?, ?> record = (Map<?, ?>) facts.get("record");
    assertEquals("term-1", record.get("id"));
    assertEquals("Data Dictionary.CDE001", record.get("fullyQualifiedName"));
    assertEquals("1.1", record.get("businessVersion"));
    assertEquals("1", record.get("parentBusinessVersion"));
  }

  @Test
  void mergedDecisionsKeepCountsButNoSingleRecord() {
    final DecisionSummary merged =
        DecisionSummary.of(ReviewDecision.approved("user3", "A", RECORD))
            .merge(DecisionSummary.of(ReviewDecision.rejected("user3", "B", RECORD)));

    final Map<?, ?> facts = facts(GovernedNoticePayload.decision(CATALOG, merged));

    assertEquals(1, facts.get("approvedCount"));
    assertEquals(1, facts.get("rejectedCount"));
    assertFalse(facts.containsKey("requestName"));
    assertFalse(facts.containsKey("record"));
  }

  @Test
  void pendingNoticeCarriesTheQueueSize() {
    final Map<?, ?> facts = facts(GovernedNoticePayload.pending(CATALOG, 3));

    assertEquals("PENDING", facts.get("kind"));
    assertEquals(3, facts.get("pendingCount"));
    assertFalse(facts.containsKey("record"));
  }

  @Test
  void aDecisionWithoutARecordStillDescribesItself() {
    final DecisionSummary summary = DecisionSummary.of(ReviewDecision.rejected("user3", "X"));

    assertNull(summary.onlyRecord());
    assertEquals("Yêu cầu \"X\" đã bị từ chối trong " + CATALOG, summary.describe(CATALOG));
  }

  private static Map<?, ?> facts(GovernedNoticePayload payload) {
    final FeedInfo feedInfo = payload.toFeedInfo();
    final Map<?, ?> info = (Map<?, ?>) feedInfo.getEntitySpecificInfo();
    return (Map<?, ?>) ((Map<?, ?>) info.get("entity")).get("governedReview");
  }
}
