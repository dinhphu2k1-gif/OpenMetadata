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
import { TaskType, Thread } from '../generated/entity/feed/thread';
import {
  getGovernedNoticeOutcome,
  getGovernedNoticePath,
  getGovernedReviewNotice,
  getGovernedReviewTaskPath,
  isGovernedReviewTask,
} from './GovernedReviewTaskUtils';

const reviewTask = (about: string, type = TaskType.Generic) =>
  ({
    id: 'thread-id',
    about,
    message: '2 yêu cầu đang chờ duyệt',
    task: { id: 1, type, assignees: [] },
  } as unknown as Thread);

describe('GovernedReviewTaskUtils', () => {
  it('recognises the review task of each governed glossary', () => {
    expect(
      isGovernedReviewTask(reviewTask('<#E::glossary::Data Dictionary>'))
    ).toBe(true);
    expect(
      isGovernedReviewTask(reviewTask('<#E::glossary::Data Quality>'))
    ).toBe(true);
    expect(
      isGovernedReviewTask(reviewTask('<#E::glossary::Technical Dictionary>'))
    ).toBe(true);
  });

  it('ignores other tasks', () => {
    expect(
      isGovernedReviewTask(reviewTask('<#E::glossary::Business Glossary>'))
    ).toBe(false);
    expect(
      isGovernedReviewTask(
        reviewTask('<#E::glossary::Data Dictionary>', TaskType.RequestApproval)
      )
    ).toBe(false);
    expect(
      isGovernedReviewTask(
        reviewTask('<#E::glossaryTerm::Data Dictionary.CIF>')
      )
    ).toBe(false);
    expect(isGovernedReviewTask(undefined)).toBe(false);
  });

  it('links a versioned governed glossary to its pending requests tab', () => {
    expect(
      getGovernedReviewTaskPath(reviewTask('<#E::glossary::Data Dictionary>'))
    ).toBe('/glossary/Data%20Dictionary/pending_requests');
  });

  it('links the Technical Dictionary to its requests tab', () => {
    expect(
      getGovernedReviewTaskPath(
        reviewTask('<#E::glossary::Technical Dictionary>')
      )
    ).toBe('/technical-dictionary?tab=requests');
  });

  describe('structured notices', () => {
    const withFacts = (about: string, governedReview?: unknown) =>
      ({
        id: 'notice-id',
        about,
        feedInfo: { entitySpecificInfo: { entity: { governedReview } } },
      } as unknown as Thread);

    it('reads the facts the backend attached, and nothing without them', () => {
      const facts = { kind: 'DECISION', approvedCount: 1 };

      expect(
        getGovernedReviewNotice(
          withFacts('<#E::glossary::Data Dictionary>', facts)
        )
      ).toEqual(facts);
      expect(
        getGovernedReviewNotice(withFacts('<#E::glossary::Data Dictionary>'))
      ).toBeUndefined();
      expect(getGovernedReviewNotice(undefined)).toBeUndefined();
    });

    it.each([
      [{ kind: 'PENDING', pendingCount: 2 }, 'pending'],
      [{ kind: 'PENDING', pendingCount: 0 }, 'cleared'],
      [{ kind: 'DECISION', approvedCount: 2, rejectedCount: 0 }, 'approved'],
      [{ kind: 'DECISION', approvedCount: 0, rejectedCount: 1 }, 'rejected'],
      [{ kind: 'DECISION', approvedCount: 1, rejectedCount: 1 }, 'mixed'],
    ])('classifies %j as %s', (facts, outcome) => {
      expect(getGovernedNoticeOutcome(facts as never)).toBe(outcome);
    });

    it('opens the decided term when one request was decided', () => {
      const path = getGovernedNoticePath(
        withFacts('<#E::glossary::Data Dictionary>', {
          kind: 'DECISION',
          approvedCount: 1,
          rejectedCount: 0,
          record: {
            id: 'term-1',
            fullyQualifiedName: 'Data Dictionary.CDE001',
            businessVersion: '1.1',
            parentBusinessVersion: '1',
          },
        })
      );

      expect(path).toContain('/glossary/');
      expect(path).toContain('termId=term-1');
      expect(path).toContain('businessVersion=1.1');
      expect(path).toContain('parentBusinessVersion=1');
    });

    it('opens a technical record on its own page', () => {
      expect(
        getGovernedNoticePath(
          withFacts('<#E::glossary::Technical Dictionary>', {
            kind: 'DECISION',
            approvedCount: 1,
            rejectedCount: 0,
            record: { id: 'rec-9' },
          })
        )
      ).toBe('/technical-dictionary/rec-9');
    });

    it('opens the catalog for a batch', () => {
      expect(
        getGovernedNoticePath(
          withFacts('<#E::glossary::Data Dictionary>', {
            kind: 'DECISION',
            approvedCount: 2,
            rejectedCount: 1,
          })
        )
      ).toBe('/glossary/Data%20Dictionary');
    });

    it('opens the pending requests tab for a review task', () => {
      const task = {
        ...withFacts('<#E::glossary::Data Dictionary>', {
          kind: 'PENDING',
          pendingCount: 2,
        }),
        task: { id: 1, type: TaskType.Generic },
      } as unknown as Thread;

      expect(getGovernedNoticePath(task)).toBe(
        '/glossary/Data%20Dictionary/pending_requests'
      );
    });
  });
});
