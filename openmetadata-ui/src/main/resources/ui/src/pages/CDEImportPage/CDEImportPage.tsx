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

import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
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
  downloadCDEExcelTemplate,
  findMatchingDomain,
  formatCDEImportErrorMessage,
  readAndValidateCDEExcel,
  transformRowToGlossaryTermPayload,
  validateCDEVersionValue,
  validateDataClassificationValue,
  validateDataQualityRulesValue,
  validateDataSourceValues,
  validatePersonalDataValue,
  validateUserOrTeamList,
} from '../../components/Glossary/CDEImportExport/CDEImportExport.utils';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import Stepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import '../../components/UploadFile/upload-file.less';
import { VALIDATION_STEP } from '../../constants/BulkImport.constant';
import { Tag as ClassificationTag } from '../../generated/entity/classification/tag';
import { Glossary } from '../../generated/entity/data/glossary';
import { EntityStatus, GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import { CSVImportResult, Status } from '../../generated/type/csvImportResult';
import { useFqn } from '../../hooks/useFqn';
import { useGridEditController } from '../../hooks/useGridEditController';
import { getDomainList } from '../../rest/domainAPI';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTerms,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { getTags } from '../../rest/tagAPI';
import { getTeams } from '../../rest/teamsAPI';
import { getUsers } from '../../rest/userAPI';
import './cde-import-page.less';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const { Dragger } = Upload;

type DuplicateHandling = 'skip' | 'update';

const CDEImportPage: FC = () => {
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

  // Metadata ánh xạ
  const [allDomains, setAllDomains] = useState<EntityReference[]>([]);
  const [allTags, setAllTags] = useState<ClassificationTag[]>([]);
  const [allUsers, setAllUsers] = useState<EntityReference[]>([]);
  const [allTeams, setAllTeams] = useState<EntityReference[]>([]);

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

  // Tải danh sách Domains, Tags, Users và Teams để hỗ trợ thẩm định & phân giải FQN
  useEffect(() => {
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
      .catch(() => {});

    getTags({ limit: 500 })
      .then((res) => {
        if (res?.data?.length) {
          setAllTags(res.data);
        }
      })
      .catch(() => {});

    getUsers({ limit: 1000 })
      .then((res) => {
        if (res?.data?.length) {
          setAllUsers(
            res.data.map((u) => ({
              id: u.id,
              type: 'user',
              name: u.name,
              displayName: u.displayName,
              fullyQualifiedName: u.fullyQualifiedName,
            }))
          );
        }
      })
      .catch(() => {});

    getTeams({ limit: 1000 })
      .then((res) => {
        if (res?.data?.length) {
          setAllTeams(
            res.data.map((t) => ({
              id: t.id,
              type: 'team',
              name: t.name,
              displayName: t.displayName,
              fullyQualifiedName: t.fullyQualifiedName,
            }))
          );
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
        name: t('cde.step-upload-excel', 'Tải Lên Tệp Excel'),
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

  // Cấu hình các cột CDE cho DataGrid (Đồng nhất OpenMetadata)
  const cdeColumns: Column<Record<string, string>>[] = useMemo(
    () => [
      {
        key: 'name',
        name: `${t('label.cde-code', 'Mã CDE quy chiếu')}*`,
        width: 190,
        editable: true,
        resizable: true,
        headerCellClass: 'cde-first-column-header',
        cellClass: 'cde-first-column-cell',
        renderEditCell: textEditor,
      },
      {
        key: 'displayName',
        name: `${t('label.cde-name', 'Tên thành tố CDE')}*`,
        width: 200,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'domain',
        name: `${t('label.domain', 'Nhóm nghiệp vụ')}*`,
        width: 170,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'dataSource',
        name: t('label.datasource', 'Nguồn dữ liệu'),
        width: 150,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'description',
        name: t('label.description', 'Ý nghĩa nghiệp vụ'),
        width: 260,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'entityRelationship',
        name: t('label.entity-relationship', 'Mối quan hệ với thực thể'),
        width: 220,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'owner',
        name: t('label.owner', 'Chủ sở hữu dữ liệu'),
        width: 170,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'dataClassification',
        name: t('label.data-classification', 'Phân loại dữ liệu'),
        width: 160,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'personalData',
        name: t('label.personal-data', 'Dữ liệu cá nhân'),
        width: 140,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'relatedRegulatoryDocuments',
        name: t('label.regulatory-documents', 'Văn bản quy định liên quan'),
        width: 230,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'dataQualityRules',
        name: t('label.data-quality-rules', 'Quy định chất lượng dữ liệu'),
        width: 220,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'cdeVersion',
        name: t('label.cde-version', 'Phiên bản'),
        width: 120,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
      {
        key: 'reviewer',
        name: t('label.reviewer', 'Người kiểm soát'),
        width: 160,
        editable: true,
        resizable: true,
        renderEditCell: textEditor,
      },
    ],
    [t]
  );

  // Hook quản lý thao tác trên DataGrid (Copy, Paste, Undo, Redo, Add Row)
  const {
    handleCopy,
    handlePaste: actualHandlePaste,
    handleOnRowsChange,
    setGridContainer,
  } = useGridEditController({
    dataSource,
    setDataSource,
    columns: cdeColumns,
  });

  const handlePaste = actualHandlePaste as unknown as () => Record<
    string,
    string
  >;

  // Thêm hàng mới theo đúng chuẩn OpenMetadata
  const handleAddRow = useCallback(() => {
    setDataSource((prev) => [
      ...prev,
      {
        id: `${prev.length + 1}`,
        name: '',
        displayName: '',
        domain: '',
        dataSource: '',
        description: '',
        entityRelationship: '',
        owner: '',
        dataClassification: '',
        personalData: '',
        relatedRegulatoryDocuments: '',
        dataQualityRules: '',
        cdeVersion: '1.0',
        reviewer: '',
      },
    ]);
  }, [setDataSource]);

  // Xử lý khi người dùng tải tệp Excel lên
  const handleFileSelect = useCallback(
    async (file: File) => {
      setParsing(true);
      try {
        const result = await readAndValidateCDEExcel(
          file,
          existingTerms as GlossaryTerm[],
          allDomains,
          allTags,
          allUsers,
          allTeams
        );

        // Chuyển dữ liệu parsed thành dataSource cho DataGrid
        const rows: Record<string, string>[] = result.rows.map((r, idx) => ({
          id: `${idx + 1}`,
          name: r.name || '',
          displayName: r.displayName || '',
          domain: r.domain || '',
          dataSource: r.dataSource || '',
          description: r.description || '',
          entityRelationship: r.entityRelationship || '',
          owner: r.owner || '',
          dataClassification: r.dataClassification || '',
          personalData: r.personalData || '',
          relatedRegulatoryDocuments: r.relatedRegulatoryDocuments || '',
          dataQualityRules: r.dataQualityRules || '',
          cdeVersion: r.cdeVersion || '1.0',
          reviewer: r.reviewer || '',
        }));

        setDataSource(rows);
        setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
      } catch (err: any) {
        showErrorToast(
          err?.message ||
            t(
              'cde.parse-error',
              'Không thể đọc hoặc định dạng file Excel không đúng.'
            )
        );
      } finally {
        setParsing(false);
      }

      return false; // Ngăn upload mặc định của AntD
    },
    [existingTerms, allDomains, allTags, allUsers, allTeams, t]
  );

  // Điều hướng nút Trước / Quay lại
  const handleBack = useCallback(() => {
    if (activeStep === VALIDATION_STEP.UPDATE) {
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } else {
      setActiveStep(VALIDATION_STEP.UPLOAD);
    }
  }, [activeStep]);

  // Thẩm định dữ liệu từ Bước 2 để sang Bước 3 (Cập Nhật)
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

      // 1. Thẩm định Mã CDE
      const name = (rowCopy.name || '').trim();
      if (!name) {
        errors.push(
          t('message.field-is-required', {
            field: t('label.cde-code', 'Mã CDE quy chiếu'),
          })
        );
      } else {
        const lower = name.toLowerCase();
        if (seenNames.has(lower)) {
          errors.push(
            t('cde.code-duplicate-in-data', "Mã CDE '{{code}}' bị trùng lặp trong bảng", {
              code: name,
            })
          );
        } else {
          seenNames.add(lower);
        }
      }

      // 2. Thẩm định Tên thành tố CDE
      const displayName = (rowCopy.displayName || '').trim();
      if (!displayName) {
        errors.push(
          t('message.field-is-required', {
            field: t('label.cde-name', 'Tên thành tố CDE'),
          })
        );
      }

      // 3. Thẩm định Nhóm nghiệp vụ (Domain)
      const domain = (rowCopy.domain || '').trim();
      if (!domain) {
        errors.push(
          t('message.field-is-required', {
            field: t('label.domain', 'Miền'),
          })
        );
      } else if (allDomains.length > 0) {
        const isDomainValid = Boolean(findMatchingDomain(domain, allDomains));
        if (!isDomainValid) {
          errors.push(
            t(
              'message.domain-not-found',
              "Miền '{{domain}}' không tồn tại trên hệ thống",
              { domain }
            )
          );
        }
      }

      // 4. Thẩm định Nguồn dữ liệu (DataSource)
      const dataSourceVal = (rowCopy.dataSource || '').trim();
      if (dataSourceVal) {
        const dsRes = validateDataSourceValues(dataSourceVal, allTags as any);
        if (!dsRes.isValid) {
          errors.push(
            t(
              'message.datasource-not-found',
              "Nguồn dữ liệu '{{source}}' không tồn tại trên hệ thống",
              { source: dsRes.invalidSources.join(', ') }
            )
          );
        }
      }

      // 5. Thẩm định Phân loại dữ liệu (DataClassification)
      const dcVal = (rowCopy.dataClassification || '').trim();
      if (dcVal) {
        const dcRes = validateDataClassificationValue(dcVal, allTags as any);
        if (!dcRes.isValid) {
          errors.push(
            t(
              'message.data-classification-invalid',
              "Phân loại dữ liệu '{{value}}' không hợp lệ (hợp lệ: Công cộng, Nội bộ, Bí mật, Tối mật)",
              { value: dcRes.invalidValues.join(', ') }
            )
          );
        }
      }

      // 6. Thẩm định Dữ liệu cá nhân (PersonalData)
      const pdVal = (rowCopy.personalData || '').trim();
      if (pdVal) {
        const pdRes = validatePersonalDataValue(pdVal, allTags as any);
        if (!pdRes.isValid) {
          errors.push(
            t(
              'message.personal-data-invalid',
              "Dữ liệu cá nhân '{{value}}' không hợp lệ (hợp lệ: Có, Không, Cơ bản, Nhạy cảm)",
              { value: pdRes.invalidValue || pdVal }
            )
          );
        }
      }

      // 7. Thẩm định Chủ sở hữu dữ liệu (Owner)
      const ownerVal = (rowCopy.owner || '').trim();
      if (ownerVal && (allUsers.length > 0 || allTeams.length > 0)) {
        const ownerRes = validateUserOrTeamList(ownerVal, allUsers, allTeams);
        if (!ownerRes.isValid) {
          errors.push(
            t(
              'message.owner-not-found',
              "Chủ sở hữu '{{owner}}' không tồn tại trên hệ thống (Người dùng hoặc Nhóm)",
              { owner: ownerRes.invalidNames.join(', ') }
            )
          );
        }
      }

      // 8. Thẩm định Người kiểm soát (Reviewer)
      const reviewerVal = (rowCopy.reviewer || '').trim();
      if (reviewerVal && (allUsers.length > 0 || allTeams.length > 0)) {
        const revRes = validateUserOrTeamList(reviewerVal, allUsers, allTeams);
        if (!revRes.isValid) {
          errors.push(
            t(
              'message.reviewer-not-found',
              "Người kiểm soát '{{reviewer}}' không tồn tại trên hệ thống (Người dùng hoặc Nhóm)",
              { reviewer: revRes.invalidNames.join(', ') }
            )
          );
        }
      }

      // 9. Thẩm định Quy định chất lượng dữ liệu (DataQualityRules)
      const dqVal = (rowCopy.dataQualityRules || '').trim();
      if (dqVal) {
        const dqRes = validateDataQualityRulesValue(dqVal);
        if (!dqRes.isValid) {
          errors.push(
            t(
              'message.dq-rules-invalid',
              "Quy định chất lượng dữ liệu phải là 'Có' hoặc 'Không'"
            )
          );
        }
      }

      // 10. Thẩm định Phiên bản CDE (CDEVersion)
      const verVal = (rowCopy.cdeVersion || '').trim();
      if (verVal) {
        const verRes = validateCDEVersionValue(verVal);
        if (!verRes.isValid) {
          errors.push(
            t(
              'message.cde-version-invalid',
              "Phiên bản '{{version}}' không đúng định dạng (ví dụ: 1.0, 2.0)",
              { version: verVal }
            )
          );
        }
      }

      const isExisting = Boolean(name && existingMap.has(name.toLowerCase()));
      const existingTerm = name ? existingMap.get(name.toLowerCase()) : undefined;
      rowCopy.existingId = (existingTerm as any)?.id || '';
      rowCopy.isExisting = isExisting ? 'true' : 'false';

      if (errors.length > 0) {
        rowCopy.status = Status.Failure;
        rowCopy.details = errors.join('; ');
        failedCount++;
      } else {
        rowCopy.status = Status.Success;
        if (isExisting) {
          rowCopy.details =
            duplicatePolicy === 'update'
              ? t(
                  'cde.existing-record-update',
                  'Cập nhật ghi đè'
                )
              : t(
                  'cde.existing-record-skip',
                  'Bỏ qua (trùng mã)'
                );
        } else {
          rowCopy.details = t('label.valid', 'Hợp lệ');
        }
        passedCount++;
      }

      validatedRows.push(rowCopy);
    });

    setValidationData({
      numberOfRowsProcessed: dataSource.length,
      numberOfRowsPassed: passedCount,
      numberOfRowsFailed: failedCount,
    });
    setValidateDataSource(validatedRows);
    setStatusFilter('all');
    setActiveStep(VALIDATION_STEP.UPDATE);
  }, [dataSource, existingTerms, allDomains, allTags, allUsers, allTeams, duplicatePolicy, t]);

  // Cột hiển thị tại Bước 3 (Cập Nhật): có thêm cột Trạng thái Thẩm định
  const validateColumns: Column<Record<string, string>>[] = useMemo(
    () => [
      {
        key: 'status',
        name: t('label.status', 'Trạng thái'),
        width: 120,
        minWidth: 100,
        resizable: true,
        headerCellClass: 'cde-status-column-header',
        cellClass: 'cde-status-column-cell',
        renderCell: (data: RenderCellProps<Record<string, string>>) => {
          const isSuccess = data.row.status === Status.Success;

          return (
            <div className="d-flex items-center h-full">
              {isSuccess ? (
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
          );
        },
      },
      {
        key: 'details',
        name: t('label.details', 'Chi tiết'),
        width: 320,
        minWidth: 220,
        resizable: true,
        headerCellClass: 'cde-details-column-header',
        cellClass: 'cde-details-column-cell',
        renderCell: (data: RenderCellProps<Record<string, string>>) => {
          const isSuccess = data.row.status === Status.Success;
          const detailsText =
            data.row.details ||
            (isSuccess ? t('label.valid', 'Hợp lệ') : t('label.failed', 'Lỗi'));

          return (
            <Tooltip placement="topLeft" title={detailsText}>
              <span
                className={
                  isSuccess
                    ? 'text-success font-medium ellipsis-text'
                    : 'text-danger font-medium ellipsis-text'
                }>
                {detailsText}
              </span>
            </Tooltip>
          );
        },
      },
      ...cdeColumns.map((col) => ({
        ...col,
        editable: false,
        headerCellClass: undefined,
        cellClass: undefined,
      })),
    ],
    [cdeColumns, t]
  );

  // Dữ liệu hiển thị tại Bước 3 sau khi áp dụng bộ lọc trạng thái (Tất cả / Bị lỗi / Hợp lệ)
  const filteredValidateDataSource = useMemo(() => {
    if (statusFilter === 'failure') {
      return validateDataSource.filter((row) => row.status === Status.Failure);
    }
    if (statusFilter === 'success') {
      return validateDataSource.filter((row) => row.status === Status.Success);
    }

    return validateDataSource;
  }, [validateDataSource, statusFilter]);

  // Tiến hành lưu dữ liệu CDE vào backend
  const handleStartImport = async () => {
    if (!validationData || !fqn) {
      return;
    }

    const rowsToProcess = validateDataSource.filter(
      (r) => r.status === Status.Success
    );
    if (rowsToProcess.length === 0) {
      showErrorToast(
        t('cde.no-valid-rows', 'Không có bản ghi CDE hợp lệ nào để nạp dữ liệu.')
      );

      return;
    }

    setIsImporting(true);
    setIsCompleted(false);
    setImportProgress(0);
    setImportErrors([]);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errorsList: { row: number; name: string; reason: string }[] = [];
    const createdTermsList: { id: string; name: string }[] = [];

    const total = rowsToProcess.length;

    for (let idx = 0; idx < total; idx++) {
      const row = rowsToProcess[idx];
      const rowName = row.name || '';
      const rowDisplayName = row.displayName || rowName;
      setCurrentImportName(rowDisplayName);
      setImportProgress(Math.round(((idx + 1) / total) * 100));

      const isExisting = row.isExisting === 'true';

      if (isExisting) {
        if (duplicatePolicy === 'skip') {
          skippedCount++;
          continue;
        }

        try {
          const payload = transformRowToGlossaryTermPayload(
            {
              rowNumber: idx + 1,
              name: row.name,
              displayName: row.displayName,
              domain: row.domain,
              dataSource: row.dataSource,
              description: row.description,
              entityRelationship: row.entityRelationship,
              owner: row.owner,
              dataClassification: row.dataClassification,
              personalData: row.personalData,
              relatedRegulatoryDocuments: row.relatedRegulatoryDocuments,
              dataQualityRules: row.dataQualityRules,
              cdeVersion: row.cdeVersion || '1.0',
              reviewer: row.reviewer,
              status: EntityStatus.Draft,
              errors: [],
              warnings: [],
              isValid: true,
            },
            fqn,
            allDomains,
            allTags,
            allUsers,
            allTeams
          );

          if (row.existingId) {
            const patchOps: any[] = [
              { op: 'add', path: '/displayName', value: payload.displayName },
              { op: 'add', path: '/description', value: payload.description },
              { op: 'add', path: '/extension', value: payload.extension },
              { op: 'add', path: '/tags', value: payload.tags },
              { op: 'add', path: '/domains', value: payload.domains },
              { op: 'add', path: '/entityStatus', value: EntityStatus.Draft },
            ];
            if (payload.owners && payload.owners.length > 0) {
              patchOps.push({ op: 'add', path: '/owners', value: payload.owners });
            }
            if (payload.reviewers && payload.reviewers.length > 0) {
              patchOps.push({ op: 'add', path: '/reviewers', value: payload.reviewers });
            }
            await patchGlossaryTerm(row.existingId, patchOps);
            updatedCount++;
          } else {
            failedCount++;
            errorsList.push({
              row: idx + 1,
              name: rowName,
              reason: t(
                'cde.error-missing-existing-id',
                'Không tìm thấy ID của bản ghi CDE cần cập nhật.'
              ),
            });
          }
        } catch (error: any) {
          failedCount++;
          errorsList.push({
            row: idx + 1,
            name: rowName,
            reason: formatCDEImportErrorMessage(error, t, 'update'),
          });
        }
      } else {
        try {
          const payload = transformRowToGlossaryTermPayload(
            {
              rowNumber: idx + 1,
              name: row.name,
              displayName: row.displayName,
              domain: row.domain,
              dataSource: row.dataSource,
              description: row.description,
              entityRelationship: row.entityRelationship,
              owner: row.owner,
              dataClassification: row.dataClassification,
              personalData: row.personalData,
              relatedRegulatoryDocuments: row.relatedRegulatoryDocuments,
              dataQualityRules: row.dataQualityRules,
              cdeVersion: row.cdeVersion || '1.0',
              reviewer: row.reviewer,
              status: EntityStatus.Draft,
              errors: [],
              warnings: [],
              isValid: true,
            },
            fqn,
            allDomains,
            allTags,
            allUsers,
            allTeams
          );
          const newTerm = await addGlossaryTerm(payload);
          createdCount++;
          if (newTerm?.id) {
            createdTermsList.push({
              id: newTerm.id,
              name: newTerm.name || row.name,
            });
          }
        } catch (error: any) {
          failedCount++;
          errorsList.push({
            row: idx + 1,
            name: rowName,
            reason: formatCDEImportErrorMessage(error, t, 'create'),
          });
        }
      }
    }

    setImportErrors(errorsList);
    setCreatedTerms(createdTermsList);
    setIsSubmittingAll(false);
    setIsSubmittingAllSuccess(false);
    setImportStats({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
    });
    setIsImporting(false);
    setIsCompleted(true);
  };

  const handleBulkSubmitCreatedTerms = async () => {
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
  };

  const handleReset = () => {
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
  };

  return (
    <PageLayoutV1
      pageTitle={t('cde.import-title', 'Nhập danh sách CDE từ file Excel')}>
      <Row className="cde-import-page-container" gutter={[16, 16]}>
        {/* Header Breadcrumb */}
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbList} />
        </Col>

        {/* Stepper Header */}
        <Col span={24}>
          <Stepper activeStep={activeStep} steps={importSteps} />
        </Col>

        {/* BƯỚC 1: TẢI LÊN TỆP EXCEL */}
        {activeStep === VALIDATION_STEP.UPLOAD && (
          <Col span={24}>
            <Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleFileSelect}
              className="file-dragger-wrapper"
              data-testid="cde-upload-dragger"
              disabled={parsing}
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
                  {parsing ? (
                    t('cde.parsing-file', 'Đang đọc và thẩm định file Excel...')
                  ) : (
                    <span>
                      Kéo & Thả hoặc{' '}
                      <span className="browse-text">Duyệt tệp Excel (.xlsx)</span>{' '}
                      vào đây
                    </span>
                  )}
                </Typography.Text>
              </Space>
            </Dragger>

            {/* Xử lý khi trùng mã CDE kèm chú thích chi tiết */}
            <div className="m-t-md p-x-xs">
              <Row align="top" gutter={[16, 16]} justify="space-between">
                <Col md={18} xs={24}>
                  <Typography.Text className="d-block m-b-sm" strong>
                    {t('cde.duplicate-handling', 'Xử lý khi trùng mã CDE')}:
                  </Typography.Text>
                  <Radio.Group
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value)}>
                    <Space direction="vertical" size={10}>
                      <Radio value="skip">
                        <span className="font-medium">
                          {t('cde.skip-existing', 'Bỏ qua bản ghi trùng')}
                        </span>
                        <Typography.Text
                          className="d-block text-xs text-muted"
                          style={{ marginLeft: 24 }}
                          type="secondary">
                          {t(
                            'cde.skip-existing-desc',
                            'Giữ nguyên dữ liệu CDE đang có trên hệ thống, không thay đổi các bản ghi đã tồn tại.'
                          )}
                        </Typography.Text>
                      </Radio>
                      <Radio value="update">
                        <span className="font-medium">
                          {t(
                            'cde.overwrite-existing',
                            'Cập nhật ghi đè bản ghi'
                          )}
                        </span>
                        <Typography.Text
                          className="d-block text-xs text-muted"
                          style={{ marginLeft: 24 }}
                          type="secondary">
                          {t(
                            'cde.overwrite-existing-desc',
                            'Cập nhật thông tin mới từ tệp Excel vào các mã CDE đã tồn tại (chuyển sang trạng thái Bản nháp để chờ phê duyệt lại).'
                          )}
                        </Typography.Text>
                      </Radio>
                    </Space>
                  </Radio.Group>
                </Col>
                <Col className="text-right" md={6} xs={24}>
                  <Button
                    icon={<DownloadOutlined />}
                    type="link"
                    onClick={downloadCDEExcelTemplate}>
                    {t(
                      'cde.download-template-btn',
                      'Tải file Excel mẫu (.xlsx)'
                    )}
                  </Button>
                </Col>
              </Row>
            </div>

            <div className="m-t-lg p-b-md">
              <Button onClick={() => navigate(getGlossaryPath(fqn))}>
                {t('label.cancel', 'Hủy')}
              </Button>
            </div>
          </Col>
        )}

        {/* BƯỚC 2: XEM TRƯỚC SỬA (Đồng nhất OpenMetadata: DataGrid) */}
        {activeStep === VALIDATION_STEP.EDIT_VALIDATE && (
          <Col span={24}>
            <div className="om-rdg cde-import-rdg" ref={setGridContainer}>
              <DataGrid
                className="rdg-light"
                columns={cdeColumns}
                rows={dataSource}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onRowsChange={handleOnRowsChange}
              />
            </div>
          </Col>
        )}

        {/* BƯỚC 3: CẬP NHẬT (Đồng nhất OpenMetadata: ImportStatus + DataGrid thẩm định + Cập nhật) */}
        {activeStep === VALIDATION_STEP.UPDATE && (
          <>
            {!isCompleted ? (
              <>
                {isImporting ? (
                  <Col span={24}>
                    <Card className="text-center p-y-lg m-t-md">
                      <Space
                        align="center"
                        className="w-full justify-center"
                        direction="vertical"
                        size={20}>
                        <Typography.Title level={4}>
                          {t('cde.importing-title', 'Đang nạp dữ liệu CDE...')}
                        </Typography.Title>
                        <div style={{ width: 400 }}>
                          <Progress percent={importProgress} status="active" />
                        </div>
                        <Typography.Text type="secondary">
                          {t('label.processing', 'Đang xử lý')}:{' '}
                          <strong>{currentImportName}</strong>
                        </Typography.Text>
                      </Space>
                    </Card>
                  </Col>
                ) : (
                  <>
                    {validationData && (
                      <Col span={24}>
                        <div className="cde-validation-header d-flex justify-between items-center w-full flex-wrap gap-2">
                          <div
                            className={`cde-validation-summary-badge ${
                              validationData.numberOfRowsFailed > 0
                                ? 'has-error'
                                : 'is-success'
                            }`}>
                            {validationData.numberOfRowsFailed > 0 ? (
                              <>
                                <FailBadgeIcon height={16} width={16} />
                                <span>
                                  {t(
                                    'cde.validation-has-errors',
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
                                    'cde.validation-all-valid',
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
                              className="cde-status-filter-segmented"
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
                      <div className="om-rdg cde-import-rdg-step3">
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
                          'cde.close-and-view-list',
                          'Đóng & Quay lại danh mục CDE'
                        )}
                      </Button>,
                      <Button key="another" onClick={handleReset}>
                        {t('cde.import-another-file', 'Nhập tiếp file khác')}
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
                    title={t(
                      'cde.import-completed-title',
                      'Hoàn tất nạp dữ liệu CDE!'
                    )}
                  />
                </Card>
              </Col>
            )}
          </>
        )}

        {/* FOOTER ĐIỀU HƯỚNG BƯỚC 2 & BƯỚC 3 (Đồng nhất vị trí, cố định bên phải, không bị xê dịch) */}
        {(activeStep === VALIDATION_STEP.EDIT_VALIDATE ||
          (activeStep === VALIDATION_STEP.UPDATE &&
            !isImporting &&
            !isCompleted)) && (
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
                <Button disabled={isImporting} onClick={handleBack}>
                  {t('label.previous', 'Trước')}
                </Button>
                {activeStep === VALIDATION_STEP.EDIT_VALIDATE ? (
                  <Button
                    className="cde-action-btn"
                    data-testid="next-button"
                    disabled={dataSource.length === 0}
                    type="primary"
                    onClick={handleValidate}>
                    {t('label.next', 'Tiếp theo')}
                  </Button>
                ) : (
                  <Button
                    className="cde-action-btn"
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

export default CDEImportPage;
