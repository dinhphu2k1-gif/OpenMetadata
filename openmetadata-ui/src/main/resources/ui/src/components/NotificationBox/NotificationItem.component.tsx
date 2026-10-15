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
import { FC } from 'react';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { getEntityFQN, getEntityType } from '../../utils/FeedUtils';
import { getNotificationTime } from './NotificationBox.utils';
import NotificationFeedCard from './NotificationFeedCard.component';

interface NotificationItemProps {
  isUnread: boolean;
  onRead?: (thread: Thread) => void;
  thread: Thread;
}

/** One notification, shared by the bell and the notifications page. */
const NotificationItem: FC<NotificationItemProps> = ({
  isUnread,
  onRead,
  thread,
}) => {
  const isConversationFeed = thread.type === ThreadType.Conversation;
  const timestamp = getNotificationTime(thread);
  const mentionPost = isConversationFeed
    ? thread.posts?.find((post) => post.postTs === timestamp)
    : undefined;

  return (
    <div onClickCapture={() => onRead?.(thread)}>
      <NotificationFeedCard
        createdBy={mentionPost?.from ?? thread.createdBy ?? ''}
        entityFQN={getEntityFQN(thread.about) as string}
        entityType={getEntityType(thread.about) as string}
        feedType={thread.type ?? ThreadType.Conversation}
        isConversationFeed={isConversationFeed}
        isUnread={isUnread}
        task={thread}
        timestamp={timestamp}
      />
    </div>
  );
};

export default NotificationItem;
