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
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  RollbackOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { TagLabel } from '../../generated/type/tagLabel';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import {
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS,
  TECHNICAL_DICTIONARY_TABLE_PREFERENCE_KEY,
} from '../../constants/TechnicalDictionary.constants';
import { getEntityDetailsPath, getGlossaryPath } from '../../utils/RouterUtils';
import {
  NextPreviousProps,
  PagingHandlerParams,
} from '../../components/common/NextPrevious/NextPrevious.interface';
import SurvivorshipBadge from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component';
import { renderCDEReleaseVersionType } from '../../components/Glossary/GlossaryTermTab/CDEGlossaryTableColumns';
import Table from '../../components/common/Table/Table';
import { usePaging } from '../../hooks/paging/usePaging';
import {
  renderDictionaryOwnerList,
  renderDictionaryMarkdown,
  renderDictionaryPastelTag,
  renderDictionaryStatusBadge,
} from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import { getBusinessVersion } from '../../utils/BusinessVersionUtils';

export interface TechnicalFieldItem {
  id: string;
  parentBusinessVersion?: string;
  catalogStatus?: EntityStatus;
  historical?: boolean;
  businessVersion?: string;
  releaseVersionType?: string;
  workingRevision?: number;
  databaseName?: string;
  databaseDisplayName?: string;
  databaseFqn?: string;
  schemaName?: string;
  schemaDisplayName?: string;
  schemaFqn?: string;
  tableId?: string;
  tableName: string;
  tableDisplayName?: string;
  tableFqn: string;
  columnName: string;
  columnDisplayName?: string;
  columnFqn?: string;
  status?: EntityStatus;
  serviceName: string;
  cdeCode?: string;
  cdeName?: string;
  cdeFqn?: string;
  cdeTermId?: string;
  cdeSnapshotId?: string;
  cdeBusinessVersion?: string;
  cdeParentBusinessVersion?: string;
  dataDictionaryVersionId?: string;
  dataType: string;
  dataTypeDisplay: string;
  dataLength?: number;
  scale?: number;
  precision?: number;
  elementType?: string;
  elementTypeName?: string;
  generationType?: string;
  generationTypeName?: string;
  creationMethod?: string;
  creationMethodName?: string;
  timeliness?: string;
  systemOwner?: string;
  survivorshipRank?: number;
  survivorshipNote?: string;
  description?: string;
  tags?: TagLabel[];
}

interface TechnicalDictionaryTableProps {
  data: TechnicalFieldItem[];
  isLoading: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canRevoke?: boolean;
  canSubmit?: boolean;
  canReopen?: boolean;
  canCreateVersion?: boolean;
  showActions?: boolean;
  extraTableFilters?: React.ReactNode;
  extraTableFiltersClassName?: string;
  customPaginationProps?: NextPreviousProps & {
    showPagination: boolean;
  };
  onRefresh?: () => void;
  onEdit?: (item: TechnicalFieldItem) => void;
  onApprove?: (item: TechnicalFieldItem) => void;
  onReject?: (item: TechnicalFieldItem) => void;
  onRevoke?: (item: TechnicalFieldItem) => void;
  onSubmit?: (item: TechnicalFieldItem) => void;
  onReopen?: (item: TechnicalFieldItem) => void;
  onCreateVersion?: (item: TechnicalFieldItem) => void;
}

export const TechnicalDictionaryTable: React.FC<
  TechnicalDictionaryTableProps
> = ({
  data,
  isLoading,
  canEdit = true,
  canApprove = true,
  canReject = true,
  canRevoke = true,
  canSubmit = true,
  canReopen = true,
  canCreateVersion = true,
  showActions = true,
  extraTableFilters,
  extraTableFiltersClassName,
  customPaginationProps: externalPaginationProps,
  onEdit,
  onApprove,
  onReject,
  onRevoke,
  onSubmit,
  onReopen,
  onCreateVersion,
}) => {
  const { t } = useTranslation();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const {
    currentPage,
    pageSize,
    showPagination,
    paging,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging(PAGE_SIZE_BASE);

  useEffect(() => {
    if (!externalPaginationProps) {
      handlePagingChange({ total: data.length });
      const maxPage = Math.max(1, Math.ceil(data.length / pageSize));
      if (currentPage > maxPage) {
        handlePageChange(maxPage, { cursorType: null, cursorValue: undefined });
      }
    }
  }, [externalPaginationProps, data.length, pageSize]);

  const paginatedData = useMemo(() => {
    if (externalPaginationProps) {
      return data;
    }
    const start = (currentPage - 1) * pageSize;

    return data.slice(start, start + pageSize);
  }, [externalPaginationProps, data, currentPage, pageSize]);

  const handlePaginationChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page, { cursorType: null, cursorValue: undefined });
    },
    [handlePageChange]
  );

  const localPaginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isNumberBased: true,
      isLoading,
      pageSize,
      paging,
      pagingHandler: handlePaginationChange,
      onShowSizeChange: handlePageSizeChange,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
    }),
    [
      currentPage,
      showPagination,
      isLoading,
      pageSize,
      paging,
      handlePaginationChange,
      handlePageSizeChange,
    ]
  );

  const activePaginationProps = externalPaginationProps || localPaginationProps;

  const columns: ColumnsType<TechnicalFieldItem> = useMemo(() => {
    const baseColumns: ColumnsType<TechnicalFieldItem> = [
      {
        title: t('label.database-name', { defaultValue: 'Tên cơ sở dữ liệu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
        fixed: 'left',
        width: 150,
        render: (_, record) => {
          if (!record.databaseName) {
            return (
              <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
            );
          }

          return record.databaseFqn ? (
            <Link
              className="tech-entity-link"
              title={record.databaseDisplayName || record.databaseName}
              to={getEntityDetailsPath(
                EntityType.DATABASE,
                record.databaseFqn
              )}>
              {record.databaseDisplayName || record.databaseName}
            </Link>
          ) : (
            <span
              className="tech-text-muted"
              title={record.databaseDisplayName || record.databaseName}>
              {record.databaseDisplayName || record.databaseName}
            </span>
          );
        },
      },
      {
        title: t('label.schema-name', { defaultValue: 'Schema Name' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SCHEMA_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SCHEMA_NAME,
        fixed: 'left',
        width: 130,
        render: (_, record) => {
          if (!record.schemaName) {
            return (
              <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
            );
          }

          return record.schemaFqn ? (
            <Link
              className="tech-entity-link"
              title={record.schemaDisplayName || record.schemaName}
              to={getEntityDetailsPath(
                EntityType.DATABASE_SCHEMA,
                record.schemaFqn
              )}>
              {record.schemaDisplayName || record.schemaName}
            </Link>
          ) : (
            <span
              className="tech-text-muted"
              title={record.schemaDisplayName || record.schemaName}>
              {record.schemaDisplayName || record.schemaName}
            </span>
          );
        },
      },
      {
        title: t('label.table-name', { defaultValue: 'Tên Bảng' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TABLE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TABLE_NAME,
        fixed: 'left',
        width: 190,
        render: (_, record) => (
          <Link
            className="tech-entity-link"
            title={record.tableName}
            to={getEntityDetailsPath(
              EntityType.TABLE,
              record.tableFqn,
              EntityTabs.SCHEMA
            )}>
            {record.tableName}
          </Link>
        ),
      },
      {
        title: t('label.column-name', { defaultValue: 'Tên cột' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
        fixed: 'left',
        width: 160,
        render: (_, record) => (
          <span className="tech-column-name" title={record.columnName}>
            {record.columnName}
          </span>
        ),
      },
      {
        title: t('label.data-owner', { defaultValue: 'Chủ sở hữu dữ liệu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        width: 180,
        render: (owner: string) =>
          renderDictionaryOwnerList(owner, 'tech-owner'),
      },
      {
        title: t('label.source', { defaultValue: 'Nguồn' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SERVICE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SERVICE_NAME,
        width: 130,
        render: (serviceName: string) =>
          serviceName ? (
            renderDictionaryPastelTag(serviceName, 'source')
          ) : (
            <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
          ),
      },
      {
        title: t('label.cde-code-ref', { defaultValue: 'Mã CDE quy chiếu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_CODE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_CODE,
        width: 150,
        render: (_, record) =>
          record.cdeCode && record.cdeFqn ? (
            <Link
              className="cde-code-link cursor-pointer"
              data-testid={`cde-code-${record.cdeCode}`}
              title={record.cdeName || record.cdeCode}
              to={getGlossaryPath(record.cdeFqn)}>
              {record.cdeCode}
            </Link>
          ) : record.cdeCode ? (
            <span title={record.cdeName || record.cdeCode}>
              {record.cdeCode}
            </span>
          ) : (
            <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
          ),
      },
      {
        title: t('label.cde-name', { defaultValue: 'Tên thành tố CDE' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        width: 220,
        render: (cdeName: string) => renderDictionaryMarkdown(cdeName),
      },
      {
        title: 'Thứ hạng (Rank)',
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SURVIVORSHIP_RANK,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SURVIVORSHIP_RANK,
        width: 170,
        sorter: (a, b) =>
          (a.survivorshipRank ?? 9999) - (b.survivorshipRank ?? 9999),
        render: (_, record) => {
          if (!record.survivorshipRank) {
            return (
              <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
            );
          }

          return (
            <SurvivorshipBadge
              rule={{
                assetFqn: record.columnFqn || record.id,
                rank: record.survivorshipRank,
                note: record.survivorshipNote,
              }}
            />
          );
        },
      },
      {
        title: t('label.data-type', { defaultValue: 'Loại dữ liệu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATA_TYPE,
        width: 130,
        render: (_, record) => {
          const type = record.dataTypeDisplay || record.dataType;
          if (!type) {
            return (
              <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
            );
          }

          return renderDictionaryPastelTag(type, 'classification');
        },
      },
      {
        title: t('label.data-element-type', { defaultValue: 'Loại thành tố' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ELEMENT_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ELEMENT_TYPE,
        width: 160,
        render: (_, record) => {
          const type = record.elementType || '';
          if (!type) {
            return NO_DATA_PLACEHOLDER;
          }
          const isAtomic =
            type === 'Atomic' ||
            type.includes('Nguyên tố') ||
            type.includes('nguyen to');

          return renderDictionaryPastelTag(
            record.elementTypeName || type,
            isAtomic ? 'atomic' : 'transformed'
          );
        },
      },
      {
        title: t('label.generation-type', {
          defaultValue: 'Loại trường dữ liệu',
        }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.GENERATION_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.GENERATION_TYPE,
        width: 180,
        render: (_, record) => {
          const genType = record.generationType || '';
          if (!genType) {
            return NO_DATA_PLACEHOLDER;
          }
          const isSystem =
            genType.includes('SystemGenerated') || genType.includes('Tự sinh');
          const isDerived =
            genType.includes('SystemDerived') || genType.includes('Tính toán');
          const isManual =
            genType.includes('Manual') || genType.includes('Nhập');
          const isUpload =
            genType.includes('Upload') || genType.includes('Tải');

          let variant = 'classification';
          if (isSystem) {
            variant = 'quality';
          } else if (isDerived) {
            variant = 'source';
          } else if (isManual) {
            variant = 'quality';
          } else if (isUpload) {
            variant = 'personal';
          }

          return renderDictionaryPastelTag(
            record.generationTypeName || genType,
            variant
          );
        },
      },
      {
        title: t('label.creation-method', { defaultValue: 'Phương thức tạo' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CREATION_METHOD,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CREATION_METHOD,
        width: 160,
        render: (creationMethod: string, record) =>
          record.creationMethodName || creationMethod || NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.timeliness', { defaultValue: 'Thời gian' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TIMELINESS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TIMELINESS,
        width: 110,
        render: (timeliness: string) =>
          timeliness
            ? renderDictionaryPastelTag(timeliness, 'frequency')
            : NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.description', { defaultValue: 'Mô tả' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 240,
        render: (description: string) => renderDictionaryMarkdown(description),
      },
      {
        title: t('label.version', {
          defaultValue: 'Phiên bản',
        }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.VERSION,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.VERSION,
        width: 120,
        render: (version: string) =>
          version ? getBusinessVersion(version) : NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.release-version-type', {
          defaultValue: 'Loại phiên bản phát hành',
        }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.RELEASE_VERSION_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.RELEASE_VERSION_TYPE,
        width: 190,
        render: (releaseVersionType: string, record) =>
          renderCDEReleaseVersionType(
            releaseVersionType,
            record.businessVersion
          ),
      },
      {
        title: t('label.status', { defaultValue: 'Trạng thái' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        width: 140,
        render: (status: EntityStatus, record) =>
          renderDictionaryStatusBadge(
            status || record.status,
            `${record.columnName}-status`
          ),
      },
    ];

    if (showActions) {
      baseColumns.push({
        title: t('label.action-plural', { defaultValue: 'Thao tác' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
        fixed: 'right',
        width: 96,
        render: (_, record) => {
          const currentStatus = record.status || EntityStatus.Draft;
          const isInReview = currentStatus === EntityStatus.InReview;
          const isApproved = currentStatus === EntityStatus.Approved;
          const isDraft = currentStatus === EntityStatus.Draft;
          const isRejected = currentStatus === EntityStatus.Rejected;
          const isReadOnlyCatalog =
            record.historical || record.catalogStatus === EntityStatus.Archived;

          return (
            <div className="d-flex items-center gap-2">
              {canEdit && isDraft && !isReadOnlyCatalog && (
                <Tooltip title={t('label.edit', { defaultValue: 'Sửa' })}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    data-testid={`edit-btn-${record.columnName}`}
                    icon={<EditIcon height={14} width={14} />}
                    size="small"
                    type="text"
                    onClick={() => onEdit?.(record)}
                  />
                </Tooltip>
              )}
              {canSubmit && isDraft && !isReadOnlyCatalog && (
                <Tooltip
                  title={t('label.submit-for-review', {
                    defaultValue: 'Gửi duyệt',
                  })}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    icon={<SendOutlined />}
                    size="small"
                    type="text"
                    onClick={() => onSubmit?.(record)}
                  />
                </Tooltip>
              )}
              {canApprove && isInReview && (
                <Tooltip
                  title={t('label.approve', { defaultValue: 'Phê duyệt' })}>
                  <Button
                    className="d-flex items-center justify-center p-0 text-success"
                    data-testid={`approve-btn-${record.columnName}`}
                    icon={<CheckOutlined height={14} width={14} />}
                    size="small"
                    type="text"
                    onClick={() => onApprove?.(record)}
                  />
                </Tooltip>
              )}
              {canReject && isInReview && (
                <Tooltip title={t('label.reject', { defaultValue: 'Từ chối' })}>
                  <Button
                    className="d-flex items-center justify-center p-0 text-danger"
                    data-testid={`reject-btn-${record.columnName}`}
                    icon={<CloseOutlined height={14} width={14} />}
                    size="small"
                    type="text"
                    onClick={() => onReject?.(record)}
                  />
                </Tooltip>
              )}
              {canRevoke && isApproved && (
                <Tooltip
                  title={t('label.revoke-approval', {
                    defaultValue: 'Thu hồi phê duyệt',
                  })}>
                  <Button
                    className="d-flex items-center justify-center p-0 text-warning"
                    data-testid={`revoke-btn-${record.columnName}`}
                    icon={<RollbackOutlined height={14} width={14} />}
                    size="small"
                    type="text"
                    onClick={() => onRevoke?.(record)}
                  />
                </Tooltip>
              )}
              {canReopen && isRejected && !isReadOnlyCatalog && (
                <Tooltip title={t('label.reopen', { defaultValue: 'Mở lại' })}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    icon={<RollbackOutlined />}
                    size="small"
                    type="text"
                    onClick={() => onReopen?.(record)}
                  />
                </Tooltip>
              )}
              {canCreateVersion && isApproved && !isReadOnlyScope && (
                <Tooltip
                  title={t('label.create-new-version', {
                    defaultValue: 'Tạo phiên bản mới',
                  })}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    icon={<PlusOutlined />}
                    size="small"
                    type="text"
                    onClick={() => onCreateVersion?.(record)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [
    t,
    showActions,
    canEdit,
    onEdit,
    canApprove,
    onApprove,
    canReject,
    onReject,
    canRevoke,
    onRevoke,
    canSubmit,
    onSubmit,
    canReopen,
    onReopen,
    canCreateVersion,
    onCreateVersion,
  ]);

  // Ant Design calculates the sticky scrollbar from the table's first measured
  // width. Columns are populated after the initial render, so request a layout
  // recalculation as soon as rows/columns are available; otherwise the bar can
  // remain hidden until the user scrolls the page.
  useLayoutEffect(() => {
    if (!tableContainerRef.current || isLoading || paginatedData.length === 0) {
      return;
    }
    const firstFrame = globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => {
        globalThis.dispatchEvent(new Event('resize'));
      });
    });

    return () => globalThis.cancelAnimationFrame(firstFrame);
  }, [columns, isLoading, paginatedData.length]);

  return (
    <div
      className="glossary-terms-scroll-container"
      ref={tableContainerRef}
      style={{ position: 'relative' }}>
      <Table
        resizableColumns
        className="cde-glossary-terms-table glossary-terms-table"
        columns={columns}
        containerClassName="cde-glossary-table-container"
        customPaginationProps={activePaginationProps}
        data-testid="technical-dictionary-table"
        dataSource={paginatedData}
        defaultVisibleColumns={TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS}
        entityType={TECHNICAL_DICTIONARY_TABLE_PREFERENCE_KEY}
        extraTableFilters={extraTableFilters}
        extraTableFiltersClassName={extraTableFiltersClassName}
        loading={isLoading}
        pagination={false}
        rowKey="id"
        size="small"
        staticVisibleColumns={TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS}
        sticky={{
          offsetScroll: 0,
          getContainer: () =>
            tableContainerRef.current?.closest<HTMLElement>(
              '.page-layout-v1-vertical-scroll'
            ) ?? document.body,
        }}
      />
    </div>
  );
};

export default TechnicalDictionaryTable;
