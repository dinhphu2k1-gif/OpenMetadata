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
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Thread } from '../../generated/entity/feed/thread';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import {
  GovernedNoticeOutcome,
  GovernedReviewNotice,
  getGovernedNoticeOutcome,
  getGovernedNoticePath,
} from '../../utils/GovernedReviewTaskUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import StatusBadge from '../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../common/StatusBadge/StatusBadge.interface';

interface GovernedReviewNotificationCardProps {
  createdBy: string;
  isUnread?: boolean;
  notice: GovernedReviewNotice;
  thread: Thread;
  timestamp?: number;
}

const OUTCOME_BADGE: Record<
  GovernedNoticeOutcome,
  { label: string; status: StatusType }
> = {
  [GovernedNoticeOutcome.Pending]: {
    label: 'label.in-review',
    status: StatusType.InReview,
  },
  [GovernedNoticeOutcome.Cleared]: {
    label: 'label.processed',
    status: StatusType.Archived,
  },
  [GovernedNoticeOutcome.Approved]: {
    label: 'label.approved',
    status: StatusType.Success,
  },
  [GovernedNoticeOutcome.Rejected]: {
    label: 'label.rejected',
    status: StatusType.Failure,
  },
  [GovernedNoticeOutcome.Mixed]: {
    label: 'label.processed',
    status: StatusType.Acknowledged,
  },
};

/** One governed review notification, worded from its structured facts. */
const GovernedReviewNotificationCard: FC<
  GovernedReviewNotificationCardProps
> = ({ createdBy, isUnread = false, notice, thread, timestamp }) => {
  const { t } = useTranslation();
  const [, , user] = useUserProfile({ permission: true, name: createdBy });
  const displayName = user?.displayName || user?.name || createdBy;
  const outcome = getGovernedNoticeOutcome(notice);
  const badge = OUTCOME_BADGE[outcome];
  const approved = notice.approvedCount ?? 0;
  const rejected = notice.rejectedCount ?? 0;

  const action = useMemo(() => {
    const request = notice.requestName ?? '';
    const texts: Record<GovernedNoticeOutcome, string> = {
      [GovernedNoticeOutcome.Pending]: t('message.governed-review-submitted'),
      [GovernedNoticeOutcome.Cleared]: t('message.governed-review-cleared'),
      [GovernedNoticeOutcome.Approved]:
        approved === 1 && request
          ? t('message.governed-review-approved', { request })
          : t('message.governed-review-processed', {
              total: approved + rejected,
            }),
      [GovernedNoticeOutcome.Rejected]:
        rejected === 1 && request
          ? t('message.governed-review-rejected', { request })
          : t('message.governed-review-processed', {
              total: approved + rejected,
            }),
      [GovernedNoticeOutcome.Mixed]: t('message.governed-review-processed', {
        total: approved + rejected,
      }),
    };

    return texts[outcome];
  }, [approved, rejected, notice.requestName, outcome, t]);

  const detail = useMemo(() => {
    const isPending = outcome === GovernedNoticeOutcome.Pending;
    const isBatch = approved + rejected > 1;
    const parts = [notice.catalogName];
    if (isPending) {
      parts.push(
        t('message.governed-review-pending-count', {
          pending: notice.pendingCount,
        })
      );
    } else if (isBatch) {
      parts.push(t('message.governed-review-counts', { approved, rejected }));
    }

    return parts.filter(Boolean).join(' · ');
  }, [approved, rejected, notice, outcome, t]);

  const sentence = `${displayName} ${action}`;

  return (
    <Link
      aria-label={`${sentence}. ${detail}`}
      className={classNames('no-underline governed-notification', {
        'notification-item-unread': isUnread,
      })}
      data-testid="governed-notification"
      to={getGovernedNoticePath(thread)}>
      <div className="d-flex gap-2 p-x-xs">
        <ProfilePicture name={createdBy} width="32" />
        <Space direction="vertical" size={2}>
          <Typography.Text data-testid="governed-notification-sentence">
            <strong>{displayName}</strong> {action}
          </Typography.Text>
          <Typography.Text
            className="text-grey-muted"
            data-testid="governed-notification-detail">
            {detail}
          </Typography.Text>
          <Space size={8}>
            <StatusBadge
              dataTestId="governed-notification-status"
              displayLabel={t(badge.label)}
              label={outcome}
              status={badge.status}
            />
            <Typography.Text
              className="text-grey-muted text-xs"
              title={formatDateTime(timestamp)}>
              {getRelativeTime(timestamp)}
            </Typography.Text>
          </Space>
        </Space>
      </div>
    </Link>
  );
};

export default GovernedReviewNotificationCard;
