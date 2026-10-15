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

import { Button, List, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { Thread } from '../../generated/entity/feed/thread';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationStatus,
} from '../../rest/feedsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import './notification-box.less';
import { NOTIFICATION_LIST_SIZE } from './NotificationBox.utils';
import NotificationItem from './NotificationItem.component';
import { notifyNotificationsChanged } from './NotificationRead';

/** The reader's unread tasks and mentions in one list; reading one takes it off the list. */
const NotificationBox = () => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data } = await getNotifications({
        status: NotificationStatus.Unread,
        limit: NOTIFICATION_LIST_SIZE,
      });
      setNotifications(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.notification'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleRead = useCallback((thread: Thread) => {
    setNotifications((current) => current.filter(({ id }) => id !== thread.id));
    markNotificationRead(thread.id, thread.threadTs)
      .then(notifyNotificationsChanged)
      .catch(() => undefined);
  }, []);

  const handleReadAll = async () => {
    const newest = Math.max(
      ...notifications.map(({ threadTs }) => threadTs ?? 0)
    );
    try {
      await markAllNotificationsRead(newest);
      setNotifications([]);
      notifyNotificationsChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const notificationDropDownList = notifications.map((thread) => (
    <NotificationItem
      isUnread
      key={thread.id}
      thread={thread}
      onRead={handleRead}
    />
  ));

  const notificationList = isEmpty(notifications) ? (
    <>
      <div className="notification-box-empty" data-testid="notification-empty">
        <p>{t('message.notifications-all-read')}</p>
      </div>
      <div className="notification-box-footer notification-box-footer-bordered">
        <Link data-testid="notification-view-all" to={ROUTES.NOTIFICATIONS}>
          {t('label.view-entity', {
            entity: t('label.all-lowercase'),
          })}
        </Link>
      </div>
    </>
  ) : (
    <List
      className="notification-content-container"
      dataSource={notificationDropDownList}
      footer={
        <div className="notification-box-footer">
          <Link data-testid="notification-view-all" to={ROUTES.NOTIFICATIONS}>
            {t('label.view-entity', {
              entity: t('label.all-lowercase'),
            })}
          </Link>
        </div>
      }
      itemLayout="vertical"
      renderItem={(item) => (
        <List.Item className="notification-dropdown-list-btn cursor-pointer">
          {item}
        </List.Item>
      )}
      size="small"
    />
  );

  return (
    <div className="notification-box">
      <div className="notification-box-header">
        <Typography.Title
          className="m-0 notification-box-heading"
          data-testid="notification-heading"
          level={5}>
          {t('label.notification-plural')}
        </Typography.Title>
        {!isEmpty(notifications) && (
          <Button
            className="notification-box-read-all"
            data-testid="notification-read-all"
            type="link"
            onClick={handleReadAll}>
            {t('label.notification-mark-all-read')}
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="h-64 d-flex items-center justify-center">
          <Loader size="small" />
        </div>
      ) : (
        notificationList
      )}
    </div>
  );
};

export default NotificationBox;
