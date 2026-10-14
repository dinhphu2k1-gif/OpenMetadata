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
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button } from '@openmetadata/ui-core-components';
import { Modal } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import './bulk-action-result-modal.less';
import { BulkActionResultModalProps } from './BulkActionResultModal.interface';

/** Outcome of a bulk approve / reject / submit: one line per record, the failed ones with their reason. */
const BulkActionResultModal = ({
  open,
  title,
  description,
  items,
  succeededLabel,
  testId = 'bulk-action-result',
  onClose,
}: BulkActionResultModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      destroyOnClose
      className="bulk-action-result-modal"
      data-testid={testId}
      footer={[
        <Button
          color="secondary"
          data-testid={`${testId}-close`}
          key="close"
          onPress={onClose}>
          {t('label.close')}
        </Button>,
      ]}
      open={open}
      title={<span data-testid={`${testId}-title`}>{title}</span>}
      width={520}
      onCancel={onClose}>
      {description && (
        <p className="bulk-action-result-description">{description}</p>
      )}
      <ul
        aria-label={t('label.bulk-action-result-list')}
        className="bulk-action-result-list"
        data-testid={`${testId}-list`}>
        {items.map((item) => (
          <li
            className={classNames('bulk-action-result-item', {
              'bulk-action-result-item--failed': !item.succeeded,
            })}
            data-testid={`${testId}-${item.name}`}
            key={item.key}>
            <span
              className={classNames('bulk-action-result-icon', {
                'bulk-action-result-icon--failed': !item.succeeded,
              })}>
              {item.succeeded ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )}
            </span>
            <div className="bulk-action-result-main">
              <span>
                <strong>{item.name}</strong>
                {item.detail && (
                  <span className="bulk-action-result-detail">
                    {` (${item.detail})`}
                  </span>
                )}
              </span>
              <span
                className={classNames('bulk-action-result-text', {
                  'bulk-action-result-text--failed': !item.succeeded,
                })}>
                {item.succeeded ? succeededLabel : item.message}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default BulkActionResultModal;
