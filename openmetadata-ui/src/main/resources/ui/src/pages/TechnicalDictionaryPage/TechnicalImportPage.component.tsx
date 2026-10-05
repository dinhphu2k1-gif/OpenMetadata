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
import {
  Alert,
  Button,
  Card,
  Col,
  Result,
  Row,
  Segmented,
  Space,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import DataGrid, { Column, textEditor } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-drag-drop.svg';
import { ReactComponent as SuccessBadgeIcon } from '../../assets/svg/success-badge.svg';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import Stepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import '../../components/UploadFile/upload-file.less';
import { VALIDATION_STEP } from '../../constants/BulkImport.constant';
import { ROUTES } from '../../constants/constants';
import { useGridEditController } from '../../hooks/useGridEditController';
import { useTechnicalDictionaryContext } from '../../hooks/useTechnicalDictionaryContext';
import {
  commitTechnicalImport,
  downloadTechnicalImportTemplate,
  previewTechnicalImport,
  TechnicalImportPreview,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import '../CDEImportPage/cde-import-page.less';

type GridRow = Record<string, string>;
type StatusFilter = 'all' | 'failure' | 'success';

const CREATE_RECORD_ACTION = 'CREATE_RECORD';
const UPDATE_ACTION = 'UPDATE';
const FIRST_DATA_ROW_NUMBER = 2;
const SHEET_NAME = 'Import Technical Dictionary';
const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const cellKey = (index: number) => `col-${index}`;

const isBlankRow = (row: GridRow, headers: string[]) =>
  headers.every((_, index) => !(row[cellKey(index)] ?? '').trim());

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Reads the first sheet as a header row plus data rows. */
const readSheet = async (file: File) => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const values = XLSX.utils.sheet_to_json<string[]>(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, defval: '', raw: false }
  );
  const headers = (values[0] ?? []).map((value) => String(value).trim());
  const rows = values
    .slice(1)
    .filter((cells) => cells.some((cell) => String(cell).trim() !== ''))
    .map((cells, index) => {
      const row: GridRow = { id: `${index + 1}` };
      headers.forEach((_, column) => {
        row[cellKey(column)] = String(cells[column] ?? '');
      });

      return row;
    });

  return { headers, rows };
};

/** The edited rows as a workbook, which is what the server previews and later commits. */
const buildFile = (headers: string[], rows: GridRow[]) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      headers,
      ...rows.map((row) =>
        headers.map((_, index) => row[cellKey(index)] ?? '')
      ),
    ]),
    SHEET_NAME
  );

  return new File(
    [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })],
    'technical-dictionary-import.xlsx',
    { type: XLSX_TYPE }
  );
};

const TechnicalImportPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataDictionaryVersion, capabilities, isLoading } =
    useTechnicalDictionaryContext();
  const [activeStep, setActiveStep] = useState(VALIDATION_STEP.UPLOAD);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<GridRow[]>([]);
  const [preview, setPreview] = useState<TechnicalImportPreview>();
  const [validatedRows, setValidatedRows] = useState<GridRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [committed, setCommitted] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const breadcrumbList = useMemo(
    () => [
      {
        name: t('label.technical-dictionary'),
        url: ROUTES.TECHNICAL_DICTIONARY,
      },
      { name: t('label.import-cde-mapping'), url: '' },
    ],
    [t]
  );

  const steps = useMemo(
    () => [
      {
        name: t('cde.step-upload-excel', 'Tải Lên Tệp Excel'),
        step: VALIDATION_STEP.UPLOAD,
      },
      {
        name: t('label.preview-and-edit', 'Xem Trước Sửa'),
        step: VALIDATION_STEP.EDIT_VALIDATE,
      },
      { name: t('label.update', 'Cập Nhật'), step: VALIDATION_STEP.UPDATE },
    ],
    [t]
  );

  const actionLabel = useCallback(
    (action: string) =>
      ({
        [CREATE_RECORD_ACTION]: t('label.declare-column'),
        [UPDATE_ACTION]: t('label.update'),
      }[action] ?? action),
    [t]
  );

  const editColumns = useMemo<Column<GridRow>[]>(
    () =>
      headers.map((header, index) => ({
        key: cellKey(index),
        name: header,
        width: 190,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
        ...(index === 0
          ? {
              headerCellClass: 'cde-first-column-header',
              cellClass: 'cde-first-column-cell',
            }
          : {}),
      })),
    [headers]
  );

  const { handleCopy, handlePaste, handleOnRowsChange, setGridContainer } =
    useGridEditController({
      dataSource,
      setDataSource,
      columns: editColumns as never,
    });

  const handleReset = () => {
    setActiveStep(VALIDATION_STEP.UPLOAD);
    setHeaders([]);
    setDataSource([]);
    setPreview(undefined);
    setValidatedRows([]);
    setStatusFilter('all');
    setCommitted(0);
    setPendingApproval(0);
    setUpdated(0);
    setIsCompleted(false);
  };

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

  const handleFileSelect = async (file: File) => {
    setIsBusy(true);
    try {
      const parsed = await readSheet(file);
      setHeaders(parsed.headers);
      setDataSource(parsed.rows);
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } catch (error) {
      showErrorToast(
        (error as Error)?.message ||
          t(
            'cde.parse-error',
            'Không thể đọc hoặc định dạng file Excel không đúng.'
          )
      );
    } finally {
      setIsBusy(false);
    }

    return false;
  };

  const handleAddRow = () =>
    setDataSource((prev) => [
      ...prev,
      {
        id: `${prev.length + 1}`,
        ...Object.fromEntries(headers.map((_, index) => [cellKey(index), ''])),
      },
    ]);

  const handleValidate = async () => {
    const rows = dataSource.filter((row) => !isBlankRow(row, headers));
    setIsBusy(true);
    try {
      setPreview(await previewTechnicalImport(buildFile(headers, rows)));
      setValidatedRows(rows);
      setStatusFilter('all');
      setActiveStep(VALIDATION_STEP.UPDATE);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
    }
  };

  const handleBack = () => {
    if (activeStep === VALIDATION_STEP.UPDATE) {
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } else {
      handleReset();
    }
  };

  const handleCommit = async () => {
    if (!preview) {
      return;
    }
    setIsBusy(true);
    try {
      const result = await commitTechnicalImport(preview.importSessionId);
      setCommitted(result.committed);
      setPendingApproval(result.pendingApproval);
      setUpdated(result.updated);
      setIsCompleted(true);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } finally {
      setIsBusy(false);
    }
  };

  const issuesByRow = useMemo(
    () => new Map((preview?.rows ?? []).map((row) => [row.rowNumber, row])),
    [preview]
  );

  const validateRows = useMemo<GridRow[]>(
    () =>
      validatedRows.map((source, index) => {
        const issue = issuesByRow.get(index + FIRST_DATA_ROW_NUMBER);
        const errors = (issue?.errors ?? []).map(
          (error) => `${error.column}: ${error.message}`
        );

        return {
          ...source,
          status: errors.length > 0 ? 'failure' : 'success',
          details: [...errors, ...(issue?.warnings ?? [])].join('; '),
          action: issue ? actionLabel(issue.action) : '',
        };
      }),
    [validatedRows, issuesByRow, actionLabel]
  );

  const failedCount = validateRows.filter(
    (row) => row.status === 'failure'
  ).length;
  const passedCount = validateRows.length - failedCount;

  const filteredValidateRows = useMemo(
    () =>
      statusFilter === 'all'
        ? validateRows
        : validateRows.filter((row) => row.status === statusFilter),
    [validateRows, statusFilter]
  );

  const validateColumns = useMemo<Column<GridRow>[]>(
    () => [
      {
        key: 'status',
        name: t('label.status', 'Trạng thái'),
        width: 120,
        minWidth: 100,
        resizable: true,
        headerCellClass: 'cde-status-column-header',
        cellClass: 'cde-status-column-cell',
        renderCell: ({ row }) => (
          <div className="d-flex items-center h-full">
            {row.status === 'success' ? (
              <SuccessBadgeIcon
                data-testid="success-badge"
                height={16}
                width={16}
              />
            ) : (
              <FailBadgeIcon
                data-testid="failure-badge"
                height={16}
                width={16}
              />
            )}
          </div>
        ),
      },
      {
        key: 'details',
        name: t('label.details', 'Chi tiết'),
        width: 320,
        minWidth: 220,
        resizable: true,
        headerCellClass: 'cde-details-column-header',
        cellClass: 'cde-details-column-cell',
        renderCell: ({ row }) => {
          const isSuccess = row.status === 'success';
          const text =
            row.details ||
            (isSuccess
              ? row.action || t('label.valid', 'Hợp lệ')
              : t('label.failed', 'Lỗi'));

          return (
            <Tooltip placement="topLeft" title={text}>
              <span
                className={
                  isSuccess
                    ? 'text-success font-medium ellipsis-text'
                    : 'text-danger font-medium ellipsis-text'
                }>
                {text}
              </span>
            </Tooltip>
          );
        },
      },
      ...editColumns.map((column) => ({
        ...column,
        editable: false,
        renderEditCell: undefined,
        headerCellClass: undefined,
        cellClass: undefined,
      })),
    ],
    [editColumns, t]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.import-cde-mapping')}>
      <Row
        className="cde-import-page-container"
        data-testid="technical-import-page"
        gutter={[16, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbList} />
        </Col>
        <Col span={24}>
          <Stepper activeStep={activeStep} steps={steps} />
        </Col>

        {activeStep === VALIDATION_STEP.UPLOAD && (
          <Col span={24}>
            <Space
              className="w-full"
              direction="vertical"
              size={16}
              style={{ width: '100%' }}>
              <Alert
                showIcon
                message={t('message.technical-import-description', {
                  version: dataDictionaryVersion,
                })}
                type="info"
              />
              <div className="d-flex justify-between items-center">
                <Typography.Text type="secondary">
                  {t('message.technical-import-template-hint')}
                </Typography.Text>
                <Button
                  data-testid="technical-import-template"
                  icon={<DownloadOutlined />}
                  onClick={handleTemplate}>
                  {t('label.download-template')}
                </Button>
              </div>
              <Upload.Dragger
                accept=".xlsx"
                beforeUpload={handleFileSelect}
                className="file-dragger-wrapper"
                data-testid="technical-import-dragger"
                disabled={isBusy || !capabilities.canEdit}
                multiple={false}
                showUploadList={false}>
                <Space
                  align="center"
                  className="w-full justify-center"
                  direction="vertical"
                  size={36}
                  style={{ padding: '40px 0' }}>
                  <ImportIcon height={86} width={86} />
                  <Typography.Text>
                    {isBusy
                      ? t(
                          'cde.parsing-file',
                          'Đang đọc và thẩm định file Excel...'
                        )
                      : t('message.technical-import-upload')}
                  </Typography.Text>
                </Space>
              </Upload.Dragger>
            </Space>
          </Col>
        )}

        {activeStep === VALIDATION_STEP.EDIT_VALIDATE && (
          <Col span={24}>
            <div
              className="om-rdg cde-import-rdg"
              data-testid="technical-import-grid"
              ref={setGridContainer}>
              <DataGrid
                className="rdg-light"
                columns={editColumns}
                rows={dataSource}
                onCopy={handleCopy}
                onPaste={handlePaste as unknown as () => Record<string, string>}
                onRowsChange={handleOnRowsChange}
              />
            </div>
          </Col>
        )}

        {activeStep === VALIDATION_STEP.UPDATE && !isCompleted && (
          <>
            <Col span={24}>
              <div className="cde-validation-header d-flex justify-between items-center w-full flex-wrap gap-2">
                <div
                  className={`cde-validation-summary-badge ${
                    failedCount > 0 ? 'has-error' : 'is-success'
                  }`}>
                  {failedCount > 0 ? (
                    <>
                      <FailBadgeIcon height={16} width={16} />
                      <span>
                        {t(
                          'cde.validation-has-errors',
                          'Phát hiện {{count}} bản ghi bị lỗi, vui lòng kiểm tra cột Chi tiết',
                          { count: failedCount }
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <SuccessBadgeIcon height={16} width={16} />
                      <span>
                        {t(
                          'cde.validation-all-valid',
                          'Tất cả {{count}} bản ghi đều hợp lệ, sẵn sàng cập nhật',
                          { count: passedCount }
                        )}
                      </span>
                    </>
                  )}
                </div>
                <Segmented
                  className="cde-status-filter-segmented"
                  data-testid="status-filter-group"
                  options={[
                    {
                      label: `${t('label.all', 'Tất cả')} (${
                        validateRows.length
                      })`,
                      value: 'all',
                    },
                    {
                      label: `${t(
                        'label.errors-only',
                        'Bị lỗi'
                      )} (${failedCount})`,
                      value: 'failure',
                    },
                    {
                      label: `${t('label.valid', 'Hợp lệ')} (${passedCount})`,
                      value: 'success',
                    },
                  ]}
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                />
              </div>
            </Col>
            {preview?.truncated && (
              <Col span={24}>
                <Alert
                  showIcon
                  message={t('message.technical-import-truncated')}
                  type="warning"
                />
              </Col>
            )}
            <Col span={24}>
              <div
                className="om-rdg cde-import-rdg-step3"
                data-testid="technical-import-validation-grid">
                <DataGrid
                  className="rdg-light"
                  columns={validateColumns}
                  rows={filteredValidateRows}
                />
              </div>
            </Col>
          </>
        )}

        {activeStep === VALIDATION_STEP.UPDATE && isCompleted && (
          <Col span={24}>
            <Card className="m-t-md">
              <Result
                extra={[
                  <Button
                    key="done"
                    type="primary"
                    onClick={() => navigate(ROUTES.TECHNICAL_DICTIONARY)}>
                    {t(
                      'label.back-to-technical-dictionary',
                      'Quay lại Từ điển kỹ thuật'
                    )}
                  </Button>,
                  <Button key="another" onClick={handleReset}>
                    {t('cde.import-another-file', 'Nhập tiếp file khác')}
                  </Button>,
                ]}
                status="success"
                subTitle={t('message.technical-import-result-detail', {
                  pending: pendingApproval,
                  updated,
                })}
                title={t('message.technical-import-committed', {
                  count: committed,
                })}
              />
            </Card>
          </Col>
        )}

        {activeStep !== VALIDATION_STEP.UPLOAD && !isCompleted && (
          <Col span={24}>
            <div className="cde-import-footer">
              {activeStep === VALIDATION_STEP.EDIT_VALIDATE ? (
                <Button data-testid="add-row-btn" onClick={handleAddRow}>
                  {`+ ${t('label.add-row', 'Thêm hàng')}`}
                </Button>
              ) : (
                <div />
              )}
              <Space size={12}>
                <Button disabled={isBusy} onClick={handleBack}>
                  {t('label.previous', 'Trước')}
                </Button>
                {activeStep === VALIDATION_STEP.EDIT_VALIDATE ? (
                  <Button
                    className="cde-action-btn"
                    data-testid="next-button"
                    disabled={dataSource.length === 0 || isBusy}
                    loading={isBusy}
                    type="primary"
                    onClick={handleValidate}>
                    {t('label.next', 'Tiếp theo')}
                  </Button>
                ) : (
                  <Button
                    className="cde-action-btn"
                    data-testid="technical-import-commit"
                    disabled={!preview?.canCommit || isBusy}
                    loading={isBusy}
                    type="primary"
                    onClick={handleCommit}>
                    {t('label.update', 'Cập nhật')}
                  </Button>
                )}
              </Space>
            </div>
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default TechnicalImportPage;
