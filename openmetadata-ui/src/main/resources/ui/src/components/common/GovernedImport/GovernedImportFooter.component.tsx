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
import { Button, Col, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { GovernedImportFooterProps } from './GovernedImport.interface';

/** Bottom bar of the edit and validation steps: add a row on the left, back and next on the right. */
const GovernedImportFooter = ({
  onAddRow,
  isBackDisabled = false,
  primary,
  onBack,
}: GovernedImportFooterProps) => {
  const { t } = useTranslation();

  return (
    <Col span={24}>
      <div className="governed-import-footer">
        {onAddRow ? (
          <Button data-testid="add-row-btn" onClick={onAddRow}>
            {`+ ${t('label.add-row')}`}
          </Button>
        ) : (
          <div />
        )}
        <Space size={12}>
          <Button disabled={isBackDisabled} onClick={onBack}>
            {t('label.previous')}
          </Button>
          <Button
            className="governed-import-action-btn"
            data-testid={primary.testId}
            disabled={primary.isDisabled}
            loading={primary.isLoading}
            type="primary"
            onClick={primary.onClick}>
            {primary.label}
          </Button>
        </Space>
      </div>
    </Col>
  );
};

export default GovernedImportFooter;
