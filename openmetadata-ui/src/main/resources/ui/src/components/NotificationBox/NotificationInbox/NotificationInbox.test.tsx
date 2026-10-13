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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { getNotifications } from '../../../rest/feedsAPI';
import NotificationInbox from './NotificationInbox.component';

const mockMarkSeen = jest.fn();
const mockShowErrorToast = jest.fn();
let mockPagingHandler: (params: { currentPage: number }) => void = jest.fn();

jest.mock('../../../rest/feedsAPI', () => ({
  ...jest.requireActual('../../../rest/feedsAPI'),
  getNotifications: jest.fn(),
}));
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: { id: 'user-id' } })),
}));
jest.mock('../NotificationSeen', () => ({
  markNotificationsSeen: (...args: unknown[]) => mockMarkSeen(...args),
  readNotificationSeenAt: jest.fn(() => 500),
}));
jest.mock(
  '../NotificationItem.component',
  () =>
    ({ thread, seenAt }: { thread: { id: string }; seenAt: number }) =>
      <p data-testid="notification-item">{`${thread.id} seen=${seenAt}`}</p>
);
jest.mock('../../common/Loader/Loader', () => () => (
  <span data-testid="loader" />
));
jest.mock(
  '../../common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () =>
    ({ placeholderText }: { placeholderText: string }) =>
      <p data-testid="empty">{placeholderText}</p>
);
jest.mock(
  '../../common/NextPrevious/NextPrevious',
  () =>
    ({
      pagingHandler,
      paging,
      pageSize,
    }: {
      pagingHandler: (params: { currentPage: number }) => void;
      paging: { total: number };
      pageSize: number;
    }) => {
      mockPagingHandler = pagingHandler;

      return <p data-testid="paging">{`${paging.total}/${pageSize}`}</p>;
    }
);
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
}));

const result = (ids: string[], total = ids.length, unread = 0) => ({
  data: ids.map((id) => ({ id })),
  paging: { total, limit: 25, offset: 0 },
  unread,
});

const renderInbox = async (onUnreadChange = jest.fn()) => {
  await act(async () => {
    render(<NotificationInbox onUnreadChange={onUnreadChange} />);
  });

  return onUnreadChange;
};

describe('NotificationInbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getNotifications as jest.Mock).mockResolvedValue(result(['a', 'b'], 2, 3));
  });

  it('lists the first page of every notification and reports the unread count', async () => {
    const onUnreadChange = await renderInbox();

    expect(getNotifications).toHaveBeenCalledWith({
      group: 'ALL',
      limit: 25,
      offset: 0,
      unreadSince: 500,
    });
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
    expect(onUnreadChange).toHaveBeenCalledWith(3);
    expect(screen.getByTestId('paging')).toHaveTextContent('2/25');
  });

  it('marks notifications as seen when the inbox opens', async () => {
    await renderInbox();

    expect(mockMarkSeen).toHaveBeenCalledWith('user-id');
  });

  it('filters by group and goes back to the first page', async () => {
    (getNotifications as jest.Mock).mockResolvedValue(result(['a'], 60));
    await renderInbox();
    await act(async () => mockPagingHandler({ currentPage: 2 }));

    expect(getNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ group: 'ALL', offset: 25 })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('notifications-group-PENDING'));
    });

    expect(getNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ group: 'PENDING', offset: 0 })
    );
    expect(screen.getByTestId('notifications-group-PENDING')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('shows a neutral message when there is nothing to show', async () => {
    (getNotifications as jest.Mock).mockResolvedValue(result([]));
    await renderInbox();

    expect(screen.getByTestId('empty')).toHaveTextContent(
      'message.notifications-empty'
    );
    expect(screen.queryByTestId('paging')).not.toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    (getNotifications as jest.Mock).mockRejectedValue(new Error());
    await renderInbox();

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });
});
