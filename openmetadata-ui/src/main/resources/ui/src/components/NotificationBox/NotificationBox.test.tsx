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
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { getNotifications } from '../../rest/feedsAPI';
import NotificationBox from './NotificationBox.component';
import { NOTIFICATION_LIST_SIZE } from './NotificationBox.utils';

const mockShowErrorToast = jest.fn();
let mockSeenAt = 0;

jest.mock('../../rest/feedsAPI', () => ({
  getNotifications: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { id: 'user-id', name: 'user3' },
  })),
}));

jest.mock('./NotificationItem.component', () =>
  jest
    .fn()
    .mockImplementation(
      ({ thread, seenAt }: { thread: { id: string }; seenAt: number }) => (
        <p data-testid="notification-item">{`${thread.id} seen=${seenAt}`}</p>
      )
    )
);

jest.mock('./NotificationSeen', () => ({
  readNotificationSeenAt: jest.fn(() => mockSeenAt),
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
    mockSeenAt = 0;
    (getNotifications as jest.Mock).mockResolvedValue({
      data: [{ id: 'first' }, { id: 'second' }],
      paging: { total: 2, limit: 5, offset: 0 },
      unread: 1,
    });
  });

  it('should render one notification list without tabs', async () => {
    await renderBox();

    expect(await screen.findByTestId('notification-heading')).toHaveTextContent(
      'label.notification-plural'
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('should load the newest notifications with a single request', async () => {
    await renderBox();

    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(getNotifications).toHaveBeenCalledWith({
      limit: NOTIFICATION_LIST_SIZE,
    });
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
  });

  it('should hand the last visit time to every item', async () => {
    mockSeenAt = 123;
    await renderBox();

    expect(screen.getAllByTestId('notification-item')[0]).toHaveTextContent(
      'seen=123'
    );
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
      await screen.findByText('message.no-notification-found')
    ).toBeInTheDocument();
  });

  it('should render no data in case of no notification', async () => {
    (getNotifications as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0, limit: 5, offset: 0 },
      unread: 0,
    });
    await renderBox();

    expect(
      await screen.findByText('message.no-notification-found')
    ).toBeInTheDocument();
  });
});
