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
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../../rest/feedsAPI';
import NotificationInbox from './NotificationInbox.component';

const mockNotifyChanged = jest.fn();
const mockShowErrorToast = jest.fn();
let mockPagingHandler: (params: { currentPage: number }) => void = jest.fn();

jest.mock('../../../rest/feedsAPI', () => ({
  ...jest.requireActual('../../../rest/feedsAPI'),
  getNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));
jest.mock('../NotificationRead', () => ({
  NOTIFICATIONS_CHANGED_EVENT: 'om-notifications-changed',
  notifyNotificationsChanged: () => mockNotifyChanged(),
}));
jest.mock(
  '../NotificationItem.component',
  () =>
    ({
      thread,
      isUnread,
      onRead,
    }: {
      thread: { id: string };
      isUnread: boolean;
      onRead: (thread: { id: string; threadTs: number }) => void;
    }) =>
      (
        <button
          data-testid="notification-item"
          onClick={() => onRead({ ...thread, threadTs: 7 })}>
          {`${thread.id} unread=${isUnread}`}
        </button>
      )
);
jest.mock('../../common/Loader/Loader', () => () => (
  <span data-testid="loader" />
));
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

const result = (
  ids: string[],
  total = ids.length,
  unread = 0,
  unreadIds: string[] = ids.slice(0, 1)
) => ({
  data: ids.map((id) => ({ id })),
  paging: { total, limit: 25, offset: 0 },
  unread,
  unreadIds,
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
    (markNotificationRead as jest.Mock).mockResolvedValue(2);
    (markAllNotificationsRead as jest.Mock).mockResolvedValue(0);
    (getNotifications as jest.Mock).mockResolvedValue(result(['a', 'b'], 2, 3));
  });

  it('lists the first page of every notification and reports the unread count', async () => {
    const onUnreadChange = await renderInbox();

    expect(getNotifications).toHaveBeenCalledWith({
      status: 'ALL',
      limit: 25,
      offset: 0,
    });

    const items = screen.getAllByTestId('notification-item');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('a unread=true');
    expect(items[1]).toHaveTextContent('b unread=false');
    expect(onUnreadChange).toHaveBeenCalledWith(3);
    expect(screen.getByTestId('paging')).toHaveTextContent('2/25');
    expect(screen.getByTestId('notifications-status-UNREAD')).toHaveTextContent(
      '3'
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('narrows the list to unread notifications and back to the first page', async () => {
    (getNotifications as jest.Mock).mockResolvedValue(result(['a'], 60));
    await renderInbox();
    await act(async () => mockPagingHandler({ currentPage: 2 }));

    expect(getNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ALL', offset: 25 })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('notifications-status-UNREAD'));
    });

    expect(getNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'UNREAD', offset: 0 })
    );
  });

  it('marks an unread notification read when it is clicked', async () => {
    await renderInbox();

    await act(async () => {
      fireEvent.click(screen.getAllByTestId('notification-item')[0]);
    });

    expect(markNotificationRead).toHaveBeenCalledWith('a', 7);
    expect(mockNotifyChanged).toHaveBeenCalled();
  });

  it('leaves a notification that is already read alone when it is clicked', async () => {
    await renderInbox();

    await act(async () => {
      fireEvent.click(screen.getAllByTestId('notification-item')[1]);
    });

    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it('marks all notifications read from the toolbar', async () => {
    await renderInbox();

    await act(async () => {
      fireEvent.click(screen.getByTestId('notifications-read-all'));
    });

    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(mockNotifyChanged).toHaveBeenCalled();
  });

  it('reloads the list when the read state changes elsewhere', async () => {
    await renderInbox();

    await act(async () => {
      window.dispatchEvent(new Event('om-notifications-changed'));
    });

    expect(getNotifications).toHaveBeenCalledTimes(2);
  });

  it('shows a neutral message when there is nothing to show', async () => {
    (getNotifications as jest.Mock).mockResolvedValue(result([]));
    await renderInbox();

    expect(screen.getByTestId('notifications-empty')).toHaveTextContent(
      'message.notifications-empty'
    );
    expect(screen.queryByTestId('notifications-show-all')).toBeNull();
    expect(screen.queryByTestId('paging')).not.toBeInTheDocument();
  });

  it('offers to show every notification once everything is read', async () => {
    await renderInbox();
    (getNotifications as jest.Mock).mockResolvedValue(result([]));

    await act(async () => {
      fireEvent.click(screen.getByTestId('notifications-status-UNREAD'));
    });

    expect(screen.getByTestId('notifications-empty')).toHaveTextContent(
      'message.notifications-all-read'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('notifications-show-all'));
    });

    expect(getNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ALL' })
    );
  });

  it('reports a failed load', async () => {
    (getNotifications as jest.Mock).mockRejectedValue(new Error());
    await renderInbox();

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(screen.getByTestId('notifications-empty')).toBeInTheDocument();
  });
});
