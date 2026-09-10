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
  Progress,
  Radio,
  Result,
  Row,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import DataGrid, { Column, RenderCellProps, textEditor } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-drag-drop.svg';
import { ReactComponent as PaperPlaneIcon } from '../../assets/svg/paper-plane.svg';
import { ReactComponent as SuccessBadgeIcon } from '../../assets/svg/success-badge.svg';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import {
  downloadDQExcelTemplate,
  formatDQImportErrorMessage,
  readAndValidateDQExcel,
  transformDQRowToGlossaryTermPayload,
  validateDQDataSourceValues,
  validateDQDimensionValue,
  validateDQFrequencyValue,
  validateDQMethodValue,
  validateDQTargetPopulationValue,
} from '../../components/Glossary/DQImportExport/DQImportExport.utils';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import Stepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import '../../components/UploadFile/upload-file.less';
import { VALIDATION_STEP } from '../../constants/BulkImport.constant';
import { Tag as ClassificationTag } from '../../generated/entity/classification/tag';
import { Glossary } from '../../generated/entity/data/glossary';
import { EntityStatus, GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { CSVImportResult, Status } from '../../generated/type/csvImportResult';
import { useFqn } from '../../hooks/useFqn';
import { useGridEditController } from '../../hooks/useGridEditController';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTerms,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { getTags } from '../../rest/tagAPI';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './dq-import-page.less';

const { Dragger } = Upload;

type DuplicateHandling = 'skip' | 'update';

const DQImportPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();

  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const [glossary, setGlossary] = useState<Glossary>();
  const [existingTerms, setExistingTerms] = useState<
    (GlossaryTerm | { name?: string; fullyQualifiedName?: string; id?: string })[]
  >([]);

  const [duplicatePolicy, setDuplicatePolicy] =
    useState<DuplicateHandling>('skip');
  const [parsing, setParsing] = useState<boolean>(false);

  // Dữ liệu bảng dạng DataGrid cho Bước 2 (Xem Trước Sửa)
  const [dataSource, setDataSource] = useState<Record<string, string>[]>([]);

  // Dữ liệu bảng thẩm định cho Bước 3 (Cập Nhật)
  const [validateDataSource, setValidateDataSource] = useState<
    Record<string, string>[]
  >([]);
  const [validationData, setValidationData] = useState<CSVImportResult>();
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'failure' | 'success'
  >('all');

  // Metadata tags từ backend
  const [allTags, setAllTags] = useState<ClassificationTag[]>([]);

  // Trạng thái nạp dữ liệu
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
  const [createdTerms, setCreatedTerms] = useState<
    { id: string; name: string }[]
  >([]);
  const [isSubmittingAll, setIsSubmittingAll] = useState<boolean>(false);
  const [isSubmittingAllSuccess, setIsSubmittingAllSuccess] =
    useState<boolean>(false);

  // Lấy thông tin Glossary và danh sách terms có sẵn
  useEffect(() => {
    if (fqn) {
      getGlossariesByName(fqn)
        .then((res) => setGlossary(res))
        .catch((err) => showErrorToast(err));

      getGlossaryTerms({ glossary: fqn, limit: 1000 })
        .then((res) => {
          if (res?.data) {
            setExistingTerms(res.data);
          }
        })
        .catch(() => {
          // Bỏ qua lỗi, tiếp tục với mảng rỗng
        });
    }
  }, [fqn]);

  // Tải danh sách Tags để hỗ trợ thẩm định & phân giải FQN
  useEffect(() => {
    getTags({ limit: 500 })
      .then((res) => {
        if (res?.data?.length) {
          setAllTags(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const breadcrumbList = useMemo(() => {
    return [
      {
        name: t('label.glossary-plural', 'Thuật ngữ'),
        url: '/glossary',
      },
      {
        name: glossary?.displayName || glossary?.name || fqn,
        url: getGlossaryPath(fqn),
      },
      {
        name: t('label.import', 'Nhập'),
        url: '',
      },
    ];
  }, [glossary, fqn, t]);

  const importSteps = useMemo(
    () => [
      {
        name: t('dq.step-upload-excel', 'Tải Lên Tệp Excel'),
        step: VALIDATION_STEP.UPLOAD,
      },
      {
        name: t('label.preview-and-edit', 'Xem Trước Sửa'),
        step: VALIDATION_STEP.EDIT_VALIDATE,
      },
      {
        name: t('label.update', 'Cập Nhật'),
        step: VALIDATION_STEP.UPDATE,
      },
    ],
    [t]
  );

  // Cấu hình 13 cột Quy tắc CLDL cho DataGrid ở Bước 2
  const dqColumns: Column<Record<string, string>>[] = useMemo(
    () => [
      {
        key: 'name',
        name: `${t('dq.rule-code', 'Mã quy tắc nghiệp vụ')}*`,
        width: 190,
        editable: true,
        resizable: true,
        headerCellClass: 'dq-first-column-header',
        cellClass: 'dq-first-column-cell',
        renderEditCell: textEditor,
      },
      {
        key: 'cdeCode',
        name: `${t('dq.cde-code-ref', 'Mã CDE quy chiếu')}*`,
        width: 170,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'cdeName',
        name: `${t('dq.cde-name-ref', 'Tên thành tố CDE')}*`,
        width: 210,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'dimension',
        name: `${t('dq.dimension-label', 'Tiêu chí đánh giá CLDL')}*`,
        width: 220,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'description',
        name: `${t('dq.business-rule', 'Quy tắc nghiệp vụ về CLDL')}*`,
        width: 280,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'ruleExplanation',
        name: t('dq.rule-explanation', 'Diễn giải Quy tắc nghiệp vụ'),
        width: 250,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'otherConstraints',
        name: t('dq.other-constraints', 'Ràng buộc/yêu cầu khác'),
        width: 220,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'exceptions',
        name: t('dq.exceptions', 'Trường hợp ngoại lệ'),
        width: 220,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'targetPopulation',
        name: t('dq.target-population', 'Tiêu chí cơ sở (Tập dữ liệu kiểm tra)'),
        width: 240,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'method',
        name: t('dq.inspection-method', 'Hình thức kiểm tra CLDL'),
        width: 240,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'frequency',
        name: t('dq.frequency-label', 'Tần suất'),
        width: 150,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'qualityThreshold',
        name: t('dq.quality-threshold', 'Ngưỡng CLDL'),
        width: 150,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'dataSource',
        name: t('label.datasource', 'Nguồn dữ liệu'),
        width: 160,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
    ],
    [t]
  );

  // Hook quản lý DataGrid
  const {
    handleCopy,
    handlePaste: actualHandlePaste,
    handleOnRowsChange,
    setGridContainer,
  } = useGridEditController({
    dataSource,
    setDataSource,
    columns: dqColumns,
  });

  const handlePaste = actualHandlePaste as unknown as () => Record<
    string,
    string
  >;

  // Thêm hàng mới cho DataGrid
  const handleAddRow = useCallback(() => {
    setDataSource((prev) => [
      ...prev,
      {
        id: `${prev.length + 1}`,
        name: '',
        cdeCode: '',
        cdeName: '',
        dimension: '',
        description: '',
        ruleExplanation: '',
        otherConstraints: '',
        exceptions: '',
        targetPopulation: '',
        method: '',
        frequency: '',
        qualityThreshold: '',
        dataSource: '',
      },
    ]);
  }, [setDataSource]);

  // Đọc file Excel tải lên
  const handleFileSelect = useCallback(
    async (file: File) => {
      setParsing(true);
      try {
        const result = await readAndValidateDQExcel(
          file,
          existingTerms as GlossaryTerm[],
          allTags
        );

        const rows: Record<string, string>[] = result.rows.map((r, idx) => ({
          id: `${idx + 1}`,
          name: r.name || '',
          cdeCode: r.cdeCode || '',
          cdeName: r.cdeName || '',
          dimension: r.dimension || '',
          description: r.description || '',
          ruleExplanation: r.ruleExplanation || '',
          otherConstraints: r.otherConstraints || '',
          exceptions: r.exceptions || '',
          targetPopulation: r.targetPopulation || '',
          method: r.method || '',
          frequency: r.frequency || '',
          qualityThreshold: r.qualityThreshold || '',
          dataSource: r.dataSource || '',
        }));

        setDataSource(rows);
        setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
      } catch (err: any) {
        showErrorToast(
          err?.message ||
            t(
              'dq.parse-error',
              'Không thể đọc hoặc định dạng file Excel không đúng.'
            )
        );
      } finally {
        setParsing(false);
      }

      return false;
    },
    [existingTerms, allTags, t]
  );

  const handleBack = useCallback(() => {
    if (activeStep === VALIDATION_STEP.UPDATE) {
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } else {
      setActiveStep(VALIDATION_STEP.UPLOAD);
    }
  }, [activeStep]);

  // Thẩm định dữ liệu từ Bước 2 sang Bước 3
  const handleValidate = useCallback(() => {
    const seenNames = new Set<string>();
    const validatedRows: Record<string, string>[] = [];
    let passedCount = 0;
    let failedCount = 0;

    const existingMap = new Map<
      string,
      GlossaryTerm | { name?: string; id?: string }
    >();
    existingTerms.forEach((term) => {
      if (term.name) {
        existingMap.set(term.name.trim().toLowerCase(), term);
      }
    });

    dataSource.forEach((row, idx) => {
      const rowCopy = { ...row, id: row.id || `${idx + 1}` };
      const errors: string[] = [];

      // 1. Mã quy tắc nghiệp vụ
      const name = (rowCopy.name || '').trim();
      if (!name) {
        errors.push(
          t('message.field-is-required', {
            field: t('dq.rule-code', 'Mã quy tắc nghiệp vụ'),
          })
        );
      } else {
        const lower = name.toLowerCase();
        if (seenNames.has(lower)) {
          errors.push(
            t('dq.rule-code-duplicate-in-data', "Mã quy tắc '{{code}}' bị trùng lặp trong bảng", {
              code: name,
            })
          );
        } else {
          seenNames.add(lower);
        }
      }

      // 2. Mã CDE quy chiếu
      const cdeCode = (rowCopy.cdeCode || '').trim();
      if (!cdeCode) {
        errors.push(
          t('message.field-is-required', {
            field: t('dq.cde-code-ref', 'Mã CDE quy chiếu'),
          })
        );
      }

      // 3. Tên thành tố CDE
      const cdeName = (rowCopy.cdeName || '').trim();
      if (!cdeName) {
        errors.push(
          t('message.field-is-required', {
            field: t('dq.cde-name-ref', 'Tên thành tố CDE'),
          })
        );
      }

      // 4. Tiêu chí CLDL
      const dimensionRaw = (rowCopy.dimension || '').trim();
      if (!dimensionRaw) {
        errors.push(
          t('message.field-is-required', {
            field: t('dq.dimension-label', 'Tiêu chí đánh giá CLDL'),
          })
        );
      } else {
        const dimRes = validateDQDimensionValue(dimensionRaw, allTags);
        if (!dimRes.isValid) {
          errors.push(
            t(
              'dq.invalid-dimension',
              "Tiêu chí CLDL '{{value}}' không thuộc danh mục hợp lệ",
              { value: dimensionRaw }
            )
          );
        }
      }

      // 5. Quy tắc nghiệp vụ về CLDL
      const description = (rowCopy.description || '').trim();
      if (!description) {
        errors.push(
          t('message.field-is-required', {
            field: t('dq.business-rule', 'Quy tắc nghiệp vụ về CLDL'),
          })
        );
      }

      // 6. Tiêu chí cơ sở / Tập dữ liệu kiểm tra
      const targetPopRaw = (rowCopy.targetPopulation || '').trim();
      if (targetPopRaw) {
        const targetRes = validateDQTargetPopulationValue(targetPopRaw, allTags);
        if (!targetRes.isValid) {
          errors.push(
            t(
              'dq.invalid-target-population',
              "Tập dữ liệu kiểm tra '{{value}}' không hợp lệ",
              { value: targetPopRaw }
            )
          );
        }
      }

      // 7. Hình thức kiểm tra CLDL
      const methodRaw = (rowCopy.method || '').trim();
      if (methodRaw) {
        const methodRes = validateDQMethodValue(methodRaw, allTags);
        if (!methodRes.isValid) {
          errors.push(
            t(
              'dq.invalid-method',
              "Hình thức kiểm tra '{{value}}' không hợp lệ",
              { value: methodRaw }
            )
          );
        }
      }

      // 8. Tần suất
      const frequencyRaw = (rowCopy.frequency || '').trim();
      if (frequencyRaw) {
        const freqRes = validateDQFrequencyValue(frequencyRaw, allTags);
        if (!freqRes.isValid) {
          errors.push(
            t(
              'dq.invalid-frequency',
              "Tần suất '{{value}}' không hợp lệ",
              { value: frequencyRaw }
            )
          );
        }
      }

      // 9. Nguồn dữ liệu
      const dsRaw = (rowCopy.dataSource || '').trim();
      if (dsRaw) {
        const dsRes = validateDQDataSourceValues(dsRaw, allTags);
        if (!dsRes.isValid) {
          errors.push(
            t(
              'dq.invalid-datasource',
              "Nguồn dữ liệu '{{value}}' không hợp lệ",
              { value: dsRaw }
            )
          );
        }
      }

      // 10. Kiểm tra trùng lặp trên hệ thống
      const isExisting = name ? existingMap.has(name.toLowerCase()) : false;
      const existingTerm = name ? existingMap.get(name.toLowerCase()) : undefined;

      if (isExisting && duplicatePolicy === 'skip') {
        rowCopy.isSkipped = 'true';
      }

      const isValid = errors.length === 0;
      if (isValid) {
        passedCount++;
      } else {
        failedCount++;
      }

      validatedRows.push({
        ...rowCopy,
        status: isValid ? 'success' : 'failure',
        details: errors.join('; '),
        isExisting: isExisting ? 'true' : 'false',
        existingId: (existingTerm as any)?.id || '',
      });
    });

    setValidateDataSource(validatedRows);
    setValidationData({
      status: failedCount === 0 ? Status.Success : Status.Failure,
      numberOfRowsProcessed: dataSource.length,
      numberOfRowsPassed: passedCount,
      numberOfRowsFailed: failedCount,
    });
    setActiveStep(VALIDATION_STEP.UPDATE);
  }, [dataSource, existingTerms, duplicatePolicy, allTags, t]);

  // Danh sách dòng hiển thị theo Segmented Filter
  const filteredValidateDataSource = useMemo(() => {
    if (statusFilter === 'all') {
      return validateDataSource;
    }

    return validateDataSource.filter((row) => row.status === statusFilter);
  }, [validateDataSource, statusFilter]);

  // Cấu hình cột ở Bước 3 (Kèm trạng thái & chi tiết)
  const validateColumns: Column<Record<string, string>>[] = useMemo(() => {
    return [
      {
        key: 'status',
        name: t('label.status', 'Trạng thái'),
        width: 140,
        resizable: true,
        headerCellClass: 'dq-status-column-header',
        cellClass: 'dq-status-column-cell',
        renderCell: (props: RenderCellProps<Record<string, string>>) => {
          const isSuccess = props.row.status === 'success';

          return (
            <div className="d-flex items-center gap-2">
              {isSuccess ? (
                <>
                  <SuccessBadgeIcon height={16} width={16} />
                  <span className="text-success font-medium">
                    {t('label.valid', 'Hợp lệ')}
                  </span>
                </>
              ) : (
                <>
                  <FailBadgeIcon height={16} width={16} />
                  <span className="text-danger font-medium">
                    {t('label.error', 'Có lỗi')}
                  </span>
                </>
              )}
            </div>
          );
        },
      },
      {
        key: 'details',
        name: t('label.details', 'Chi tiết'),
        width: 320,
        resizable: true,
        headerCellClass: 'dq-details-column-header',
        cellClass: 'dq-details-column-cell',
        renderCell: (props: RenderCellProps<Record<string, string>>) => {
          const details = props.row.details;

          return details ? (
            <Tooltip title={details}>
              <span className="text-danger font-medium text-truncate">
                {details}
              </span>
            </Tooltip>
          ) : (
            <span className="text-muted text-xs">
              {t('label.passed', 'Đạt yêu cầu')}
            </span>
          );
        },
      },
      ...dqColumns.map((col) => ({
        ...col,
        editable: false,
        headerCellClass: undefined,
        cellClass: undefined,
        renderEditCell: undefined,
      })),
    ];
  }, [dqColumns, t]);

  // Thực thi nạp dữ liệu vào backend
  const handleStartImport = useCallback(async () => {
    if (!glossary) {
      showErrorToast(t('dq.error-glossary-not-found', 'Không tìm thấy thông tin danh mục CLDL.'));

      return;
    }

    const rowsToProcess = validateDataSource.filter(
      (row) => row.status === 'success'
    );

    if (rowsToProcess.length === 0) {
      showErrorToast(
        t('dq.no-valid-records-to-import', 'Không có bản ghi hợp lệ nào để cập nhật.')
      );

      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStats({ created: 0, updated: 0, skipped: 0, failed: 0 });
    setImportErrors([]);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { row: number; name: string; reason: string }[] = [];
    const createdTermsList: { id: string; name: string }[] = [];

    const total = rowsToProcess.length;

    for (let i = 0; i < total; i++) {
      const row = rowsToProcess[i];
      const rowNum = Number(row.id) || i + 1;
      const termName = (row.name || '').trim();
      setCurrentImportName(termName);

      const isExisting = row.isExisting === 'true';

      if (isExisting && duplicatePolicy === 'skip') {
        skipped++;
        setImportProgress(Math.round(((i + 1) / total) * 100));
        continue;
      }

      try {
        const payload = transformDQRowToGlossaryTermPayload(
          {
            rowNumber: rowNum,
            name: termName,
            cdeCode: row.cdeCode,
            cdeName: row.cdeName,
            dimension: row.dimension,
            description: row.description,
            ruleExplanation: row.ruleExplanation,
            otherConstraints: row.otherConstraints,
            exceptions: row.exceptions,
            targetPopulation: row.targetPopulation,
            method: row.method,
            frequency: row.frequency,
            qualityThreshold: row.qualityThreshold,
            dataSource: row.dataSource,
            status: EntityStatus.Draft,
            errors: [],
            warnings: [],
            isValid: true,
          },
          glossary.fullyQualifiedName || fqn,
          allTags
        );

        if (isExisting && duplicatePolicy === 'update' && row.existingId) {
          // Cập nhật bản ghi có sẵn bằng JSON Patch
          const patchJson = [
            {
              op: 'replace',
              path: '/description',
              value: payload.description,
            },
            {
              op: 'add',
              path: '/tags',
              value: payload.tags || [],
            },
            {
              op: 'add',
              path: '/extension',
              value: payload.extension,
            },
          ];

          await patchGlossaryTerm(row.existingId, patchJson);
          updated++;
        } else {
          // Tạo mới bản ghi: Luôn ở trạng thái Draft
          const newTerm = await addGlossaryTerm({
            ...payload,
            status: EntityStatus.Draft,
          });
          created++;
          if (newTerm?.id) {
            createdTermsList.push({
              id: newTerm.id,
              name: newTerm.name || termName,
            });
          }
        }
      } catch (err: any) {
        failed++;
        errors.push({
          row: rowNum,
          name: termName,
          reason: err?.message || err?.response?.data?.message || 'Unknown error',
        });
      }

      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setCreatedTerms(createdTermsList);
    setIsSubmittingAll(false);
    setIsSubmittingAllSuccess(false);
    setImportStats({ created, updated, skipped, failed });
    setImportErrors(errors);
    setIsImporting(false);
    setIsCompleted(true);
  }, [glossary, validateDataSource, duplicatePolicy, fqn, allTags, t]);

  const handleBulkSubmitCreatedTerms = useCallback(async () => {
    if (createdTerms.length === 0) {
      return;
    }

    setIsSubmittingAll(true);
    let successCount = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < createdTerms.length; i += BATCH_SIZE) {
      const chunk = createdTerms.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        chunk.map(async (term) => {
          try {
            await patchGlossaryTerm(term.id, [
              {
                op: 'replace',
                path: '/entityStatus',
                value: EntityStatus.InReview,
              },
            ]);
            successCount++;
          } catch (err) {
            // ignore individual error
          }
        })
      );
    }

    setIsSubmittingAll(false);
    if (successCount > 0) {
      setIsSubmittingAllSuccess(true);
      showSuccessToast(
        t(
          'message.bulk-submit-success',
          'Đã gửi phê duyệt thành công {{count}} thuật ngữ!',
          {
            count: successCount,
          }
        )
      );
    } else {
      showErrorToast(
        t(
          'message.bulk-action-error',
          'Có lỗi xảy ra khi thực hiện thao tác hàng loạt.'
        )
      );
    }
  }, [createdTerms, t]);

  const handleReset = useCallback(() => {
    setActiveStep(VALIDATION_STEP.UPLOAD);
    setDataSource([]);
    setValidateDataSource([]);
    setValidationData(undefined);
    setIsCompleted(false);
    setCreatedTerms([]);
    setIsSubmittingAll(false);
    setIsSubmittingAllSuccess(false);
    setImportProgress(0);
    setImportStats({ created: 0, updated: 0, skipped: 0, failed: 0 });
    setImportErrors([]);
  }, []);

  return (
    <PageLayoutV1
      pageTitle={t('dq.import-page-title', 'Nhập Quy tắc Chất lượng dữ liệu')}>
      <Row className="dq-import-page-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbList} />
        </Col>

        <Col span={24}>
          <Stepper activeStepNumber={activeStep} steps={importSteps} />
        </Col>

        {/* BƯỚC 1: TẢI LÊN FILE EXCEL */}
        {activeStep === VALIDATION_STEP.UPLOAD && (
          <>
            <Col span={24}>
              <Card
                className="m-t-sm"
                title={t('dq.duplicate-handling-title', 'Xử lý khi trùng Mã quy tắc nghiệp vụ')}>
                <Radio.Group
                  value={duplicatePolicy}
                  onChange={(e) => setDuplicatePolicy(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="skip">
                      <strong>{t('label.skip', 'Bỏ qua')}</strong>:{' '}
                      {t(
                        'dq.skip-duplicate-desc',
                        'Giữ nguyên bản ghi đã có trong danh mục, không thực hiện thay đổi'
                      )}
                    </Radio>
                    <Radio value="update">
                      <strong>{t('label.update', 'Cập nhật')}</strong>:{' '}
                      {t(
                        'dq.update-duplicate-desc',
                        'Ghi đè thông tin mới từ tệp Excel vào bản ghi đã có'
                      )}
                    </Radio>
                  </Space>
                </Radio.Group>
              </Card>
            </Col>

            <Col span={24}>
              <div className="upload-file-container">
                <Dragger
                  accept=".xlsx, .xls"
                  beforeUpload={handleFileSelect}
                  className="file-dropper"
                  data-testid="upload-file-widget"
                  disabled={parsing}
                  multiple={false}
                  showUploadList={false}>
                  <div className="upload-file-content">
                    <ImportIcon className="m-b-xs" height={40} width={40} />
                    <Typography.Text className="font-semibold text-md text-primary">
                      {t('dq.drag-drop-prompt', 'Kéo thả tệp Excel (.xlsx) vào đây hoặc bấm để chọn')}
                    </Typography.Text>
                    <Typography.Text className="text-grey-muted text-xs m-t-xss">
                      {t(
                        'dq.file-format-hint',
                        'Định dạng hỗ trợ: Microsoft Excel (.xlsx, .xls). Cấu trúc 13 cột chuẩn hóa của Agribank'
                      )}
                    </Typography.Text>
                  </div>
                </Dragger>
              </div>
            </Col>

            <Col span={24}>
              <div className="d-flex justify-between items-center m-t-sm">
                <Button
                  icon={<DownloadOutlined />}
                  type="default"
                  onClick={downloadDQExcelTemplate}>
                  {t('dq.download-template-button', 'Tải file mẫu Excel (.xlsx)')}
                </Button>
                <Typography.Text type="secondary">
                  {t(
                    'dq.template-hint',
                    'Sử dụng file mẫu có cấu trúc 13 cột chuẩn để đảm bảo tính hợp lệ'
                  )}
                </Typography.Text>
              </div>
            </Col>
          </>
        )}

        {/* BƯỚC 2: XEM TRƯỚC VÀ CHỈNH SỬA BẰNG DATAGRID */}
        {activeStep === VALIDATION_STEP.EDIT_VALIDATE && (
          <Col span={24}>
            <div
              className="om-rdg dq-import-rdg"
              data-testid="rdg-container"
              ref={setGridContainer}
              tabIndex={0}
              onCopy={handleCopy}
              onPaste={handlePaste}>
              <DataGrid
                className="rdg-light"
                columns={dqColumns}
                rows={dataSource}
                onRowsChange={handleOnRowsChange}
              />
            </div>
          </Col>
        )}

        {/* BƯỚC 3: CẬP NHẬT / TIẾN TRÌNH / KẾT QUẢ */}
        {activeStep === VALIDATION_STEP.UPDATE && (
          <>
            {!isCompleted ? (
              <>
                {isImporting ? (
                  <Col span={24}>
                    <Card className="text-center p-y-lg m-t-md">
                      <Space direction="vertical" size="middle" style={{ width: '60%' }}>
                        <Typography.Title level={4}>
                          {t('dq.importing-in-progress', 'Đang cập nhật danh mục Quy tắc CLDL...')}
                        </Typography.Title>
                        <Progress
                          percent={importProgress}
                          status="active"
                          strokeColor={{
                            '0%': '#108ee9',
                            '100%': '#87d068',
                          }}
                        />
                        <Typography.Text type="secondary">
                          {t('dq.currently-processing', 'Đang xử lý:')} {currentImportName}
                        </Typography.Text>
                      </Space>
                    </Card>
                  </Col>
                ) : (
                  <>
                    {/* Header thông báo kết quả thẩm định & Bộ lọc Segmented */}
                    {validationData && (
                      <Col span={24}>
                        <div className="d-flex justify-between items-center dq-validation-header">
                          <div
                            className={`dq-validation-summary-badge ${
                              validationData.numberOfRowsFailed > 0
                                ? 'has-error'
                                : 'is-success'
                            }`}>
                            {validationData.numberOfRowsFailed > 0 ? (
                              <>
                                <FailBadgeIcon height={16} width={16} />
                                <span>
                                  {t(
                                    'dq.validation-has-errors',
                                    'Phát hiện {{count}} bản ghi bị lỗi, vui lòng kiểm tra cột Chi tiết',
                                    {
                                      count: validationData.numberOfRowsFailed,
                                    }
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                <SuccessBadgeIcon height={16} width={16} />
                                <span>
                                  {t(
                                    'dq.validation-all-valid',
                                    'Tất cả {{count}} bản ghi đều hợp lệ, sẵn sàng cập nhật',
                                    {
                                      count: validationData.numberOfRowsPassed,
                                    }
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="d-flex items-center gap-2">
                            <Segmented
                              className="dq-status-filter-segmented"
                              data-testid="status-filter-group"
                              options={[
                                {
                                  label: (
                                    <span className="filter-item">
                                      <span>{t('label.all', 'Tất cả')}</span>
                                      <span
                                        className="filter-count"
                                        data-testid="processed-row">
                                        {validationData.numberOfRowsProcessed}
                                      </span>
                                    </span>
                                  ),
                                  value: 'all',
                                },
                                {
                                  label: (
                                    <span className="filter-item">
                                      <span className="filter-status-dot dot-error" />
                                      <span>{t('label.errors-only', 'Bị lỗi')}</span>
                                      <span
                                        className={
                                          validationData.numberOfRowsFailed > 0
                                            ? 'filter-count filter-count-error'
                                            : 'filter-count'
                                        }
                                        data-testid="failed-row">
                                        {validationData.numberOfRowsFailed}
                                      </span>
                                    </span>
                                  ),
                                  value: 'failure',
                                },
                                {
                                  label: (
                                    <span className="filter-item">
                                      <span className="filter-status-dot dot-success" />
                                      <span>{t('label.valid', 'Hợp lệ')}</span>
                                      <span
                                        className={
                                          validationData.numberOfRowsPassed > 0
                                            ? 'filter-count filter-count-success'
                                            : 'filter-count'
                                        }
                                        data-testid="passed-row">
                                        {validationData.numberOfRowsPassed}
                                      </span>
                                    </span>
                                  ),
                                  value: 'success',
                                },
                              ]}
                              value={statusFilter}
                              onChange={(val) =>
                                setStatusFilter(
                                  val as 'all' | 'failure' | 'success'
                                )
                              }
                            />
                          </div>
                        </div>
                      </Col>
                    )}

                    <Col span={24}>
                      <div className="om-rdg dq-import-rdg-step3">
                        <DataGrid
                          className="rdg-light"
                          columns={validateColumns}
                          rows={filteredValidateDataSource}
                        />
                      </div>
                    </Col>
                  </>
                )}
              </>
            ) : (
              <Col span={24}>
                <Card className="m-t-md">
                  <Result
                    extra={[
                      createdTerms.length > 0 && (
                        <Button
                          data-testid="submit-all-imported-btn"
                          disabled={isSubmittingAllSuccess}
                          icon={<PaperPlaneIcon height={14} width={14} />}
                          key="submit-all"
                          loading={isSubmittingAll}
                          type="primary"
                          onClick={handleBulkSubmitCreatedTerms}>
                          {isSubmittingAllSuccess
                            ? t(
                                'label.all-submitted-for-review',
                                'Đã gửi duyệt tất cả'
                              )
                            : t(
                                'label.submit-all-imported-for-review',
                                'Gửi phê duyệt toàn bộ {{count}} bản ghi vừa nạp',
                                { count: createdTerms.length }
                              )}
                        </Button>
                      ),
                      <Button
                        key="done"
                        type={createdTerms.length > 0 ? 'default' : 'primary'}
                        onClick={() => navigate(getGlossaryPath(fqn))}>
                        {t(
                          'dq.close-and-view-list',
                          'Đóng & Quay lại danh mục CLDL'
                        )}
                      </Button>,
                      <Button key="another" onClick={handleReset}>
                        {t('dq.import-another-file', 'Nhập tiếp file khác')}
                      </Button>,
                    ]}
                    status={importStats.failed > 0 ? 'warning' : 'success'}
                    subTitle={
                      <Space
                        className="w-full"
                        direction="vertical"
                        size="small">
                        <div>
                          {t(
                            'dq.import-success-msg',
                            'Đã tạo mới thành công {{count}} bản ghi Quy tắc CLDL ở trạng thái',
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
                              'dq.import-updated-msg',
                              'Đã cập nhật {{count}} bản ghi có sẵn.',
                              { count: importStats.updated }
                            )}
                          </div>
                        )}
                        {importStats.skipped > 0 && (
                          <Typography.Text type="secondary">
                            {t(
                              'dq.import-skipped-msg',
                              'Đã bỏ qua {{count}} bản ghi do trùng mã.',
                              { count: importStats.skipped }
                            )}
                          </Typography.Text>
                        )}
                        {importStats.failed > 0 && (
                          <Typography.Text type="danger">
                            {t(
                              'dq.import-failed-msg',
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
                                style={{
                                  maxHeight: '160px',
                                  overflowY: 'auto',
                                }}>
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
                                    : {formatDQImportErrorMessage(err.reason, t)}
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
                    title={t(
                      'dq.import-completed-title',
                      'Hoàn tất nạp dữ liệu Quy tắc CLDL!'
                    )}
                  />
                </Card>
              </Col>
            )}
          </>
        )}

        {/* FOOTER ĐIỀU HƯỚNG BƯỚC 2 & BƯỚC 3 */}
        {(activeStep === VALIDATION_STEP.EDIT_VALIDATE ||
          (activeStep === VALIDATION_STEP.UPDATE &&
            !isImporting &&
            !isCompleted)) && (
          <Col span={24}>
            <div className="dq-import-footer">
              {activeStep === VALIDATION_STEP.EDIT_VALIDATE ? (
                <Button data-testid="add-row-btn" onClick={handleAddRow}>
                  {`+ ${t('label.add-row', 'Thêm hàng')}`}
                </Button>
              ) : (
                <div />
              )}
              <Space size={12}>
                <Button disabled={isImporting} onClick={handleBack}>
                  {t('label.previous', 'Trước')}
                </Button>
                {activeStep === VALIDATION_STEP.EDIT_VALIDATE ? (
                  <Button
                    className="dq-action-btn"
                    data-testid="next-button"
                    disabled={dataSource.length === 0}
                    type="primary"
                    onClick={handleValidate}>
                    {t('label.next', 'Tiếp theo')}
                  </Button>
                ) : (
                  <Button
                    className="dq-action-btn"
                    data-testid="update-button"
                    disabled={
                      isImporting ||
                      !validationData ||
                      validationData.numberOfRowsPassed === 0
                    }
                    type="primary"
                    onClick={handleStartImport}>
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

export default DQImportPage;
