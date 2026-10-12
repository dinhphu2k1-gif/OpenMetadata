/*
 *  Copyright 2022 Collate.
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

import { Thread, ThreadType } from '../../generated/entity/feed/thread';

export const NOTIFICATION_LIST_SIZE = 5;

const MENTION_MARKUP = '<#E::user::';

/**
 * When the reader was notified: the latest post that mentions someone in a
 * conversation, otherwise the thread time, which a review task moves forward
 * on every new submission.
 */
export const getNotificationTime = (thread: Thread) => {
  const mentionPostTimes = (thread.posts ?? [])
    .filter(
      (post) =>
        post.message.includes(MENTION_MARKUP) && post.postTs !== undefined
    )
    .map((post) => post.postTs ?? 0);

  return thread.type === ThreadType.Conversation && mentionPostTimes.length > 0
    ? Math.max(...mentionPostTimes)
    : thread.threadTs ?? 0;
};
