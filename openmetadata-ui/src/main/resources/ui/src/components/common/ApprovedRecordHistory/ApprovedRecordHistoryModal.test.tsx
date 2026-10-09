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

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { getTextDiff } from '../../../utils/EntityDiffUtils';
import { ApprovedRecordHistoryEntry } from './ApprovedRecordHistory.interface';
import ApprovedRecordHistoryModal from './ApprovedRecordHistoryModal.component';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((value) => `at-${value}`),
}));

jest.mock('../../../utils/EntityDiffUtils', () => ({
  getTextDiff: jest.fn().mockReturnValue('formatted-word-diff'),
}));

jest.mock('../PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ userName }: { userName: string }) => <span>{userName}</span>,
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({
    markdown,
    className,
    reducePreviewLineClass,
  }: {
    markdown: string;
    className?: string;
    reducePreviewLineClass?: string;
  }) => (
    <div
      className={[className, reducePreviewLineClass].filter(Boolean).join(' ')}
      data-testid="long-text-preview">
      {markdown}
    </div>
  ),
}));

jest.mock('../StatusBadge/StatusBadge.component', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => (
    <span data-testid="approved-status">{label}</span>
  ),
}));

const entry: ApprovedRecordHistoryEntry = {
  id: 'h1',
  approvedAt: 20,
  approvedBy: 'checker',
  proposedAt: 10,
  proposedBy: 'maker',
  changes: [{ field: 'rank', oldValue: '1', newValue: '2' }],
};

const secondEntry: ApprovedRecordHistoryEntry = {
  ...entry,
  id: 'h2',
  changes: [{ field: 'description', oldValue: 'old', newValue: 'new' }],
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

const getToggle = (historyEntry: HTMLElement) =>
  within(historyEntry).getByRole('button', {
    name: /label.correction-number/,
  });

describe('ApprovedRecordHistoryModal', () => {
  it('opens the newest entry and summarizes the older entry by default', async () => {
    renderModal(jest.fn().mockResolvedValue([entry, secondEntry]));

    const newestEntry = await screen.findByTestId('approved-record-history-h1');
    const olderEntry = screen.getByTestId('approved-record-history-h2');

    expect(getToggle(newestEntry)).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(newestEntry).getByTestId('approved-record-change-rank')
    ).toBeInTheDocument();
    expect(getToggle(olderEntry)).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(olderEntry).queryByTestId('approved-record-change-description')
    ).not.toBeInTheDocument();
    expect(olderEntry).toHaveTextContent('label.description');
    expect(newestEntry.querySelector('.timeline-rounder')).toHaveClass(
      'selected'
    );
  });

  it('expands and collapses an older entry independently', async () => {
    renderModal(jest.fn().mockResolvedValue([entry, secondEntry]));

    const olderEntry = await screen.findByTestId('approved-record-history-h2');
    const toggle = getToggle(olderEntry);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(olderEntry).getByTestId('approved-record-change-description')
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(olderEntry).queryByTestId('approved-record-change-description')
    ).not.toBeInTheDocument();
  });

  it('shows three field names and the remaining count when collapsed', async () => {
    const changes = [
      { field: 'rank', oldValue: '1', newValue: '2' },
      { field: 'timeliness', oldValue: 'a', newValue: 'b' },
      { field: 'creationMethod', oldValue: 'a', newValue: 'b' },
      { field: 'generationType', oldValue: 'a', newValue: 'b' },
      { field: 'systemOwner', oldValue: 'a', newValue: 'b' },
    ];

    renderModal(
      jest.fn().mockResolvedValue([entry, { ...secondEntry, changes }])
    );

    const olderEntry = await screen.findByTestId('approved-record-history-h2');

    expect(olderEntry).toHaveTextContent('label.rank');
    expect(olderEntry).toHaveTextContent('label.timeliness');
    expect(olderEntry).toHaveTextContent('label.creation-method');
    expect(olderEntry).toHaveTextContent('+2');
  });

  it('shows short values with diff styles and handles an empty value', async () => {
    renderModal(
      jest.fn().mockResolvedValue([
        {
          ...entry,
          changes: [
            { field: 'rank', oldValue: '1', newValue: '2' },
            { field: 'timeliness', oldValue: '', newValue: 'daily' },
          ],
        },
      ])
    );

    const rankChange = await screen.findByTestId('approved-record-change-rank');
    const emptyChange = screen.getByTestId('approved-record-change-timeliness');

    expect(rankChange.querySelector('.diff-removed')).toHaveTextContent('1');
    expect(rankChange.querySelector('.diff-added')).toHaveTextContent('2');
    expect(emptyChange).toHaveTextContent('label.not-set');
    expect(emptyChange.querySelector('.diff-removed')).not.toBeInTheDocument();
  });

  it('renders long text as a word diff without the short-value arrow', async () => {
    renderModal(jest.fn().mockResolvedValue([secondEntry]));

    const change = await screen.findByTestId(
      'approved-record-change-description'
    );

    expect(getTextDiff).toHaveBeenCalledWith('old', 'new');
    expect(within(change).getByTestId('long-text-preview')).toHaveTextContent(
      'formatted-word-diff'
    );
    expect(
      within(change).queryByLabelText('arrow-right')
    ).not.toBeInTheDocument();
  });

  it('expands and collapses long text exceeding the preview limit', async () => {
    const longValue = 'a'.repeat(121);
    renderModal(
      jest.fn().mockResolvedValue([
        {
          ...secondEntry,
          changes: [
            { field: 'description', oldValue: longValue, newValue: 'new' },
          ],
        },
      ])
    );

    const preview = await screen.findByTestId('long-text-preview');
    const viewMore = screen.getByRole('button', { name: 'label.view-more' });

    expect(preview).toHaveClass('max-two-lines');

    fireEvent.click(viewMore);

    expect(preview).not.toHaveClass('max-two-lines');
    expect(
      screen.getByRole('button', { name: 'label.collapse' })
    ).toBeInTheDocument();
  });

  it('shows only the approver when proposer information is missing', async () => {
    renderModal(
      jest
        .fn()
        .mockResolvedValue([
          { ...entry, proposedAt: undefined, proposedBy: undefined },
        ])
    );

    const historyEntry = await screen.findByTestId(
      'approved-record-history-h1'
    );
    const meta = historyEntry.querySelector('.approved-record-history-meta');

    expect(meta).toHaveTextContent('checker');
    expect(meta).not.toHaveTextContent('maker');
    expect(meta).not.toHaveTextContent('→');
  });

  it('shows an empty state when the record was never edited', async () => {
    renderModal(jest.fn().mockResolvedValue([]));

    await waitFor(() =>
      expect(screen.getByTestId('approved-record-history-empty')).toBeVisible()
    );
  });
});
