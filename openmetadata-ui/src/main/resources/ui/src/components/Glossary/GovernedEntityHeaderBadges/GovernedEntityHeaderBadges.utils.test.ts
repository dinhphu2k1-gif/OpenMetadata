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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  getGovernedVersionLabel,
  GovernedVersionKind,
} from './GovernedEntityHeaderBadges.utils';

describe('getGovernedVersionLabel', () => {
  it.each([
    [EntityStatus.Approved, undefined, 'label.version: 1.1 — label.approved'],
    [EntityStatus.Archived, undefined, 'label.version: 1.1 — label.archived'],
    [
      EntityStatus.Archived,
      GovernedVersionKind.Deleted,
      'label.version: 1.1 — cde.deleted-record',
    ],
    [
      EntityStatus.InReview,
      GovernedVersionKind.DeletionRequest,
      'label.version: 1.1 — cde.deletion-request-tag',
    ],
    [
      EntityStatus.Draft,
      GovernedVersionKind.CorrectionDraft,
      'label.version: 1.1 — label.correction-draft',
    ],
  ])('labels a %s version of kind %s', (status, kind, expected) => {
    expect(getGovernedVersionLabel('1.1', status, kind)).toBe(expected);
  });
});
