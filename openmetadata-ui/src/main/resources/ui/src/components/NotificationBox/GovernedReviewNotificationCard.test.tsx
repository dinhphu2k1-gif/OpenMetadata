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
import GovernedReviewNotificationCard from './GovernedReviewNotificationCard.component';

jest.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a data-to={to} href={to} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock('../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn(() => [
    null,
    false,
    { name: 'user4', displayName: 'User 4 (Data Steward)' },
  ]),
}));
jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../utils/date-time/DateTimeUtils'),
  formatDateTime: jest.fn().mockReturnValue('formatted'),
  getRelativeTime: jest.fn().mockReturnValue('14 phút trước'),
}));
jest.mock('../../utils/GovernedReviewTaskUtils', () => ({
  ...jest.requireActual('../../utils/GovernedReviewTaskUtils'),
  getGovernedNoticePath: jest.fn().mockReturnValue('/target'),
}));
jest.mock('../common/ProfilePicture/ProfilePicture', () => () => (
  <span>avatar</span>
));

const thread = {} as Thread;
const CATALOG = 'Từ điển dữ liệu dùng chung';

const renderCard = (
  notice: Record<string, unknown>,
  props: Record<string, unknown> = {}
) =>
  render(
    <GovernedReviewNotificationCard
      createdBy="user4"
      notice={{ kind: 'DECISION', catalogName: CATALOG, ...notice } as never}
      thread={thread}
      timestamp={1}
      {...props}
    />
  );

describe('GovernedReviewNotificationCard', () => {
  it('words an approved request from its facts, with the display name', () => {
    renderCard({
      approvedCount: 1,
      rejectedCount: 0,
      requestName: 'Tên khách hàng',
    });

    expect(
      screen.getByTestId('governed-notification-sentence')
    ).toHaveTextContent(
      'User 4 (Data Steward) message.governed-review-approved'
    );
    expect(
      screen.getByTestId('governed-notification-detail')
    ).toHaveTextContent(CATALOG);
    expect(
      screen.getByTestId('governed-notification-status')
    ).toHaveTextContent('label.approved');
  });

  it('words a rejected request', () => {
    renderCard({ approvedCount: 0, rejectedCount: 1, requestName: 'X' });

    expect(
      screen.getByTestId('governed-notification-sentence')
    ).toHaveTextContent('message.governed-review-rejected');
    expect(
      screen.getByTestId('governed-notification-status')
    ).toHaveTextContent('label.rejected');
  });

  it('summarises a batch with its counts', () => {
    renderCard({ approvedCount: 2, rejectedCount: 1 });

    expect(
      screen.getByTestId('governed-notification-sentence')
    ).toHaveTextContent('message.governed-review-processed');
    expect(
      screen.getByTestId('governed-notification-detail')
    ).toHaveTextContent(`${CATALOG} · message.governed-review-counts`);
    expect(
      screen.getByTestId('governed-notification-status')
    ).toHaveTextContent('label.processed');
  });

  it('shows the queue size of a pending task', () => {
    renderCard({ kind: 'PENDING', pendingCount: 3 });

    expect(
      screen.getByTestId('governed-notification-sentence')
    ).toHaveTextContent('message.governed-review-submitted');
    expect(
      screen.getByTestId('governed-notification-detail')
    ).toHaveTextContent(`${CATALOG} · message.governed-review-pending-count`);
    expect(
      screen.getByTestId('governed-notification-status')
    ).toHaveTextContent('label.in-review');
  });

  it('says nothing waits once the queue is cleared', () => {
    renderCard({ kind: 'PENDING', pendingCount: 0 });

    expect(
      screen.getByTestId('governed-notification-sentence')
    ).toHaveTextContent('message.governed-review-cleared');
    expect(
      screen.getByTestId('governed-notification-status')
    ).toHaveTextContent('label.processed');
  });

  it('is one real link to its target, marked when unread', () => {
    renderCard(
      { approvedCount: 1, rejectedCount: 0, requestName: 'X' },
      {
        isUnread: true,
      }
    );

    const link = screen.getByTestId('governed-notification');

    expect(link).toHaveAttribute('href', '/target');
    expect(link).toHaveAttribute('aria-label');
    expect(link).toHaveClass('notification-item-unread');
  });

  it('is not marked once read', () => {
    renderCard({ approvedCount: 1, rejectedCount: 0, requestName: 'X' });

    expect(screen.getByTestId('governed-notification')).not.toHaveClass(
      'notification-item-unread'
    );
  });
});
