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
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BellIcon } from '../../assets/svg/ic-alert-bell.svg';
import NotificationInbox from '../../components/NotificationBox/NotificationInbox/NotificationInbox.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import '../TechnicalDictionaryPage/technicalDictionary.less';

/** The user's whole notification inbox, the destination of the bell's "view all". */
const NotificationsPage: FC = () => {
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);

  const handleUnreadChange = useCallback((count: number) => {
    setUnread(count);
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.notification-plural')}>
      <div className="tech-dict-page-container">
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
        <NotificationInbox onUnreadChange={handleUnreadChange} />
      </div>
    </PageLayoutV1>
  );
};

export default NotificationsPage;
