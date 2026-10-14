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
import { Card, Col, Progress, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { GovernedImportProgressProps } from './GovernedImport.interface';

/** Shown while the validated rows of a governed import are written. */
const GovernedImportProgress = ({
  title,
  percent,
  currentName,
}: GovernedImportProgressProps) => {
  const { t } = useTranslation();

  return (
    <Col span={24}>
      <Card
        className="text-center p-y-lg m-t-md"
        data-testid="governed-import-progress">
        <Space
          align="center"
          className="w-full justify-center"
          direction="vertical"
          size={20}>
          <Typography.Title level={4}>{title}</Typography.Title>
          <div className="governed-import-progress-bar">
            <Progress percent={percent} status="active" />
          </div>
          {currentName && (
            <Typography.Text type="secondary">
              {t('label.processing')}: <strong>{currentName}</strong>
            </Typography.Text>
          )}
        </Space>
      </Card>
    </Col>
  );
};

export default GovernedImportProgress;
