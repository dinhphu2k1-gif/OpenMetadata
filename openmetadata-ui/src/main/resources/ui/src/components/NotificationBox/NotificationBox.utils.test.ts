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
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { getNotificationTime } from './NotificationBox.utils';

const thread = (id: string, type: ThreadType, threadTs: number) =>
  ({ id, type, threadTs, posts: [] } as unknown as Thread);

describe('NotificationBox.utils', () => {
  it('dates a conversation by its latest post that mentions someone', () => {
    const conversation = {
      ...thread('conversation', ThreadType.Conversation, 100),
      posts: [
        { message: 'hi <#E::user::user3>', postTs: 400, from: 'a' },
        { message: 'no mention', postTs: 500, from: 'b' },
      ],
    } as unknown as Thread;

    expect(getNotificationTime(conversation)).toBe(400);
  });

  it('dates a task, or a conversation without mentions, by its thread time', () => {
    expect(getNotificationTime(thread('task', ThreadType.Task, 100))).toBe(100);
    expect(
      getNotificationTime(thread('chat', ThreadType.Conversation, 200))
    ).toBe(200);
  });
});
