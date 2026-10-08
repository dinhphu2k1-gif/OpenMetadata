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

export interface ApprovedRecordFieldChange {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
}

/** One edit of an Approved record: who proposed it, who approved it and what changed. */
export interface ApprovedRecordHistoryEntry {
  id: string;
  approvedAt: number;
  approvedBy: string;
  proposedAt?: number | null;
  proposedBy?: string | null;
  changes: ApprovedRecordFieldChange[];
}

export type ApprovedRecordHistoryScope = 'cde' | 'dq' | 'technical';

export interface ApprovedRecordHistoryModalProps {
  open: boolean;
  scope: ApprovedRecordHistoryScope;
  /** Shown under the dialog title, for example the version being viewed. */
  subtitle?: string;
  load: () => Promise<ApprovedRecordHistoryEntry[]>;
  onClose: () => void;
}
