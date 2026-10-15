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
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../rest/feedsAPI';
import NotificationBox from './NotificationBox.component';
import { NOTIFICATION_LIST_SIZE } from './NotificationBox.utils';

const mockShowErrorToast = jest.fn();
const mockNotifyChanged = jest.fn();

jest.mock('../../rest/feedsAPI', () => ({
  ...jest.requireActual('../../rest/feedsAPI'),
  getNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

jest.mock('./NotificationItem.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        thread,
        onRead,
      }: {
        thread: { id: string };
        onRead: (thread: { id: string }) => void;
      }) => (
        <button data-testid="notification-item" onClick={() => onRead(thread)}>
          {thread.id}
        </button>
      )
    )
);

jest.mock('./NotificationRead', () => ({
  notifyNotificationsChanged: () => mockNotifyChanged(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
}));

const renderBox = async () => {
  await act(async () => {
    render(<NotificationBox />, { wrapper: MemoryRouter });
  });
};

describe('Test NotificationBox Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (markNotificationRead as jest.Mock).mockResolvedValue(1);
    (markAllNotificationsRead as jest.Mock).mockResolvedValue(0);
    (getNotifications as jest.Mock).mockResolvedValue({
      data: [
        { id: 'first', threadTs: 100 },
        { id: 'second', threadTs: 300 },
      ],
      paging: { total: 2, limit: 5, offset: 0 },
      unread: 2,
      unreadIds: ['first', 'second'],
    });
  });

  it('should render one notification list without tabs', async () => {
    await renderBox();

    expect(await screen.findByTestId('notification-heading')).toHaveTextContent(
      'label.notification-plural'
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('should load only the unread notifications with a single request', async () => {
    await renderBox();

    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(getNotifications).toHaveBeenCalledWith({
      status: 'UNREAD',
      limit: NOTIFICATION_LIST_SIZE,
    });
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
  });

  it('should take a notification off the list and mark it read when it is clicked', async () => {
    await renderBox();

    await act(async () => {
      fireEvent.click(screen.getAllByTestId('notification-item')[0]);
    });

    expect(markNotificationRead).toHaveBeenCalledWith('first', 100);
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);
    expect(mockNotifyChanged).toHaveBeenCalled();
  });

  it('should mark everything up to the newest shown notification as read', async () => {
    await renderBox();

    await act(async () => {
      fireEvent.click(screen.getByTestId('notification-read-all'));
    });

    expect(markAllNotificationsRead).toHaveBeenCalledWith(300);
    expect(screen.queryAllByTestId('notification-item')).toHaveLength(0);
    expect(screen.getByTestId('notification-empty')).toBeInTheDocument();
    expect(mockNotifyChanged).toHaveBeenCalled();
  });

  it('should not offer to mark all as read when nothing is unread', async () => {
    (getNotifications as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0, limit: 5, offset: 0 },
      unread: 0,
      unreadIds: [],
    });
    await renderBox();

    expect(screen.queryByTestId('notification-read-all')).toBeNull();
  });

  it('should offer a small view-all link to the notifications page', async () => {
    await renderBox();
    const link = screen.getByTestId('notification-view-all');

    expect(link).toHaveAttribute('href', ROUTES.NOTIFICATIONS);
    expect(link.closest('button')).toBeNull();
  });

  it('should show an error toast and an empty list when the request fails', async () => {
    (getNotifications as jest.Mock).mockRejectedValue(new Error());
    await renderBox();

    expect(mockShowErrorToast).toHaveBeenCalled();
    expect(
      await screen.findByText('message.notifications-all-read')
    ).toBeInTheDocument();
  });

  it('should render no data in case of no notification', async () => {
    (getNotifications as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0, limit: 5, offset: 0 },
      unread: 0,
      unreadIds: [],
    });
    await renderBox();

    expect(
      await screen.findByText('message.notifications-all-read')
    ).toBeInTheDocument();
  });
});
