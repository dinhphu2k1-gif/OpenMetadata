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

import { List, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { Thread } from '../../generated/entity/feed/thread';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getNotifications } from '../../rest/feedsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import './notification-box.less';
import { NOTIFICATION_LIST_SIZE } from './NotificationBox.utils';
import NotificationItem from './NotificationItem.component';
import { readNotificationSeenAt } from './NotificationSeen';

/** The reader's tasks and mentions in one list, as a single notification inbox. */
const NotificationBox = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [notifications, setNotifications] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [seenAt] = useState<number>(() =>
    readNotificationSeenAt(currentUser?.id)
  );
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data } = await getNotifications({
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

  const notificationDropDownList = notifications.map((thread) => (
    <NotificationItem key={thread.id} seenAt={seenAt} thread={thread} />
  ));

  const notificationList = isEmpty(notifications) ? (
    <div className="h-64 flex-center">
      <p>{t('message.no-notification-found')}</p>
    </div>
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
      <Typography.Title
        className="p-x-md p-t-sm p-b-xss notification-box-heading"
        data-testid="notification-heading"
        level={5}>
        {t('label.notification-plural')}
      </Typography.Title>
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
