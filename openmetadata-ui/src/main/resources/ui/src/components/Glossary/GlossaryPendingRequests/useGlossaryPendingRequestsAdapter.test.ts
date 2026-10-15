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

import { renderHook } from '@testing-library/react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  getCurrentPublishedGlossaryTerm,
  getGlossaryWorkingRecords,
} from '../../../rest/glossaryAPI';
import { useGlossaryPendingRequestsAdapter } from './useGlossaryPendingRequestsAdapter';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({ currentUser: undefined }),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockRejectedValue(new Error('no user')),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  bulkGlossaryTermWorkflow: jest.fn(),
  getCurrentPublishedGlossaryTerm: jest.fn(),
  getGlossaryWorkingRecords: jest.fn(),
}));

const notFound = { response: { status: 404 } };

const workingRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'term-1',
  name: 'DQ4.3',
  displayName: 'Kiem thu',
  fullyQualifiedName: 'Data Quality."DQ4.3@v1"',
  entityStatus: EntityStatus.InReview,
  businessVersion: '1.1',
  updatedBy: 'user3',
  ...overrides,
});

const loadRequests = async () => {
  const { result } = renderHook(() =>
    useGlossaryPendingRequestsAdapter({
      glossaryId: 'g1',
      glossaryName: 'Data Quality',
      businessVersion: '1',
    })
  );
  const { items } = await result.current.fetchRequests({
    page: 1,
    pageSize: 10,
  });

  return items;
};

const givenWorking = (records: Array<Record<string, unknown>>) =>
  (getGlossaryWorkingRecords as jest.Mock).mockResolvedValue({
    data: records,
    paging: { total: records.length },
  });

describe('useGlossaryPendingRequestsAdapter request type', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats a new version of an approved term as a new request', async () => {
    givenWorking([workingRecord()]);
    (getCurrentPublishedGlossaryTerm as jest.Mock).mockResolvedValue({
      id: 'term-1',
      businessVersion: '1.0',
    });

    const [item] = await loadRequests();

    expect(item.type).toBe('create');
    expect(item.version).toBe('1.1');
  });

  it('treats an edit of the same approved version as an update', async () => {
    givenWorking([workingRecord({ businessVersion: '1.0' })]);
    (getCurrentPublishedGlossaryTerm as jest.Mock).mockResolvedValue({
      id: 'term-1',
      businessVersion: '1.0',
    });

    const [item] = await loadRequests();

    expect(item.type).toBe('update');
    expect(item.version).toBe('1.0');
  });

  it('treats a term that was never approved as a new request', async () => {
    givenWorking([workingRecord({ businessVersion: '1.0' })]);
    (getCurrentPublishedGlossaryTerm as jest.Mock).mockRejectedValue(notFound);

    const [item] = await loadRequests();

    expect(item.type).toBe('create');
    expect(item.changedFields).toEqual(['label.pending-new-cde']);
  });

  it('keeps a pending deletion as a delete request', async () => {
    givenWorking([
      workingRecord({
        entityStatus: EntityStatus.Draft,
        pendingDeletion: true,
        businessVersion: '1.0',
      }),
    ]);
    (getCurrentPublishedGlossaryTerm as jest.Mock).mockResolvedValue({
      id: 'term-1',
      businessVersion: '1.0',
    });

    const [item] = await loadRequests();

    expect(item.type).toBe('delete');
  });
});
