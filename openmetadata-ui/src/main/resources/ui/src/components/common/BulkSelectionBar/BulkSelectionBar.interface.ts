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

export type BulkSelectionTone =
  | 'draft'
  | 'in-review'
  | 'rejected'
  | 'approved'
  | 'create'
  | 'update'
  | 'delete';

export type BulkSelectionActionType = 'submit' | 'approve' | 'reject' | 'withdraw';

/** How many of the selected records are in one status. */
export interface BulkSelectionChip {
  tone: BulkSelectionTone;
  count: number;
  /** Optional module-specific label; the status labels remain the default. */
  label?: string;
  testId?: string;
}

/** An action that applies to at least one of the selected records. */
export interface BulkSelectionAction {
  type: BulkSelectionActionType;
  /** Records the action will act on; shown in the button label. */
  count: number;
  testId?: string;
  onPress: () => void;
}

export interface BulkSelectionBarProps {
  selectedCount: number;
  chips: BulkSelectionChip[];
  actions: BulkSelectionAction[];
  onClear: () => void;
  testId?: string;
  countTestId?: string;
  clearTestId?: string;
}
