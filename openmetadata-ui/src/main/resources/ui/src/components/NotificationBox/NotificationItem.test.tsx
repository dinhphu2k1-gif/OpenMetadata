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
import { render, screen } from '@testing-library/react';
import { Thread } from '../../generated/entity/feed/thread';
import NotificationFeedCard from './NotificationFeedCard.component';
import NotificationItem from './NotificationItem.component';

jest.mock('./NotificationFeedCard.component', () =>
  jest.fn().mockReturnValue(<p>card</p>)
);
jest.mock('../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('fqn'),
  getEntityType: jest.fn().mockReturnValue('glossary'),
}));

const lastProps = () =>
  (NotificationFeedCard as unknown as jest.Mock).mock.calls.at(-1)?.[0];

const task = {
  id: 't1',
  type: 'Task',
  about: 'x',
  createdBy: 'user3',
  threadTs: 1000,
} as unknown as Thread;

describe('NotificationItem', () => {
  it('marks a notification newer than the last visit as unread', () => {
    render(<NotificationItem seenAt={999} thread={task} />);

    expect(screen.getByText('card')).toBeInTheDocument();
    expect(lastProps().isUnread).toBe(true);
    expect(lastProps().isConversationFeed).toBe(false);
    expect(lastProps().createdBy).toBe('user3');
  });

  it('leaves an older notification read', () => {
    render(<NotificationItem seenAt={1000} thread={task} />);

    expect(lastProps().isUnread).toBe(false);
  });

  it('credits a mention to the author of the mentioning post', () => {
    const conversation = {
      id: 'c1',
      type: 'Conversation',
      about: 'x',
      createdBy: 'creator',
      threadTs: 10,
      posts: [{ message: '<#E::user::user3>', postTs: 50, from: 'replier' }],
    } as unknown as Thread;
    render(<NotificationItem seenAt={0} thread={conversation} />);

    expect(lastProps().createdBy).toBe('replier');
    expect(lastProps().timestamp).toBe(50);
    expect(lastProps().isConversationFeed).toBe(true);
  });
});
