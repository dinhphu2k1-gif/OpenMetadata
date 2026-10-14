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
import { Col, Segmented } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FailBadgeIcon } from '../../../assets/svg/fail-badge.svg';
import { ReactComponent as SuccessBadgeIcon } from '../../../assets/svg/success-badge.svg';
import {
  GovernedImportStatusFilter,
  GovernedImportValidationHeaderProps,
} from './GovernedImport.interface';

/** Validation summary of a governed import, with the filter over all / failed / valid rows. */
const GovernedImportValidationHeader = ({
  failed,
  passed,
  total,
  filter,
  onFilterChange,
}: GovernedImportValidationHeaderProps) => {
  const { t } = useTranslation();
  const hasErrors = failed > 0;

  return (
    <Col span={24}>
      <div className="governed-import-validation-header d-flex justify-between items-center w-full flex-wrap gap-2">
        <div
          className={classNames('governed-import-validation-summary', {
            'has-error': hasErrors,
            'is-success': !hasErrors,
          })}
          data-testid="governed-import-validation-summary">
          {hasErrors ? (
            <FailBadgeIcon height={16} width={16} />
          ) : (
            <SuccessBadgeIcon height={16} width={16} />
          )}
          <span>
            {hasErrors
              ? t('cde.validation-has-errors', { count: failed })
              : t('cde.validation-all-valid', { count: passed })}
          </span>
        </div>
        <Segmented
          className="governed-import-status-filter"
          data-testid="status-filter-group"
          options={[
            {
              label: (
                <span className="filter-item">
                  <span>{t('label.all')}</span>
                  <span className="filter-count" data-testid="processed-row">
                    {total}
                  </span>
                </span>
              ),
              value: 'all',
            },
            {
              label: (
                <span className="filter-item">
                  <span className="filter-status-dot dot-error" />
                  <span>{t('label.errors-only')}</span>
                  <span
                    className={classNames('filter-count', {
                      'filter-count-error': failed > 0,
                    })}
                    data-testid="failed-row">
                    {failed}
                  </span>
                </span>
              ),
              value: 'failure',
            },
            {
              label: (
                <span className="filter-item">
                  <span className="filter-status-dot dot-success" />
                  <span>{t('label.valid')}</span>
                  <span
                    className={classNames('filter-count', {
                      'filter-count-success': passed > 0,
                    })}
                    data-testid="passed-row">
                    {passed}
                  </span>
                </span>
              ),
              value: 'success',
            },
          ]}
          value={filter}
          onChange={(value) =>
            onFilterChange(value as GovernedImportStatusFilter)
          }
        />
      </div>
    </Col>
  );
};

export default GovernedImportValidationHeader;
