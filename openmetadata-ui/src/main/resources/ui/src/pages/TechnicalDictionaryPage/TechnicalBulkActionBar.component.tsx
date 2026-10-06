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
import BulkSelectionBar from '../../components/common/BulkSelectionBar/BulkSelectionBar.component';
import {
  BulkSelectionAction,
  BulkSelectionChip,
  BulkSelectionTone,
} from '../../components/common/BulkSelectionBar/BulkSelectionBar.interface';
import { TechnicalRecordStatus } from '../../rest/technicalDictionaryAPI';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';

interface TechnicalBulkActionBarProps {
  /** Records ticked in the table. */
  selectedRows: TechnicalDictionaryRow[];
  /** The user may send drafts for approval. */
  canSubmit: boolean;
  /** Ticked drafts; the submit action acts on these only. */
  submittableCount: number;
  /** The user may approve or reject records. */
  canReview: boolean;
  /** Ticked records the user may review; approve and reject act on these only. */
  reviewableCount: number;
  onClear: () => void;
  onSubmit: () => void;
  onReject: () => void;
  onApprove: () => void;
}

const STATUS_TONES: Record<TechnicalRecordStatus, BulkSelectionTone> = {
  Draft: 'draft',
  'In Review': 'in-review',
  Rejected: 'rejected',
  Approved: 'approved',
};

const TONE_ORDER: BulkSelectionTone[] = [
  'draft',
  'in-review',
  'rejected',
  'approved',
];

const toChips = (rows: TechnicalDictionaryRow[]): BulkSelectionChip[] =>
  TONE_ORDER.map((tone) => ({
    tone,
    count: rows.filter((row) => STATUS_TONES[row.status] === tone).length,
  })).filter((chip) => chip.count > 0);

/** Send, approve or reject the ticked records; replaces the toolbar of the table while rows are ticked. */
const TechnicalBulkActionBar = ({
  selectedRows,
  canSubmit,
  submittableCount,
  canReview,
  reviewableCount,
  onClear,
  onSubmit,
  onReject,
  onApprove,
}: TechnicalBulkActionBarProps) => {
  const actions: BulkSelectionAction[] = [
    ...(canSubmit && submittableCount > 0
      ? [
          {
            type: 'submit' as const,
            count: submittableCount,
            testId: 'technical-bulk-submit',
            onPress: onSubmit,
          },
        ]
      : []),
    ...(canReview && reviewableCount > 0
      ? [
          {
            type: 'reject' as const,
            count: reviewableCount,
            testId: 'technical-bulk-reject',
            onPress: onReject,
          },
          {
            type: 'approve' as const,
            count: reviewableCount,
            testId: 'technical-bulk-approve',
            onPress: onApprove,
          },
        ]
      : []),
  ];

  return (
    <BulkSelectionBar
      actions={actions}
      chips={toChips(selectedRows)}
      clearTestId="technical-bulk-clear"
      countTestId="technical-bulk-count"
      selectedCount={selectedRows.length}
      testId="technical-bulk-bar"
      onClear={onClear}
    />
  );
};

export default TechnicalBulkActionBar;
