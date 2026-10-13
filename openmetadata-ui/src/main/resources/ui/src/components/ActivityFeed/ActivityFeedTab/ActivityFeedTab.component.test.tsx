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
import { render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import {
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { ActivityFeedTab } from './ActivityFeedTab.component';
import { ActivityFeedTabs } from './ActivityFeedTab.interface';

const mockGetFeedData = jest.fn();
const mockGetFeedCount = jest.fn();
const mockGetFeedCounts = jest.fn();
const mockParams = {
  subTab: ActivityFeedTabs.TASKS,
};

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(() => ({ key: 'key', state: null })),
  useNavigate: jest.fn(() => jest.fn()),
}));
jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => ({ isAdminUser: false })),
}));
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { name: 'current-user' },
  })),
}));
jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: jest.fn(() => [jest.fn(), false]),
}));
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'another-user' })),
}));
jest.mock('../../../rest/feedsAPI', () => ({
  getFeedCount: (...args: unknown[]) => mockGetFeedCount(...args),
}));
jest.mock('../../../utils/CommonUtils', () => ({
  getCountBadge: jest.fn(() => null),
  getFeedCounts: (...args: unknown[]) => mockGetFeedCounts(...args),
}));
jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => mockParams),
}));
jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () => () => (
  <div />
));
jest.mock('../../common/Loader/Loader', () => () => <div />);
jest.mock('../../Entity/Task/TaskTab/TaskTabNew.component', () => ({
  TaskTabNew: () => <div />,
}));
jest.mock('../ActivityFeedList/ActivityFeedListV1New.component', () => () => (
  <div />
));
jest.mock('../ActivityFeedPanel/FeedPanelBodyV1New', () => () => <div />);
jest.mock('../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: jest.fn(() => ({
    entityPaging: {},
    entityThread: [],
    getFeedData: mockGetFeedData,
    loading: false,
    selectedThread: undefined,
    setActiveThread: jest.fn(),
  })),
}));

describe('ActivityFeedTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeedCount.mockResolvedValue([
      {
        closedTaskCount: 0,
        conversationCount: 0,
        mentionCount: 0,
        openTaskCount: 0,
        totalTaskCount: 0,
      },
    ]);
    mockGetFeedCounts.mockResolvedValue(undefined);
    mockParams.subTab = ActivityFeedTabs.TASKS;
  });

  it('uses tasks and hides the task toggle for a user legacy mentions tab', async () => {
    mockParams.subTab = ActivityFeedTabs.MENTIONS;

    const { container } = render(
      <ActivityFeedTab
        entityType={EntityType.USER}
        subTab={ActivityFeedTabs.TASKS}
        onFeedUpdate={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetFeedData).toHaveBeenCalledWith(
        FeedFilter.OWNER_OR_FOLLOWS,
        undefined,
        ThreadType.Task,
        EntityType.USER,
        'another-user',
        ThreadTaskStatus.Open
      );
    });

    expect(container.querySelector('.task-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText('label.mention-plural')).not.toBeInTheDocument();
  });

  it('keeps the task toggle for non-user entities', async () => {
    const { container } = render(
      <ActivityFeedTab
        entityType={EntityType.GLOSSARY}
        subTab={ActivityFeedTabs.TASKS}
        onFeedUpdate={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetFeedCounts).toHaveBeenCalled();
    });

    expect(container.querySelector('.task-toggle')).toBeInTheDocument();
    expect(screen.getByText('label.mention-plural')).toBeInTheDocument();
  });
});
