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
  migrateLegacySeenMark,
  NOTIFICATIONS_CHANGED_EVENT,
  notifyNotificationsChanged,
} from './NotificationRead';

const mockMarkAllRead = jest.fn();

jest.mock('../../rest/feedsAPI', () => ({
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllRead(...args),
}));

describe('NotificationRead', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMarkAllRead.mockReset();
    mockMarkAllRead.mockResolvedValue(0);
  });

  it('hands the old browser mark to the server once and removes it', async () => {
    localStorage.setItem('om-notification-seen-steward', '1234');

    await migrateLegacySeenMark('steward');
    await migrateLegacySeenMark('steward');

    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    expect(mockMarkAllRead).toHaveBeenCalledWith(1234);
    expect(localStorage.getItem('om-notification-seen-steward')).toBeNull();
  });

  it('keeps the old mark when the server cannot take it', async () => {
    localStorage.setItem('om-notification-seen-steward', '1234');
    mockMarkAllRead.mockRejectedValue(new Error('offline'));

    await migrateLegacySeenMark('steward');

    expect(localStorage.getItem('om-notification-seen-steward')).toBe('1234');
  });

  it('does nothing without a user or an old mark', async () => {
    await migrateLegacySeenMark(undefined);
    await migrateLegacySeenMark('steward');

    expect(mockMarkAllRead).not.toHaveBeenCalled();
  });

  it('announces a change of the read state to the bell', () => {
    const listener = jest.fn();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);

    notifyNotificationsChanged();

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  });
});
