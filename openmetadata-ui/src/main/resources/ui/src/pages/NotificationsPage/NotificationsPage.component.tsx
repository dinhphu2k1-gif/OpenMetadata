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
import { ReactComponent as BellIcon } from '../../assets/svg/ic-alert-bell.svg';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import NotificationItem from '../../components/NotificationBox/NotificationItem.component';
import {
  markNotificationsSeen,
  readNotificationSeenAt,
} from '../../components/NotificationBox/NotificationSeen';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Thread } from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getNotifications, NotificationGroup } from '../../rest/feedsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import '../TechnicalDictionaryPage/technicalDictionary.less';
import './notifications-page.less';

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

/** The user's whole notification inbox, the destination of the bell's "view all". */
const NotificationsPage: FC = () => {
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
  const [unread, setUnread] = useState(0);
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
      setUnread(result.unread);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.notification') })
      );
    } finally {
      setIsLoading(false);
    }
  }, [group, page, pageSize, seenAt, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    markNotificationsSeen(currentUser?.id);
  }, [currentUser?.id]);

  const handleGroup = (next: NotificationGroup) => {
    setGroup(next);
    setPage(1);
  };

  const handlePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <PageLayoutV1 pageTitle={t('label.notification-plural')}>
      <div className="tech-dict-page-container notifications-page">
        <div className="tech-dict-page-header">
          <div className="tech-dict-title-row">
            <div className="tech-dict-title-left">
              <div className="tech-dict-icon-wrapper">
                <BellIcon height={22} width={22} />
              </div>
              <div className="tech-dict-title-copy">
                <div className="tech-dict-title-heading">
                  <h1 className="tech-dict-title">
                    {t('label.notification-plural')}
                  </h1>
                  {unread > 0 && (
                    <span
                      className="tech-dict-tab-count"
                      data-testid="notifications-unread-count">
                      {unread}
                    </span>
                  )}
                </div>
                <div className="tech-dict-subtitle">
                  {t('message.notifications-page-subtitle')}
                </div>
              </div>
            </div>
          </div>
        </div>
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
        <div
          className="tech-dict-content-card"
          data-testid="notifications-card">
          {isLoading && (
            <div className="notifications-page-loader">
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
              <ul className="notifications-page-list">
                {threads.map((thread) => (
                  <li className="notifications-page-item" key={thread.id}>
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
                pagingHandler={({ currentPage }: PagingHandlerParams) =>
                  setPage(currentPage)
                }
                onShowSizeChange={handlePageSize}
              />
            </>
          )}
        </div>
      </div>
    </PageLayoutV1>
  );
};

export default NotificationsPage;
