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
import { markAllNotificationsRead } from '../../rest/feedsAPI';

const LEGACY_SEEN_KEY_PREFIX = 'om-notification-seen-';

/** Fired on the window when notifications were read, so the bell refreshes its count. */
export const NOTIFICATIONS_CHANGED_EVENT = 'om-notifications-changed';

export const notifyNotificationsChanged = () =>
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

/**
 * Read state used to be a time kept in this browser. The first time the user is seen after the
 * move to the server, that time is handed over as a read-all mark and the local copy removed.
 */
export const migrateLegacySeenMark = async (userId?: string) => {
  if (!userId) {
    return;
  }
  try {
    const key = `${LEGACY_SEEN_KEY_PREFIX}${userId}`;
    const seenAt = Number(localStorage.getItem(key) ?? 0);
    if (seenAt > 0) {
      await markAllNotificationsRead(seenAt);
    }
    localStorage.removeItem(key);
  } catch {
    // Storage or the server can be unavailable; the mark is handed over on a later load.
  }
};
