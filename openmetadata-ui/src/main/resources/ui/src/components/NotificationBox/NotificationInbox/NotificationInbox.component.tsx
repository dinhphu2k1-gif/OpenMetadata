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
import { Button } from 'antd';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BellIcon } from '../../../assets/svg/ic-alert-bell.svg';
import { Thread } from '../../../generated/entity/feed/thread';
import '../../../pages/TechnicalDictionaryPage/technicalDictionary.less';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationStatus,
} from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import NotificationItem from '../NotificationItem.component';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notifyNotificationsChanged,
} from '../NotificationRead';
import './notification-inbox.less';
import type { NotificationInboxProps } from './NotificationInbox.interface';

export const NOTIFICATIONS_PAGE_SIZE = 25;
export const NOTIFICATIONS_PAGE_SIZE_OPTIONS = [10, 25, 50];

const STATUSES = [
  { key: NotificationStatus.All, label: 'label.all' },
  { key: NotificationStatus.Unread, label: 'label.notification-status-unread' },
];

const NotificationInbox: FC<NotificationInboxProps> = ({ onUnreadChange }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<NotificationStatus>(
    NotificationStatus.All
  );
  const [unread, setUnread] = useState(0);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(NOTIFICATIONS_PAGE_SIZE);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getNotifications({
        status,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setThreads(result.data);
      setTotal(result.paging.total);
      setUnreadIds(result.unreadIds);
      setUnread(result.unread);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.notification') })
      );
    } finally {
      setIsLoading(false);
    }
  }, [status, page, pageSize, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [onUnreadChange, unread]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);

    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
  }, [load]);

  const handleRead = useCallback(
    (thread: Thread) => {
      if (unreadIds.includes(thread.id)) {
        markNotificationRead(thread.id, thread.threadTs)
          .then(notifyNotificationsChanged)
          .catch(() => undefined);
      }
    },
    [unreadIds]
  );

  const handleReadAll = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      notifyNotificationsChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const handleStatus = useCallback((next: NotificationStatus) => {
    setStatus(next);
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
      <div className="tech-dict-content-card" data-testid="notifications-card">
        <div className="notification-inbox-toolbar">
          <div className="notification-inbox-filters">
            {STATUSES.map(({ key, label }) => (
              <button
                className={`notification-inbox-filter ${
                  status === key ? 'active' : ''
                }`}
                data-testid={`notifications-status-${key}`}
                key={key}
                type="button"
                onClick={() => handleStatus(key)}>
                {t(label)}
                {key === NotificationStatus.Unread && unread > 0 && (
                  <span className="notification-inbox-filter-count">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <Button
              data-testid="notifications-read-all"
              type="link"
              onClick={handleReadAll}>
              {t('label.notification-mark-all-read')}
            </Button>
          )}
        </div>
        {isLoading && (
          <div className="notification-inbox-loader">
            <Loader />
          </div>
        )}
        {!isLoading && threads.length === 0 && (
          <div
            className="notification-inbox-empty"
            data-testid="notifications-empty">
            <BellIcon height={32} width={32} />
            <p>
              {t(
                status === NotificationStatus.Unread
                  ? 'message.notifications-all-read'
                  : 'message.notifications-empty'
              )}
            </p>
            {status === NotificationStatus.Unread && (
              <Button
                data-testid="notifications-show-all"
                type="link"
                onClick={() => handleStatus(NotificationStatus.All)}>
                {t('label.view-entity', {
                  entity: t('label.all-lowercase'),
                })}
              </Button>
            )}
          </div>
        )}
        {!isLoading && threads.length > 0 && (
          <>
            <ul className="notification-inbox-list">
              {threads.map((thread) => (
                <li className="notification-inbox-item" key={thread.id}>
                  <NotificationItem
                    isUnread={unreadIds.includes(thread.id)}
                    thread={thread}
                    onRead={handleRead}
                  />
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
