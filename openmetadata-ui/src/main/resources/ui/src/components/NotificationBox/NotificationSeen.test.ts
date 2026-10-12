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
  hasUnseenNotification,
  markNotificationsSeen,
  NOTIFICATIONS_SEEN_EVENT,
  readNotificationSeenAt,
} from './NotificationSeen';

const mockGetNotifications = jest.fn();

jest.mock('../../rest/feedsAPI', () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
}));

describe('NotificationSeen', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetNotifications.mockReset();
  });

  it('asks the server in one request whether anything is newer than the last visit', async () => {
    markNotificationsSeen('steward');
    const seenAt = readNotificationSeenAt('steward');
    mockGetNotifications.mockResolvedValue({ data: [], unread: 2 });

    expect(await hasUnseenNotification('steward')).toBe(true);
    expect(mockGetNotifications).toHaveBeenCalledTimes(1);
    expect(mockGetNotifications).toHaveBeenCalledWith({
      limit: 1,
      unreadSince: seenAt,
    });
  });

  it('stays quiet when nothing is unread', async () => {
    mockGetNotifications.mockResolvedValue({ data: [], unread: 0 });

    expect(await hasUnseenNotification('steward')).toBe(false);
  });

  it('stays quiet without a user or when the request fails', async () => {
    mockGetNotifications.mockRejectedValue(new Error('offline'));

    expect(await hasUnseenNotification(undefined)).toBe(false);
    expect(await hasUnseenNotification('steward')).toBe(false);
    expect(mockGetNotifications).toHaveBeenCalledTimes(1);
  });

  it('remembers the last visit per user and announces it to the bell', () => {
    const listener = jest.fn();
    window.addEventListener(NOTIFICATIONS_SEEN_EVENT, listener);

    markNotificationsSeen('steward');

    expect(readNotificationSeenAt('steward')).toBeGreaterThan(0);
    expect(readNotificationSeenAt('other')).toBe(0);
    expect(readNotificationSeenAt(undefined)).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(NOTIFICATIONS_SEEN_EVENT, listener);
  });
});
