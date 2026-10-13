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
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Thread } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import '../../../pages/TechnicalDictionaryPage/technicalDictionary.less';
import { getNotifications, NotificationGroup } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import NotificationItem from '../NotificationItem.component';
import {
  markNotificationsSeen,
  readNotificationSeenAt,
} from '../NotificationSeen';
import './notification-inbox.less';
import type { NotificationInboxProps } from './NotificationInbox.interface';

export const NOTIFICATIONS_PAGE_SIZE = 25;
export const NOTIFICATIONS_PAGE_SIZE_OPTIONS = [10, 25, 50];

const GROUPS = [
  { key: NotificationGroup.All, label: 'label.all' },
  {
    key: NotificationGroup.Pending,
    label: 'label.notification-group-pending',
  },
  {
    key: NotificationGroup.Decisions,
    label: 'label.notification-group-decisions',
  },
];

const NotificationInbox: FC<NotificationInboxProps> = ({ onUnreadChange }) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [seenAt] = useState<number>(() =>
    readNotificationSeenAt(currentUser?.id)
  );
  const [group, setGroup] = useState<NotificationGroup>(NotificationGroup.All);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(NOTIFICATIONS_PAGE_SIZE);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getNotifications({
        group,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        unreadSince: seenAt,
      });
      setThreads(result.data);
      setTotal(result.paging.total);
      onUnreadChange?.(result.unread);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.notification') })
      );
    } finally {
      setIsLoading(false);
    }
  }, [group, onUnreadChange, page, pageSize, seenAt, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    markNotificationsSeen(currentUser?.id);
  }, [currentUser?.id]);

  const handleGroup = useCallback((next: NotificationGroup) => {
    setGroup(next);
    setPage(1);
  }, []);

  const handlePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const handlePage = useCallback(
    ({ currentPage }: PagingHandlerParams) => setPage(currentPage),
    []
  );

  return (
    <div className="notification-inbox">
      <div className="tech-dict-tab-card">
        <div className="tech-dict-tab-list" role="tablist">
          {GROUPS.map(({ key, label }) => (
            <button
              aria-selected={group === key}
              className={`tech-dict-tab ${group === key ? 'active' : ''}`}
              data-testid={`notifications-group-${key}`}
              key={key}
              role="tab"
              type="button"
              onClick={() => handleGroup(key)}>
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      <div className="tech-dict-content-card" data-testid="notifications-card">
        {isLoading && (
          <div className="notification-inbox-loader">
            <Loader />
          </div>
        )}
        {!isLoading && threads.length === 0 && (
          <ErrorPlaceHolder
            className="p-md"
            placeholderText={t('message.notifications-empty')}
            type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
          />
        )}
        {!isLoading && threads.length > 0 && (
          <>
            <ul className="notification-inbox-list">
              {threads.map((thread) => (
                <li className="notification-inbox-item" key={thread.id}>
                  <NotificationItem seenAt={seenAt} thread={thread} />
                </li>
              ))}
            </ul>
            <NextPrevious
              isNumberBased
              currentPage={page}
              pageSize={pageSize}
              pageSizeOptions={NOTIFICATIONS_PAGE_SIZE_OPTIONS}
              paging={{ total }}
              pagingHandler={handlePage}
              onShowSizeChange={handlePageSize}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationInbox;
