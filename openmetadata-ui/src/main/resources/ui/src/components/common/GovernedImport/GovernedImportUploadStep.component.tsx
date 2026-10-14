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
import { DownloadOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space, Typography, Upload } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-drag-drop.svg';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { GovernedImportUploadStepProps } from './GovernedImport.interface';

/** First step of a governed import: drop the Excel file, pick the options, get the template. */
const GovernedImportUploadStep = ({
  notice,
  options,
  accept = '.xlsx,.xls',
  isDisabled = false,
  isParsing = false,
  testId = 'governed-import-dragger',
  templateTestId = 'governed-import-template',
  onFileSelect,
  onDownloadTemplate,
  onCancel,
}: GovernedImportUploadStepProps) => {
  const { t } = useTranslation();

  return (
    <Col span={24}>
      <Space className="w-full" direction="vertical" size={16}>
        {notice}
        <Upload.Dragger
          accept={accept}
          beforeUpload={onFileSelect}
          className="file-dragger-wrapper"
          data-testid={testId}
          disabled={isDisabled || isParsing}
          multiple={false}
          showUploadList={false}>
          <Space
            align="center"
            className="w-full justify-center governed-import-drop-area"
            direction="vertical"
            size={36}>
            <ImportIcon height={86} width={86} />
            <Typography.Text>
              {isParsing ? (
                t('cde.parsing-file')
              ) : (
                <Transi18next
                  i18nKey="message.drag-and-drop-or-browse-excel-file-here"
                  renderElement={<span className="browse-text" />}
                  values={{ text: t('label.browse') }}
                />
              )}
            </Typography.Text>
          </Space>
        </Upload.Dragger>
        <Row align="top" gutter={[16, 16]} justify="space-between">
          <Col md={18} xs={24}>
            {options}
          </Col>
          <Col className="text-right" md={6} xs={24}>
            <Button
              data-testid={templateTestId}
              icon={<DownloadOutlined />}
              type="link"
              onClick={onDownloadTemplate}>
              {t('label.download-excel-template')}
            </Button>
          </Col>
        </Row>
        {onCancel && (
          <div className="p-b-md">
            <Button onClick={onCancel}>{t('label.cancel')}</Button>
          </div>
        )}
      </Space>
    </Col>
  );
};

export default GovernedImportUploadStep;
