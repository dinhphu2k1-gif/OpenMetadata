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
import { render, screen } from '@testing-library/react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import GovernedStatusBadge from './GovernedStatusBadge.component';
import { isDeletedRecord } from './GovernedStatusBadge.utils';

describe('GovernedStatusBadge', () => {
  it.each([
    [EntityStatus.Approved, 'success'],
    [EntityStatus.Draft, 'pending'],
    [EntityStatus.Archived, 'archived'],
  ])('renders %s with its own status tone', (status, statusClass) => {
    render(<GovernedStatusBadge dataTestId="status" status={status} />);

    expect(screen.getByTestId('status')).toHaveClass(statusClass);
  });

  it('renders a deleted record as a red "Deleted" badge', () => {
    render(
      <GovernedStatusBadge
        isDeleted
        dataTestId="status"
        status={EntityStatus.Archived}
      />
    );

    const badge = screen.getByTestId('status');

    expect(badge).toHaveClass('failure');
    expect(badge).not.toHaveClass('archived');
    expect(badge).toHaveTextContent('cde.deleted-record');
  });
});

describe('isDeletedRecord', () => {
  it.each([
    ['a deleted list row', { recordType: 'deleted' }, true],
    [
      'a detail payload archived by deletion',
      { archiveReason: 'DELETED' },
      true,
    ],
    [
      'a detail payload superseded by a new version',
      { archiveReason: 'SUPERSEDED' },
      false,
    ],
    ['an archived list row', { recordType: 'archived' }, false],
    ['a published record', {}, false],
  ])('treats %s correctly', (_, record, expected) => {
    expect(
      isDeletedRecord(record as Parameters<typeof isDeletedRecord>[0])
    ).toBe(expected);
  });
});
