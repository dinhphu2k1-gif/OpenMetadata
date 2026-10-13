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
import { fireEvent, render, screen } from '@testing-library/react';
import NotificationsPage from './NotificationsPage.component';

jest.mock(
  '../../components/NotificationBox/NotificationInbox/NotificationInbox.component',
  () =>
    ({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) =>
      (
        <button
          data-testid="notification-inbox"
          type="button"
          onClick={() => onUnreadChange?.(3)}>
          NotificationInbox
        </button>
      )
);
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

describe('NotificationsPage', () => {
  it('renders the header and notification inbox', () => {
    render(<NotificationsPage />);

    expect(
      screen.getByRole('heading', { name: 'label.notification-plural' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('notification-inbox')).toBeInTheDocument();
  });

  it('shows the unread count reported by the notification inbox', () => {
    render(<NotificationsPage />);

    fireEvent.click(screen.getByTestId('notification-inbox'));

    expect(screen.getByTestId('notifications-unread-count')).toHaveTextContent(
      '3'
    );
  });
});
