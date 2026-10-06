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

import { FC, useMemo } from 'react';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import BulkSelectionBar from '../../../common/BulkSelectionBar/BulkSelectionBar.component';
import {
  BulkSelectionAction,
  BulkSelectionChip,
} from '../../../common/BulkSelectionBar/BulkSelectionBar.interface';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';

export interface GlossaryBulkActionBarProps {
  selectedTerms: ModifiedGlossaryTerm[];
  onClearSelection: () => void;
  onSubmitForReview: (draftTerms: ModifiedGlossaryTerm[]) => void;
  onApprove: (inReviewTerms: ModifiedGlossaryTerm[]) => void;
  onReject: (inReviewTerms: ModifiedGlossaryTerm[]) => void;
  canSubmitForReview: boolean;
  canApproveOrReject: boolean;
}

export const GlossaryBulkActionBar: FC<GlossaryBulkActionBarProps> = ({
  selectedTerms,
  onClearSelection,
  onSubmitForReview,
  onApprove,
  onReject,
  canSubmitForReview,
  canApproveOrReject,
}) => {
  const { draftTerms, inReviewTerms, approvedTerms } = useMemo(() => {
    const statusOf = (term: ModifiedGlossaryTerm) =>
      term.entityStatus ?? EntityStatus.Approved;

    return {
      draftTerms: selectedTerms.filter(
        (term) => statusOf(term) === EntityStatus.Draft
      ),
      inReviewTerms: selectedTerms.filter(
        (term) => statusOf(term) === EntityStatus.InReview
      ),
      approvedTerms: selectedTerms.filter(
        (term) => statusOf(term) === EntityStatus.Approved
      ),
    };
  }, [selectedTerms]);

  const chips = (
    [
      { tone: 'draft', count: draftTerms.length, testId: 'draft-count-tag' },
      {
        tone: 'in-review',
        count: inReviewTerms.length,
        testId: 'in-review-count-tag',
      },
      {
        tone: 'approved',
        count: approvedTerms.length,
        testId: 'approved-count-tag',
      },
    ] as BulkSelectionChip[]
  ).filter((chip) => chip.count > 0);

  const actions: BulkSelectionAction[] = [
    ...(canSubmitForReview && draftTerms.length > 0
      ? [
          {
            type: 'submit' as const,
            count: draftTerms.length,
            testId: 'bulk-submit-for-review-btn',
            onPress: () => onSubmitForReview(draftTerms),
          },
        ]
      : []),
    ...(canApproveOrReject && inReviewTerms.length > 0
      ? [
          {
            type: 'reject' as const,
            count: inReviewTerms.length,
            testId: 'bulk-reject-btn',
            onPress: () => onReject(inReviewTerms),
          },
          {
            type: 'approve' as const,
            count: inReviewTerms.length,
            testId: 'bulk-approve-btn',
            onPress: () => onApprove(inReviewTerms),
          },
        ]
      : []),
  ];

  return selectedTerms.length === 0 ? null : (
    <BulkSelectionBar
      actions={actions}
      chips={chips}
      clearTestId="clear-selection-btn"
      countTestId="selected-count-tag"
      selectedCount={selectedTerms.length}
      testId="glossary-bulk-action-bar"
      onClear={onClearSelection}
    />
  );
};

export default GlossaryBulkActionBar;
