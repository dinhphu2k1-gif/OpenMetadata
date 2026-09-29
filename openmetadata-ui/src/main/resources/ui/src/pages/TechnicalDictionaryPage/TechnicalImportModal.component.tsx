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
import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Radio, Space, Table, Tag, Upload } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  commitTechnicalImport,
  downloadTechnicalImportTemplate,
  previewTechnicalImport,
  TechnicalImportPolicy,
  TechnicalImportPreview,
  TechnicalImportPreviewRow,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

interface TechnicalImportModalProps {
  open: boolean;
  glossaryId: string;
  businessVersion: string;
  canCreateVersion: boolean;
  onClose: () => void;
  onDone: () => void;
}

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const TechnicalImportModal = ({
  open,
  glossaryId,
  businessVersion,
  canCreateVersion,
  onClose,
  onDone,
}: TechnicalImportModalProps) => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<TechnicalImportPolicy>('DRAFT_ONLY');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<TechnicalImportPreview>();
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPolicy('DRAFT_ONLY');
      setFile(undefined);
      setPreview(undefined);
    }
  }, [open]);

  const handleTemplate = async () => {
    try {
      saveBlob(
        await downloadTechnicalImportTemplate(),
        'Agribank_TuDienKyThuat_Import_Template.xlsx'
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      return;
    }
    setIsBusy(true);
    try {
      setPreview(
        await previewTechnicalImport(glossaryId, businessVersion, policy, file)
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) {
      return;
    }
    setIsBusy(true);
    try {
      const result = await commitTechnicalImport(preview.importSessionId);
      showSuccessToast(
        t('message.technical-import-committed', { count: result.committed })
      );
      onDone();
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
      setPreview(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const columns: ColumnsType<TechnicalImportPreviewRow> = [
    { title: t('label.row'), dataIndex: 'rowNumber', width: 80 },
    {
      title: t('label.action'),
      dataIndex: 'action',
      width: 220,
      render: (action: string) => <Tag>{action}</Tag>,
    },
    {
      title: t('label.detail-plural'),
      key: 'detail',
      render: (_, row) => (
        <>
          {row.errors.map((error) => (
            <div className="text-danger" key={`${error.column}-${error.code}`}>
              {error.column}: {error.message}
            </div>
          ))}
          {row.warnings.map((warning) => (
            <div className="text-warning" key={warning}>
              {warning}
            </div>
          ))}
        </>
      ),
    },
  ];

  return (
    <Modal
      destroyOnClose
      data-testid="technical-import-modal"
      footer={
        <Space>
          <Button onClick={onClose}>{t('label.close')}</Button>
          <Button
            data-testid="technical-import-preview"
            disabled={!file || isBusy}
            loading={isBusy && !preview}
            onClick={handlePreview}>
            {t('label.preview')}
          </Button>
          <Button
            data-testid="technical-import-commit"
            disabled={!preview?.canCommit || isBusy}
            loading={isBusy && preview !== undefined}
            type="primary"
            onClick={handleCommit}>
            {t('label.import')}
          </Button>
        </Space>
      }
      open={open}
      title={t('label.import-cde-mapping')}
      width={760}
      onCancel={onClose}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          message={t('message.technical-import-description')}
          type="info"
        />
        <Button
          data-testid="technical-import-template"
          onClick={handleTemplate}>
          {t('label.download-template')}
        </Button>
        <Radio.Group
          value={policy}
          onChange={(event) => {
            setPolicy(event.target.value);
            setPreview(undefined);
          }}>
          <Space direction="vertical">
            <Radio value="DRAFT_ONLY">
              {t('label.import-policy-draft-only')}
            </Radio>
            <Radio disabled={!canCreateVersion} value="ALL_EDITABLE">
              {t('label.import-policy-all-editable')}
            </Radio>
          </Space>
        </Radio.Group>
        <Upload.Dragger
          accept=".xlsx"
          beforeUpload={(selected) => {
            setFile(selected);
            setPreview(undefined);

            return false;
          }}
          maxCount={1}
          onRemove={() => {
            setFile(undefined);
            setPreview(undefined);
          }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {t('message.technical-import-upload')}
          </p>
        </Upload.Dragger>
        {preview && (
          <>
            <Space wrap data-testid="technical-import-summary">
              {Object.entries(preview.summary)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <Tag color={key === 'error' ? 'error' : undefined} key={key}>
                    {key}: {count}
                  </Tag>
                ))}
            </Space>
            {preview.truncated && (
              <Alert
                showIcon
                message={t('message.technical-import-truncated')}
                type="warning"
              />
            )}
            <Table
              columns={columns}
              dataSource={preview.rows}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowKey="rowNumber"
              size="small"
            />
          </>
        )}
      </Space>
    </Modal>
  );
};

export default TechnicalImportModal;
