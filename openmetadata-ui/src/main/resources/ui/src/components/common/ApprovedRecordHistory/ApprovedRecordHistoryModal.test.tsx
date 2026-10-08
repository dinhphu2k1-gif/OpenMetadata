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

import { render, screen, waitFor } from '@testing-library/react';
import { ApprovedRecordHistoryEntry } from './ApprovedRecordHistory.interface';
import ApprovedRecordHistoryModal from './ApprovedRecordHistoryModal.component';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((value) => `at-${value}`),
}));

const entry: ApprovedRecordHistoryEntry = {
  id: 'h1',
  approvedAt: 20,
  approvedBy: 'checker',
  proposedAt: 10,
  proposedBy: 'maker',
  changes: [{ field: 'rank', oldValue: '1', newValue: '2' }],
};

const renderModal = (load: () => Promise<ApprovedRecordHistoryEntry[]>) =>
  render(
    <ApprovedRecordHistoryModal
      open
      load={load}
      scope="technical"
      onClose={jest.fn()}
    />
  );

describe('ApprovedRecordHistoryModal', () => {
  it('lists each edit with its proposer, approver and changed fields', async () => {
    renderModal(jest.fn().mockResolvedValue([entry]));

    expect(
      await screen.findByTestId('approved-record-history-h1')
    ).toBeVisible();
    expect(screen.getByText('label.proposed-by-on')).toBeInTheDocument();
    expect(screen.getByTestId('approved-record-change-rank')).toHaveTextContent(
      '1 → 2'
    );
  });

  it('shows an empty state when the record was never edited', async () => {
    renderModal(jest.fn().mockResolvedValue([]));

    await waitFor(() =>
      expect(screen.getByTestId('approved-record-history-empty')).toBeVisible()
    );
  });
});
