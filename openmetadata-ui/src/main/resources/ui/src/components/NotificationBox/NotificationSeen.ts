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
import { getNotifications } from '../../rest/feedsAPI';

const SEEN_KEY_PREFIX = 'om-notification-seen-';

/** Fired on the window when the user has read their notifications, so the bell drops its dot. */
export const NOTIFICATIONS_SEEN_EVENT = 'om-notifications-seen';

const seenKey = (userId: string) => `${SEEN_KEY_PREFIX}${userId}`;

/** When the user last opened the bell; 0 if never. */
export const readNotificationSeenAt = (userId?: string): number => {
  if (!userId) {
    return 0;
  }
  try {
    return Number(localStorage.getItem(seenKey(userId)) ?? 0);
  } catch {
    return 0;
  }
};

/** Remembers when the user last opened the notification bell. */
export const markNotificationsSeen = (userId?: string) => {
  if (userId) {
    try {
      localStorage.setItem(seenKey(userId), String(Date.now()));
    } catch {
      // Storage can be unavailable; the dot then reappears on the next load.
    }
    window.dispatchEvent(new Event(NOTIFICATIONS_SEEN_EVENT));
  }
};

/**
 * The WebSocket only reaches users who are online when a task is assigned or
 * they are mentioned, so on load the bell also asks the server whether anything
 * is newer than the last time it was opened.
 */
export const hasUnseenNotification = async (userId?: string) => {
  let hasUnseen = false;
  if (userId) {
    try {
      const { unread } = await getNotifications({
        limit: 1,
        unreadSince: readNotificationSeenAt(userId),
      });
      hasUnseen = unread > 0;
    } catch {
      hasUnseen = false;
    }
  }

  return hasUnseen;
};
