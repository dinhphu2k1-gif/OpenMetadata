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
import { useTranslation } from 'react-i18next';
import { TechnicalBulkResultItem } from './technicalDictionary.interface';
import { getTechnicalRecordPath } from './TechnicalDictionaryRows';
import {
  TechnicalReviewAction,
  TECHNICAL_REVIEW_ACTIONS,
} from './technicalReviewActions';

interface TechnicalBulkResultModalProps {
  open: boolean;
  action: TechnicalReviewAction;
  items: TechnicalBulkResultItem[];
  onClose: () => void;
}

/** Shown after a bulk action in which at least one record could not be processed. */
const TechnicalBulkResultModal = ({
  open,
  action,
  items,
  onClose,
}: TechnicalBulkResultModalProps) => {
  const { t } = useTranslation();
  const config = TECHNICAL_REVIEW_ACTIONS[action];
  const succeeded = items.filter(
    (item) => item.outcome.outcome === 'SUCCEEDED'
  ).length;

  return (
    <Modal
      centered
      destroyOnClose
      className="tech-review-modal"
      data-testid="technical-bulk-result"
      footer={[
        <Button
          color="secondary"
          data-testid="technical-bulk-result-close"
          key="close"
          onPress={onClose}>
          {t('label.close')}
        </Button>,
      ]}
      open={open}
      title={
        <span data-testid="technical-bulk-result-title">
          {t(config.resultTitleKey, { succeeded, total: items.length })}
        </span>
      }
      width={520}
      onCancel={onClose}>
      <p className="tech-review-description">
        {t(config.resultDescriptionKey)}
      </p>
      <ul
        aria-label={t('label.technical-record-results')}
        className="tech-review-list"
        data-testid="technical-bulk-result-list">
        {items.map(({ row, outcome }) => {
          const isSucceeded = outcome.outcome === 'SUCCEEDED';

          return (
            <li
              className={`tech-review-item tech-review-result ${
                isSucceeded ? '' : 'tech-review-result--failed'
              }`}
              data-testid={`technical-bulk-result-${row.columnName}`}
              key={row.key}>
              <span
                className={
                  isSucceeded
                    ? 'tech-review-result-icon tech-review-result-icon--ok'
                    : 'tech-review-result-icon tech-review-result-icon--failed'
                }>
                {isSucceeded ? (
                  <CheckCircleOutlined />
                ) : (
                  <CloseCircleOutlined />
                )}
              </span>
              <div className="tech-review-item-main">
                <span>
                  <strong>{row.columnName}</strong>
                  <span className="tech-review-item-path">
                    {` (${getTechnicalRecordPath(row)})`}
                  </span>
                </span>
                <span
                  className={
                    isSucceeded
                      ? 'tech-review-result-text tech-review-result-text--ok'
                      : 'tech-review-result-text tech-review-result-text--failed'
                  }>
                  {isSucceeded ? t(config.succeededKey) : outcome.message}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};

export default TechnicalBulkResultModal;
