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

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Button } from '@openmetadata/ui-core-components';
import {
  Alert,
  Divider,
  Form,
  Modal,
  Progress,
  Radio,
  Result,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-drag-drop.svg';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  CdeImportPreview,
  commitCdeImport,
  downloadCdeImportTemplate,
  previewCdeImport,
} from '../../../rest/glossaryAPI';
import { formatCDEDate } from '../../../utils/CDEDateUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import IngestionStepper from '../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import './cde-import-export.less';
import {
  CDEImportRowData,
  CDEValidationResult,
} from './CDEImportExport.utils';

const { Dragger } = Upload;

interface CDEImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  glossaryId: string;
  parentBusinessVersion: string;
}

type DuplicateHandling = 'skip' | 'update';

const CDEImportModal: FC<CDEImportModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  glossaryId,
  parentBusinessVersion,
}) => {
  const { t } = useTranslation();

  const [activeStep, setActiveStep] = useState<number>(0);

  const importSteps = useMemo(
    () => [
      { name: t('cde.step-upload', 'Tải file & Cấu hình'), step: 1 },
      { name: t('cde.step-validate', 'Thẩm định & Xem trước'), step: 2 },
      { name: t('cde.step-execute', 'Tiến trình & Kết quả'), step: 3 },
    ],
    [t]
  );

  const [duplicatePolicy] = useState<DuplicateHandling>('update');
  const [validationResult, setValidationResult] =
    useState<CDEValidationResult | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<'all' | 'error' | 'valid'>(
    'all'
  );

  const [serverPreview, setServerPreview] = useState<CdeImportPreview>();

  // Import Execution state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [currentImportName, setCurrentImportName] = useState<string>('');
  const [importStats, setImportStats] = useState<{
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  }>({ created: 0, updated: 0, skipped: 0, failed: 0 });
  const [importErrors, setImportErrors] = useState<
    { row: number; name: string; reason: string }[]
  >([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const resetState = () => {
    setActiveStep(0);
    setValidationResult(null);
    setSelectedFileName('');
    setTableFilter('all');
    setIsImporting(false);
    setImportProgress(0);
    setCurrentImportName('');
    setImportStats({ created: 0, updated: 0, skipped: 0, failed: 0 });
    setImportErrors([]);
    setIsCompleted(false);
    setServerPreview(undefined);
  };

  const handleClose = () => {
    if (isImporting) {
      return; // Đang chạy import không đóng để tránh gián đoạn
    }
    resetState();
    onCancel();
  };

  const handleDone = () => {
    try {
      onSuccess?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Lỗi khi gọi onSuccess callback:', err);
    } finally {
      handleClose();
    }
  };

  const handleFileChange = async (file: File) => {
    setParsing(true);
    setSelectedFileName(file.name);
    try {
      const preview = await previewCdeImport(
        glossaryId,
        parentBusinessVersion,
        duplicatePolicy === 'skip' ? 'SKIP_EXISTING' : 'OVERWRITE_EXISTING',
        file
      );
      setServerPreview(preview);
      const rows: CDEImportRowData[] = preview.rows.map((item) => {
        const payload = item.payload ?? {};
        const extension = (payload.extension ?? {}) as Record<string, string>;
        const errors = item.errors.map((error) => `${error.column}: ${error.message}`);
        return {
          rowNumber: item.rowNumber,
          name: item.cdeCode,
          displayName: String(payload.displayName ?? ''),
          domain: '',
          dataSource: '',
          description: String(payload.description ?? ''),
          entityRelationship: String(extension.entityRelationship ?? ''),
          owner: '',
          dataClassification: '',
          personalData: '',
          relatedRegulatoryDocuments: String(extension.relatedRegulatoryDocuments ?? ''),
          dataQualityRules: String(extension.dataQualityRules ?? ''),
          version: item.businessVersion ?? '',
          effectiveDate: extension.effectiveDate,
          expirationDate: extension.expirationDate,
          reviewer: '',
          status: EntityStatus.Draft,
          isExisting: item.action !== 'CREATE',
          existingId: undefined,
          errors,
          warnings: item.warnings,
          isValid: errors.length === 0,
        };
      });
      const result: CDEValidationResult = {
        totalRows: rows.length,
        validCount: rows.filter((row) => row.isValid && !row.warnings.length).length,
        warningCount: rows.filter((row) => row.isValid && row.warnings.length > 0).length,
        errorCount: rows.filter((row) => !row.isValid).length,
        rows,
      };
      setValidationResult(result);
      setActiveStep(1); // Chuyển sang bước 2 (Preview & Validate)
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setParsing(false);
    }
  };

  const filteredPreviewRows = useMemo(() => {
    if (!validationResult) {
      return [];
    }
    if (tableFilter === 'error') {
      return validationResult.rows.filter((r) => !r.isValid);
    }
    if (tableFilter === 'valid') {
      return validationResult.rows.filter((r) => r.isValid);
    }

    return validationResult.rows;
  }, [validationResult, tableFilter]);

  const inReviewReplacementCount = useMemo(
    () =>
      serverPreview?.rows.filter(
        (row) => row.action === 'REPLACE_IN_REVIEW_AND_REOPEN'
      ).length ?? 0,
    [serverPreview]
  );

  const handleStartImport = async () => {
    if (!validationResult || !serverPreview?.canCommit) {
      return;
    }

    setActiveStep(2);
    setIsImporting(true);
    setIsCompleted(false);

    setCurrentImportName(selectedFileName);
    try {
      await commitCdeImport(serverPreview.importSessionId);
      setImportProgress(100);
      setImportErrors([]);
      setImportStats({
        created: Number(serverPreview.summary.CREATE ?? 0),
        updated:
          Number(serverPreview.summary.CREATE_VERSION ?? 0) +
          Number(serverPreview.summary.UPDATE_DRAFT ?? 0) +
          Number(serverPreview.summary.REPLACE_IN_REVIEW_AND_REOPEN ?? 0) +
          Number(serverPreview.summary.REPLACE_REJECTED_AND_REOPEN ?? 0),
        skipped: 0,
        failed: 0,
      });
    } catch (error) {
      setImportErrors([{ row: 0, name: selectedFileName, reason: 'Preview đã hết hạn hoặc dữ liệu đã thay đổi. Vui lòng thẩm định lại file.' }]);
      setImportStats({ created: 0, updated: 0, skipped: 0, failed: 1 });
      showErrorToast(error as AxiosError);
    }
    setIsImporting(false);
    setIsCompleted(true);
  };

  const previewColumns: ColumnsType<CDEImportRowData> = [
    {
      title: 'Dòng',
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      width: 65,
      align: 'center',
    },
    {
      title: 'Mã CDE',
      dataIndex: 'name',
      key: 'name',
      width: 110,
      render: (name: string, record) => (
        <span
          className={
            record.errors.length ? 'text-danger font-semibold' : 'font-semibold'
          }>
          {name || '(Trống)'}
        </span>
      ),
    },
    {
      title: 'Tên thành tố CDE',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 170,
      ellipsis: true,
    },
    {
      title: 'Nhóm nghiệp vụ',
      dataIndex: 'domain',
      key: 'domain',
      width: 130,
      ellipsis: true,
    },
    {
      title: 'Nguồn dữ liệu',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('cde.version'),
      dataIndex: 'version',
      key: 'version',
      width: 120,
    },
    ...(['effectiveDate', 'expirationDate'] as const).map((key) => ({
      title: t(
        key === 'effectiveDate' ? 'cde.effective-date' : 'cde.expiration-date'
      ),
      dataIndex: key,
      key,
      width: 160,
      render: (value: string) => formatCDEDate(value),
    })),
    {
      title: 'Thao tác',
      key: 'actionType',
      width: 100,
      align: 'center',
      render: (_, record) =>
        record.isExisting ? (
          <Tag color="blue">
            {duplicatePolicy === 'update' ? 'Cập nhật' : 'Trùng mã'}
          </Tag>
        ) : (
          <Tag color="green">Tạo mới</Tag>
        ),
    },
    {
      title: 'Kết quả thẩm định',
      key: 'validationStatus',
      width: 150,
      render: (_, record) => {
        if (!record.isValid) {
          return (
            <Tooltip title={record.errors.join('; ')}>
              <Tag color="error" icon={<CloseCircleOutlined />}>
                Lỗi ({record.errors.length})
              </Tag>
            </Tooltip>
          );
        }
        if (record.warnings.length > 0) {
          return (
            <Tooltip title={record.warnings.join('; ')}>
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                Cảnh báo
              </Tag>
            </Tooltip>
          );
        }

        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Hợp lệ
          </Tag>
        );
      },
    },
  ];

  return (
    <Modal
      destroyOnClose
      className="cde-import-modal"
      closable={!isImporting}
      footer={null}
      maskClosable={false}
      open={visible}
      title={t(
        'cde.import-modal-title',
        'Nhập danh sách CDE từ file Excel (.xlsx)'
      )}
      width={activeStep === 1 ? 960 : 640}
      onCancel={handleClose}>
      {/* Stepper Header */}
      <div className="m-b-lg">
        <IngestionStepper activeStep={activeStep + 1} steps={importSteps} />
      </div>

      {/* BƯỚC 1: UPLOAD VÀ CẤU HÌNH */}
      {activeStep === 0 && (
        <div>
          <Alert
            showIcon
            className="m-b-md"
            message={
              <span>
                <strong>
                  {t('cde.rule-notice', 'Quy định quản trị dữ liệu')}:
                </strong>{' '}
                {t(
                  'cde.rule-notice-desc',
                  'Mọi bản ghi CDE nạp mới sẽ được khởi tạo ở trạng thái'
                )}{' '}
                <Tag color="orange">{t('label.draft', 'Bản nháp (Draft)')}</Tag>
                .{' '}
                {t(
                  'cde.rule-notice-maker',
                  'Sau khi nạp, người đề xuất có thể rà soát lại và bấm gửi phê duyệt sang Data Steward.'
                )}
              </span>
            }
            type="info"
          />

          <Dragger
            accept=".xlsx"
            beforeUpload={(file) => {
              handleFileChange(file);

              return false;
            }}
            className="file-dragger-wrapper m-b-md"
            disabled={parsing}
            multiple={false}
            showUploadList={false}>
            <Space
              align="center"
              className="w-full justify-center p-y-md"
              direction="vertical"
              size={16}>
              <ImportIcon height={72} width={72} />
              <Typography.Text>
                {parsing ? (
                  t('cde.parsing-file', 'Đang đọc và thẩm định file Excel...')
                ) : (
                  <span>
                    {t(
                      'cde.drag-drop-or-browse-excel',
                      'Kéo thả file Excel (.xlsx) vào đây, hoặc'
                    )}{' '}
                    <span className="browse-text font-medium">
                      {t('label.browse', 'chọn tệp')}
                    </span>
                  </span>
                )}
              </Typography.Text>
              <Typography.Text style={{ fontSize: 12 }} type="secondary">
                {t(
                  'cde.upload-hint',
                  'Hỗ trợ file Microsoft Excel (.xlsx). Dung lượng tối đa 5MB, tối đa 5.000 dòng.'
                )}
              </Typography.Text>
            </Space>
          </Dragger>

          <div className="d-flex justify-between items-center m-b-md">
            <Typography.Text type="secondary">
              {t(
                'cde.download-template-hint',
                'Chưa có file mẫu import CDE chuẩn?'
              )}
            </Typography.Text>
            <Button
              color="secondary"
              iconLeading={<DownloadOutlined />}
              size="sm"
              onPress={async () => {
                try {
                  const blob = await downloadCdeImportTemplate();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'Agribank_CDE_Import_Template.xlsx';
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  showErrorToast(error as AxiosError);
                }
              }}>
              {t('cde.download-template-btn', 'Tải file mẫu Excel')}
            </Button>
          </div>

          <Form layout="vertical">
            <Form.Item
              className="m-b-0"
              label={
                <Typography.Text strong>
                  {t(
                    'cde.duplicate-policy-label',
                    'Xử lý khi phát hiện Mã CDE đã tồn tại:'
                  )}
                </Typography.Text>
              }>
              <Radio.Group value={duplicatePolicy}>
                <Space direction="vertical" size="small">
                  <Radio checked value="update">
                    <Typography.Text>
                      <strong>
                        {t('label.update', 'Ghi đè / Cập nhật (Update)')}
                      </strong>{' '}
                      -{' '}
                      {t(
                        'cde.update-desc',
                        'Cập nhật nội dung mới và chuyển về trạng thái Bản nháp'
                      )}
                    </Typography.Text>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          </Form>
        </div>
      )}

      {/* BƯỚC 2: PREVIEW VÀ VALIDATE */}
      {activeStep === 1 && validationResult && (
        <div>
          {inReviewReplacementCount > 0 && (
            <Alert
              showIcon
              className="m-b-md"
              message={`${inReviewReplacementCount} CDE đang chờ duyệt sẽ bị hủy duyệt và chuyển về Draft.`}
              type="warning"
            />
          )}
          {/* Thanh thông tin và bộ lọc xem trước */}
          <div className="d-flex justify-between items-center m-b-md">
            <Space size="middle">
              <Typography.Text type="secondary">
                {t('label.file', 'Tệp')}:{' '}
                <Typography.Text strong>{selectedFileName}</Typography.Text>
              </Typography.Text>
              <Divider type="vertical" />
              <Typography.Text>
                {t('label.total', 'Tổng số')}:{' '}
                <Typography.Text strong>
                  {validationResult.totalRows}
                </Typography.Text>
              </Typography.Text>
              <Typography.Text type="success">
                {t('label.valid', 'Hợp lệ')}:{' '}
                <Typography.Text strong>
                  {validationResult.validCount}
                </Typography.Text>
              </Typography.Text>
              {validationResult.warningCount > 0 && (
                <Typography.Text type="warning">
                  {t('label.warning', 'Cảnh báo')}:{' '}
                  <Typography.Text strong>
                    {validationResult.warningCount}
                  </Typography.Text>
                </Typography.Text>
              )}
              {validationResult.errorCount > 0 && (
                <Typography.Text type="danger">
                  {t('label.error', 'Lỗi')}:{' '}
                  <Typography.Text strong>
                    {validationResult.errorCount}
                  </Typography.Text>
                </Typography.Text>
              )}
            </Space>

            <Radio.Group
              size="small"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}>
              <Radio.Button value="all">
                {t('label.all', 'Tất cả')} ({validationResult.totalRows})
              </Radio.Button>
              <Radio.Button value="valid">
                {t('label.valid', 'Hợp lệ')} (
                {validationResult.validCount + validationResult.warningCount})
              </Radio.Button>
              {validationResult.errorCount > 0 && (
                <Radio.Button value="error">
                  {t('label.error', 'Dòng lỗi')} ({validationResult.errorCount})
                </Radio.Button>
              )}
            </Radio.Group>
          </div>

          {/* Bảng xem trước dữ liệu */}
          <Table
            bordered
            columns={previewColumns}
            dataSource={filteredPreviewRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            rowKey="rowNumber"
            scroll={{ y: 280 }}
            size="small"
          />

          {validationResult.errorCount > 0 && (
            <Alert
              showIcon
              className="m-t-sm"
              message={t(
                'cde.error-skip-notice',
                'Có {{count}} dòng bị lỗi. Import nguyên tử bị khóa cho đến khi toàn bộ file hợp lệ.',
                {
                  count: validationResult.errorCount,
                  validCount:
                    validationResult.validCount + validationResult.warningCount,
                }
              )}
              type="warning"
            />
          )}

          <div className="d-flex justify-between items-center m-t-md">
            <Button color="secondary" onPress={() => setActiveStep(0)}>
              {t('label.back', 'Chọn file khác')}
            </Button>
            <Button
              color="primary"
              data-testid="commit-cde-import"
              isDisabled={
                validationResult.errorCount > 0 ||
                validationResult.validCount + validationResult.warningCount === 0
              }
              onPress={handleStartImport}>
              {t(
                'cde.start-import-btn',
                'Bắt đầu nạp dữ liệu ({{count}} bản ghi)',
                {
                  count:
                    validationResult.validCount + validationResult.warningCount,
                }
              )}
            </Button>
          </div>
        </div>
      )}

      {/* BƯỚC 3: TIẾN TRÌNH VÀ KẾT QUẢ */}
      {activeStep === 2 && (
        <div className="cde-progress-step">
          {!isCompleted ? (
            <div className="progress-box">
              <Typography.Title className="m-b-md" level={5}>
                {t('cde.importing-title', 'Đang nạp dữ liệu CDE...')}
              </Typography.Title>
              <Progress percent={importProgress} status="active" />
              <Typography.Text className="d-block m-t-sm" type="secondary">
                {t('label.processing', 'Đang xử lý')}:{' '}
                <strong>{currentImportName}</strong>
              </Typography.Text>
            </div>
          ) : (
            <Result
              extra={[
                <Button color="primary" key="done" onPress={handleDone}>
                  {t('cde.close-and-view-list', 'Đóng & Xem danh sách CDE')}
                </Button>,
                <Button color="secondary" key="another" onPress={resetState}>
                  {t('cde.import-another-file', 'Nạp tiếp file khác')}
                </Button>,
              ]}
              status={importStats.failed > 0 ? 'warning' : 'success'}
              subTitle={
                <Space className="w-full" direction="vertical" size="small">
                  <div>
                    {t(
                      'cde.import-success-msg',
                      'Đã tạo mới thành công {{count}} bản ghi CDE ở trạng thái',
                      { count: importStats.created }
                    )}{' '}
                    <Tag color="orange">
                      {t('label.draft', 'Bản nháp (Draft)')}
                    </Tag>
                    .
                  </div>
                  {importStats.updated > 0 && (
                    <div>
                      {t(
                        'cde.import-updated-msg',
                        'Đã cập nhật {{count}} bản ghi CDE có sẵn.',
                        { count: importStats.updated }
                      )}
                    </div>
                  )}
                  {importStats.skipped > 0 && (
                    <Typography.Text type="secondary">
                      {t(
                        'cde.import-skipped-msg',
                        'Đã bỏ qua {{count}} bản ghi do trùng mã.',
                        { count: importStats.skipped }
                      )}
                    </Typography.Text>
                  )}
                  {importStats.failed > 0 && (
                    <Typography.Text type="danger">
                      {t(
                        'cde.import-failed-msg',
                        'Thất bại {{count}} bản ghi do lỗi kết nối hoặc quyền hạn.',
                        { count: importStats.failed }
                      )}
                    </Typography.Text>
                  )}
                  {importErrors.length > 0 && (
                    <Alert
                      showIcon
                      className="m-t-sm text-left"
                      description={
                        <ul
                          className="p-l-md m-b-0"
                          style={{ maxHeight: '120px', overflowY: 'auto' }}>
                          {importErrors.map((err, idx) => (
                            <li key={idx}>
                              <strong>
                                {err.name
                                  ? t(
                                      'label.row-with-name',
                                      'Dòng {{row}} ({{name}})',
                                      {
                                        row: err.row,
                                        name: err.name,
                                      }
                                    )
                                  : t('label.row-index', 'Dòng {{row}}', {
                                      row: err.row,
                                    })}
                              </strong>
                              : {err.reason}
                            </li>
                          ))}
                        </ul>
                      }
                      message={t('label.failure-reason', 'Lý do lỗi')}
                      type="error"
                    />
                  )}
                </Space>
              }
              title={t(
                'cde.import-completed-title',
                'Hoàn tất nạp dữ liệu CDE!'
              )}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default CDEImportModal;
