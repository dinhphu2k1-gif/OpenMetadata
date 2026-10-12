/*
 *  Copyright 2026 Collate.
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
import { ROUTES } from '../constants/constants';
import {
  DATA_DICTIONARY_GLOSSARY_NAME,
  DATA_QUALITY_GLOSSARY_NAME,
  TECHNICAL_DICTIONARY_GLOSSARY_NAME,
} from '../constants/Glossary.contant';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import {
  GeneratedBy,
  TaskType,
  Thread,
  ThreadType,
} from '../generated/entity/feed/thread';
import { getEntityFQN, getEntityType } from './FeedUtils';
import { getGlossaryTermDetailsPath } from './RouterUtils';
import {
  getGovernedTermDetailPath,
  getScopedGovernedTermFqn,
} from './routing/cdeRoutingHelper';

export const TECHNICAL_DICTIONARY_TAB_QUERY = 'tab';
export const TECHNICAL_DICTIONARY_REQUESTS_TAB = 'requests';

const GOVERNED_REVIEW_GLOSSARIES = [
  DATA_DICTIONARY_GLOSSARY_NAME,
  DATA_QUALITY_GLOSSARY_NAME,
  TECHNICAL_DICTIONARY_GLOSSARY_NAME,
];

const isGovernedGlossaryLink = (about?: string) =>
  getEntityType(about ?? '') === EntityType.GLOSSARY &&
  GOVERNED_REVIEW_GLOSSARIES.includes(getEntityFQN(about ?? '') ?? '');

/**
 * The backend keeps one open Generic task per governed glossary while it has
 * requests in review, assigned to the data stewards.
 */
export const isGovernedReviewTask = (task?: Thread) =>
  task?.task?.type === TaskType.Generic && isGovernedGlossaryLink(task.about);

/** The pending requests tab of the glossary the review task is about. */
export const getGovernedReviewTaskPath = (task: Thread) => {
  const glossaryFqn = getEntityFQN(task.about) ?? '';

  return glossaryFqn === TECHNICAL_DICTIONARY_GLOSSARY_NAME
    ? `${ROUTES.TECHNICAL_DICTIONARY}?${TECHNICAL_DICTIONARY_TAB_QUERY}=${TECHNICAL_DICTIONARY_REQUESTS_TAB}`
    : getGlossaryTermDetailsPath(glossaryFqn, EntityTabs.PENDING_REQUESTS);
};

/**
 * The backend tells a submitter how their requests were decided with a system
 * conversation about the governed glossary that mentions them.
 */
export const isGovernedDecisionNotice = (thread?: Thread) =>
  thread?.type === ThreadType.Conversation &&
  thread.generatedBy === GeneratedBy.System &&
  isGovernedGlossaryLink(thread.about);

/** The page of the governed catalog the decision notice is about. */
export const getGovernedCatalogPath = (thread: Thread) => {
  const glossaryFqn = getEntityFQN(thread.about) ?? '';

  return glossaryFqn === TECHNICAL_DICTIONARY_GLOSSARY_NAME
    ? ROUTES.TECHNICAL_DICTIONARY
    : getGlossaryTermDetailsPath(glossaryFqn);
};

export enum GovernedNoticeKind {
  Pending = 'PENDING',
  Decision = 'DECISION',
}

export interface GovernedNoticeRecord {
  id: string;
  fullyQualifiedName?: string;
  businessVersion?: string;
  parentBusinessVersion?: string;
}

/** Structured facts the backend attaches to a governed review notification. */
export interface GovernedReviewNotice {
  kind: GovernedNoticeKind;
  catalogName?: string;
  pendingCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  requestName?: string;
  record?: GovernedNoticeRecord;
}

/** How a notification reads to the user, derived only from the structured facts. */
export enum GovernedNoticeOutcome {
  Pending = 'pending',
  Cleared = 'cleared',
  Approved = 'approved',
  Rejected = 'rejected',
  Mixed = 'mixed',
}

export const getGovernedReviewNotice = (
  thread?: Thread
): GovernedReviewNotice | undefined => {
  const facts = (
    thread?.feedInfo?.entitySpecificInfo as
      | { entity?: { governedReview?: GovernedReviewNotice } }
      | undefined
  )?.entity?.governedReview;

  return facts?.kind ? facts : undefined;
};

export const getGovernedNoticeOutcome = (notice: GovernedReviewNotice) => {
  const approved = notice.approvedCount ?? 0;
  const rejected = notice.rejectedCount ?? 0;
  let outcome = GovernedNoticeOutcome.Mixed;
  if (notice.kind === GovernedNoticeKind.Pending) {
    outcome =
      (notice.pendingCount ?? 0) > 0
        ? GovernedNoticeOutcome.Pending
        : GovernedNoticeOutcome.Cleared;
  } else if (rejected === 0) {
    outcome = GovernedNoticeOutcome.Approved;
  } else if (approved === 0) {
    outcome = GovernedNoticeOutcome.Rejected;
  }

  return outcome;
};

const getGovernedRecordPath = (record: GovernedNoticeRecord) =>
  record.fullyQualifiedName &&
  record.businessVersion &&
  record.parentBusinessVersion
    ? getGovernedTermDetailPath({
        fqn: getScopedGovernedTermFqn(
          record.fullyQualifiedName,
          record.parentBusinessVersion
        ),
        businessVersion: record.businessVersion,
        parentBusinessVersion: record.parentBusinessVersion,
        termId: record.id,
      })
    : undefined;

/**
 * Where a notification opens: the decided record when exactly one request was
 * decided, otherwise the governed catalog (the pending requests tab for a task).
 */
export const getGovernedNoticePath = (thread: Thread) => {
  const notice = getGovernedReviewNotice(thread);
  const isSingleDecision =
    notice?.kind === GovernedNoticeKind.Decision && notice.record;
  const isTechnical =
    getEntityFQN(thread.about) === TECHNICAL_DICTIONARY_GLOSSARY_NAME;
  let path = isGovernedReviewTask(thread)
    ? getGovernedReviewTaskPath(thread)
    : getGovernedCatalogPath(thread);
  if (isSingleDecision && notice.record) {
    path = isTechnical
      ? ROUTES.TECHNICAL_DICTIONARY_DETAILS.replace(':termId', notice.record.id)
      : getGovernedRecordPath(notice.record) ?? path;
  }

  return path;
};
