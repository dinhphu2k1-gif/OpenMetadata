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
import { getGlossaryTermCorrectionHistory } from '../../../rest/glossaryAPI';
import CorrectionHistoryModal from './CorrectionHistoryModal.component';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermCorrectionHistory: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((value) => `at-${value}`),
}));

const entry = {
  historyId: 'h1',
  snapshotId: 's1',
  displayName: 'Old name',
  description: 'Old description',
  contentHash: 'abcdef0123456789',
  publishedAt: 10,
  publishedBy: 'maker',
  supersededAt: 20,
  supersededBy: 'checker',
};

const renderModal = () =>
  render(
    <CorrectionHistoryModal
      open
      businessVersion="1.1"
      parentBusinessVersion="1"
      termId="term-1"
      onClose={jest.fn()}
    />
  );

describe('CorrectionHistoryModal', () => {
  it('loads the history of the viewed version and lists replaced contents', async () => {
    (getGlossaryTermCorrectionHistory as jest.Mock).mockResolvedValue([entry]);

    renderModal();

    expect(await screen.findByTestId('correction-history-h1')).toBeVisible();
    expect(getGlossaryTermCorrectionHistory).toHaveBeenCalledWith(
      'term-1',
      '1.1',
      '1'
    );
    expect(screen.getByText('Old name')).toBeInTheDocument();
    expect(screen.getByText('Old description')).toBeInTheDocument();
    expect(screen.getByText('abcdef012345')).toBeInTheDocument();
  });

  it('shows an empty state when the version was never corrected', async () => {
    (getGlossaryTermCorrectionHistory as jest.Mock).mockResolvedValue([]);

    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId('correction-history-empty')).toBeVisible()
    );
  });
});
