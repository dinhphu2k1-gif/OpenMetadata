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
  RollbackOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconExternalLink } from '../../assets/svg/external-links.svg';
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
import Table from '../../components/common/Table/Table';
import { usePaging } from '../../hooks/paging/usePaging';
import {
  renderDictionaryOwnerList,
  renderDictionaryMarkdown,
  renderDictionaryPastelTag,
  renderDictionaryStatusBadge,
} from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';

export interface TechnicalFieldItem {
  id: string;
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
  status?: string;
  serviceName: string;
  cdeCode?: string;
  cdeName?: string;
  cdeFqn?: string;
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
}

export const TechnicalDictionaryTable: React.FC<TechnicalDictionaryTableProps> = ({
  data,
  isLoading,
  canEdit = true,
  canApprove = true,
  canReject = true,
  canRevoke = true,
  showActions = true,
  extraTableFilters,
  extraTableFiltersClassName,
  customPaginationProps: externalPaginationProps,
  onEdit,
  onApprove,
  onReject,
  onRevoke,
}) => {
  const { t } = useTranslation();

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
      pageSizeOptions: [
        PAGE_SIZE_BASE,
        PAGE_SIZE_MEDIUM,
        PAGE_SIZE_LARGE,
      ],
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
        width: 150,
        render: (_, record) => {
          if (!record.databaseName) {
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
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
        width: 150,
        render: (_, record) => {
          if (!record.schemaName) {
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
          }

          return record.databaseSchemaFqn ? (
            <Link
              className="tech-entity-link"
              title={record.schemaDisplayName || record.schemaName}
              to={getEntityDetailsPath(
                EntityType.DATABASE_SCHEMA,
                record.databaseSchemaFqn
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
        width: 160,
        render: (_, record) => (
          <span className="tech-column-name" title={record.columnName}>
            {record.columnName}
          </span>
        ),
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
          record.cdeCode ? (
            <Link
              className="cde-code-link cursor-pointer"
              data-testid={`cde-code-${record.cdeCode}`}
              title={record.cdeName || record.cdeCode}
              to={getGlossaryPath(
                record.cdeFqn || `Data Dictionary.${record.cdeCode}`
              )}>
              {record.cdeCode}
            </Link>
          ) : (
            <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
          ),
      },
      {
        title: t('label.cde-name', { defaultValue: 'Tên thành tố CDE' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        width: 220,
        render: (cdeName: string) =>
          renderDictionaryMarkdown(cdeName),
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
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
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
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
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
          timeliness ? (
            renderDictionaryPastelTag(timeliness, 'frequency')
          ) : (
            NO_DATA_PLACEHOLDER
          ),
      },
      {
        title: t('label.system-owner', { defaultValue: 'Chủ sở hữu hệ thống' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        width: 180,
        render: (owner: string) =>
          renderDictionaryOwnerList(owner, 'tech-owner'),
      },
      {
        title: t('label.description', { defaultValue: 'Mô tả' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 240,
        render: (description: string) =>
          renderDictionaryMarkdown(description),
      },
      {
        title: t('label.status', { defaultValue: 'Trạng thái' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        width: 140,
        render: (status: string, record) =>
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
        width: 120,
        render: (_, record) => {
          const currentStatus = record.status || 'Draft';
          const isPending =
            currentStatus === 'In Review' ||
            currentStatus === 'InReview' ||
            currentStatus === 'Pending';
          const isApproved = currentStatus === 'Approved';

          return (
            <div className="d-flex items-center gap-2">
              {canEdit && (
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
              {canApprove && isPending && (
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
              {canReject && isPending && (
                <Tooltip
                  title={t('label.reject', { defaultValue: 'Từ chối' })}>
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
              <Tooltip
                title={t('label.view-table-details', {
                  defaultValue: 'Xem chi tiết bảng',
                })}>
                <Link
                  target="_blank"
                  to={getEntityDetailsPath(
                    EntityType.TABLE,
                    record.tableFqn,
                    EntityTabs.SCHEMA
                  )}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    data-testid={`view-table-${record.tableName}`}
                    icon={<IconExternalLink height={14} width={14} />}
                    size="small"
                    type="text"
                  />
                </Link>
              </Tooltip>
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
  ]);

  return (
    <Table
      resizableColumns
      className="cde-glossary-terms-table"
      containerClassName="cde-glossary-table-container"
      columns={columns}
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
    />
  );
};

export default TechnicalDictionaryTable;
