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
import {
  Alert,
  Button,
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
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-drag-drop.svg';
import { Tag as ClassificationTag } from '../../../generated/entity/classification/tag';
import { EntityStatus, GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { getDomainList } from '../../../rest/domainAPI';
import { addGlossaryTerm, patchGlossaryTerm } from '../../../rest/glossaryAPI';
import { getTags } from '../../../rest/tagAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import IngestionStepper from '../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab/GlossaryTermTab.interface';
import './cde-import-export.less';
import {
  CDEImportRowData,
  CDEValidationResult,
  downloadCDEExcelTemplate,
  formatCDEImportErrorMessage,
  readAndValidateCDEExcel,
  transformRowToGlossaryTermPayload,
} from './CDEImportExport.utils';

const { Dragger } = Upload;

interface CDEImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  glossaryFQN: string;
  existingTerms: (ModifiedGlossaryTerm | GlossaryTerm)[];
  availableDomains?: EntityReference[];
}

type DuplicateHandling = 'skip' | 'update';

const CDEImportModal: FC<CDEImportModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  glossaryFQN,
  existingTerms,
  availableDomains = [],
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

  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicateHandling>('skip');
  const [validationResult, setValidationResult] = useState<CDEValidationResult | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<'all' | 'error' | 'valid'>('all');

  // Dynamic Metadata
  const [allDomains, setAllDomains] = useState<EntityReference[]>(availableDomains);
  const [allTags, setAllTags] = useState<ClassificationTag[]>([]);

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

  useEffect(() => {
    if (visible) {
      getDomainList({ limit: 100 })
        .then((res) => {
          if (res?.data?.length) {
            setAllDomains(
              res.data.map((d) => ({
                id: d.id,
                type: 'domain',
                name: d.name,
                displayName: d.displayName,
                fullyQualifiedName: d.fullyQualifiedName,
              }))
            );
          }
        })
        .catch(() => {
          // Bỏ qua lỗi, dùng availableDomains và fallback maps
        });

      getTags({ limit: 200 })
        .then((res) => {
          if (res?.data?.length) {
            setAllTags(res.data);
          }
        })
        .catch(() => {
          // Bỏ qua lỗi, dùng fallback maps
        });
    }
  }, [visible]);

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
      const result = await readAndValidateCDEExcel(file, existingTerms);
      setValidationResult(result);
      setActiveStep(1); // Chuyển sang bước 2 (Preview & Validate)
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error : new Error(t('cde.file-parse-error', 'Lỗi phân tích file Excel'))
      );
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

  const handleStartImport = async () => {
    if (!validationResult) {
      return;
    }

    setActiveStep(2);
    setIsImporting(true);
    setIsCompleted(false);

    const importableRows = validationResult.rows.filter((r) => r.isValid);
    const total = importableRows.length;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const errorsList: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < total; i++) {
      const row = importableRows[i];
      setCurrentImportName(row.name);
      setImportProgress(Math.round(((i + 1) / total) * 100));

      if (row.isExisting) {
        if (duplicatePolicy === 'skip') {
          skippedCount++;
          continue;
        }

        // Cập nhật bản ghi có sẵn
        if (row.existingId) {
          try {
            const patchOps = [
              { op: 'replace', path: '/displayName', value: row.displayName },
              { op: 'replace', path: '/description', value: row.description || '' },
              {
                op: 'replace',
                path: '/extension',
                value: {
                  cdeVersion: row.cdeVersion || '1.0',
                  ...(row.entityRelationship ? { entityRelationship: row.entityRelationship } : {}),
                  ...(row.relatedRegulatoryDocuments
                    ? { relatedRegulatoryDocuments: row.relatedRegulatoryDocuments }
                    : {}),
                  ...(row.dataQualityRules
                    ? {
                        dataQualityRules: ['CO', 'CÓ', 'YES', 'TRUE', '1'].includes(
                          row.dataQualityRules.toUpperCase()
                        )
                          ? ['Y']
                          : ['N'],
                      }
                    : {}),
                },
              },
              // Luôn đặt về trạng thái Bản nháp (Draft) theo đúng quy tắc nghiệp vụ
              { op: 'replace', path: '/entityStatus', value: EntityStatus.Draft },
            ];

            await patchGlossaryTerm(row.existingId, patchOps);
            updatedCount++;
          } catch (error: any) {
            failedCount++;
            errorsList.push({
              row: row.rowNumber,
              name: row.name,
              reason: formatCDEImportErrorMessage(error, t, 'update'),
            });
          }
        }
      } else {
        // Tạo mới bản ghi
        try {
          const payload = transformRowToGlossaryTermPayload(
            row,
            glossaryFQN,
            allDomains.length ? allDomains : availableDomains,
            allTags
          );

          const newTerm = await addGlossaryTerm(payload);
          // Đảm bảo chắc chắn trạng thái là Draft (Bản nháp)
          if (newTerm && newTerm.entityStatus !== EntityStatus.Draft) {
            try {
              await patchGlossaryTerm(newTerm.id, [
                { op: 'replace', path: '/entityStatus', value: EntityStatus.Draft },
              ]);
            } catch (patchErr) {
              // Non-blocking: term already created
            }
          }
          createdCount++;
        } catch (error: any) {
          failedCount++;
          errorsList.push({
            row: row.rowNumber,
            name: row.name,
            reason: formatCDEImportErrorMessage(error, t, 'create'),
          });
        }
      }
    }

    setImportErrors(errorsList);

    setImportStats({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
    });
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
        <span className={record.errors.length ? 'text-danger font-semibold' : 'font-semibold'}>
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
      title: 'Thao tác',
      key: 'actionType',
      width: 100,
      align: 'center',
      render: (_, record) =>
        record.isExisting ? (
          <Tag color="blue">{duplicatePolicy === 'update' ? 'Cập nhật' : 'Trùng mã'}</Tag>
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
      title={t('cde.import-modal-title', 'Nhập danh sách CDE từ file Excel (.xlsx)')}
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
                <strong>{t('cde.rule-notice', 'Quy định quản trị dữ liệu')}:</strong>{' '}
                {t(
                  'cde.rule-notice-desc',
                  'Mọi bản ghi CDE nạp mới sẽ được khởi tạo ở trạng thái'
                )}{' '}
                <Tag color="orange">{t('label.draft', 'Bản nháp (Draft)')}</Tag>.{' '}
                {t(
                  'cde.rule-notice-maker',
                  'Sau khi nạp, người đề xuất có thể rà soát lại và bấm gửi phê duyệt sang Data Steward.'
                )}
              </span>
            }
            type="info"
          />

          <Dragger
            accept=".xlsx,.xls,.csv"
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
                    <span className="browse-text font-medium">{t('label.browse', 'chọn tệp')}</span>
                  </span>
                )}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t(
                  'cde.upload-hint',
                  'Hỗ trợ file Microsoft Excel (.xlsx, .xls) hoặc CSV mã hóa UTF-8. Dung lượng tối đa 10MB.'
                )}
              </Typography.Text>
            </Space>
          </Dragger>

          <div className="d-flex justify-between items-center m-b-md">
            <Typography.Text type="secondary">
              {t('cde.download-template-hint', 'Chưa có file mẫu chuẩn 13 cột thuộc tính?')}
            </Typography.Text>
            <Button
              icon={<DownloadOutlined />}
              size="small"
              type="default"
              onClick={downloadCDEExcelTemplate}>
              {t('cde.download-template-btn', 'Tải file mẫu Excel')}
            </Button>
          </div>

          <Form layout="vertical">
            <Form.Item
              className="m-b-0"
              label={
                <Typography.Text strong>
                  {t('cde.duplicate-policy-label', 'Xử lý khi phát hiện Mã CDE đã tồn tại:')}
                </Typography.Text>
              }>
              <Radio.Group
                value={duplicatePolicy}
                onChange={(e) => setDuplicatePolicy(e.target.value)}>
                <Space direction="vertical" size="small">
                  <Radio value="skip">
                    <Typography.Text>
                      <strong>{t('label.skip', 'Bỏ qua (Skip)')}</strong> - {t('cde.skip-desc', 'Giữ nguyên CDE hiện tại, không cập nhật')}
                    </Typography.Text>
                  </Radio>
                  <Radio value="update">
                    <Typography.Text>
                      <strong>{t('label.update', 'Ghi đè / Cập nhật (Update)')}</strong> - {t('cde.update-desc', 'Cập nhật nội dung mới và chuyển về trạng thái Bản nháp')}
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
          {/* Thanh thông tin và bộ lọc xem trước */}
          <div className="d-flex justify-between items-center m-b-md">
            <Space size="middle">
              <Typography.Text type="secondary">
                {t('label.file', 'Tệp')}: <Typography.Text strong>{selectedFileName}</Typography.Text>
              </Typography.Text>
              <Divider type="vertical" />
              <Typography.Text>
                {t('label.total', 'Tổng số')}: <Typography.Text strong>{validationResult.totalRows}</Typography.Text>
              </Typography.Text>
              <Typography.Text type="success">
                {t('label.valid', 'Hợp lệ')}: <Typography.Text strong>{validationResult.validCount}</Typography.Text>
              </Typography.Text>
              {validationResult.warningCount > 0 && (
                <Typography.Text type="warning">
                  {t('label.warning', 'Cảnh báo')}: <Typography.Text strong>{validationResult.warningCount}</Typography.Text>
                </Typography.Text>
              )}
              {validationResult.errorCount > 0 && (
                <Typography.Text type="danger">
                  {t('label.error', 'Lỗi')}: <Typography.Text strong>{validationResult.errorCount}</Typography.Text>
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
                {t('label.valid', 'Hợp lệ')} ({validationResult.validCount + validationResult.warningCount})
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
                'Có {{count}} dòng bị lỗi sẽ bị bỏ qua. Hệ thống chỉ nạp {{validCount}} dòng hợp lệ.',
                {
                  count: validationResult.errorCount,
                  validCount: validationResult.validCount + validationResult.warningCount,
                }
              )}
              type="warning"
            />
          )}

          <div className="d-flex justify-between items-center m-t-md">
            <Button onClick={() => setActiveStep(0)}>{t('label.back', 'Chọn file khác')}</Button>
            <Button
              disabled={validationResult.validCount + validationResult.warningCount === 0}
              type="primary"
              onClick={handleStartImport}>
              {t('cde.start-import-btn', 'Bắt đầu nạp dữ liệu ({{count}} bản ghi)', {
                count: validationResult.validCount + validationResult.warningCount,
              })}
            </Button>
          </div>
        </div>
      )}

      {/* BƯỚC 3: TIẾN TRÌNH VÀ KẾT QUẢ */}
      {activeStep === 2 && (
        <div className="cde-progress-step">
          {!isCompleted ? (
            <div className="progress-box">
              <Typography.Title level={5} className="m-b-md">
                {t('cde.importing-title', 'Đang nạp dữ liệu CDE...')}
              </Typography.Title>
              <Progress percent={importProgress} status="active" />
              <Typography.Text type="secondary" className="d-block m-t-sm">
                {t('label.processing', 'Đang xử lý')}: <strong>{currentImportName}</strong>
              </Typography.Text>
            </div>
          ) : (
            <Result
              status={importStats.failed > 0 ? 'warning' : 'success'}
              subTitle={
                <Space direction="vertical" size="small" className="w-full">
                  <div>
                    {t(
                      'cde.import-success-msg',
                      'Đã tạo mới thành công {{count}} bản ghi CDE ở trạng thái',
                      { count: importStats.created }
                    )}{' '}
                    <Tag color="orange">{t('label.draft', 'Bản nháp (Draft)')}</Tag>.
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
                              : {formatCDEImportErrorMessage(err.reason, t)}
                            </li>
                          ))}
                        </ul>
                      }
                      message={t('label.failure-reason', 'Lý do lỗi')}
                      showIcon
                      type="error"
                    />
                  )}
                </Space>
              }
              title={t('cde.import-completed-title', 'Hoàn tất nạp dữ liệu CDE!')}
              extra={[
                <Button
                  key="done"
                  type="primary"
                  onClick={handleDone}>
                  {t('cde.close-and-view-list', 'Đóng & Xem danh sách CDE')}
                </Button>,
                <Button key="another" onClick={resetState}>
                  {t('cde.import-another-file', 'Nạp tiếp file khác')}
                </Button>,
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default CDEImportModal;
