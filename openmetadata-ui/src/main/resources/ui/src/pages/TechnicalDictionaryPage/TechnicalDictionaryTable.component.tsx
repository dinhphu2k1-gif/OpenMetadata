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
  EditOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button, Popconfirm, Tag, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { TagLabel } from 'generated/type/tagLabel';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../assets/svg/external-links.svg';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS,
  TECHNICAL_DICTIONARY_TABLE_PREFERENCE_KEY,
} from '../../constants/TechnicalDictionary.constants';
import { getEntityDetailsPath, getGlossaryPath } from '../../utils/RouterUtils';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import StatusBadge from '../../components/common/StatusBadge/StatusBadge.component';
import Table from '../../components/common/Table/Table';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { EntityStatusClass } from '../../utils/EntityStatusUtils';

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
  onEdit,
  onApprove,
  onReject,
  onRevoke,
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<TechnicalFieldItem> = useMemo(
    () => [
      {
        title: t('label.database-name', { defaultValue: 'Database Name' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
        width: 150,
        render: (_, record) => {
          if (!record.databaseName) {
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
          }

          return record.databaseFqn ? (
            <Link
              className="tech-code-link"
              title={record.databaseDisplayName || record.databaseName}
              to={getEntityDetailsPath(
                EntityType.DATABASE,
                record.databaseFqn
              )}>
              {record.databaseDisplayName || record.databaseName}
            </Link>
          ) : (
            <span
              className="tech-code-font"
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
              className="tech-code-link"
              title={record.schemaDisplayName || record.schemaName}
              to={getEntityDetailsPath(
                EntityType.DATABASE_SCHEMA,
                record.databaseSchemaFqn
              )}>
              {record.schemaDisplayName || record.schemaName}
            </Link>
          ) : (
            <span
              className="tech-code-font"
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
            className="tech-code-link"
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
          <span className="tech-code-font font-semibold" title={record.columnName}>
            {record.columnName}
          </span>
        ),
      },
      {
        title: t('label.source', { defaultValue: 'Hệ thống nguồn' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SERVICE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SERVICE_NAME,
        width: 130,
        render: (serviceName: string) => (
          <Tag className="tech-source-pill">{serviceName || NO_DATA_PLACEHOLDER}</Tag>
        ),
      },
      {
        title: t('label.cde-code-ref', { defaultValue: 'Mã CDE quy chiếu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_CODE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_CODE,
        width: 150,
        render: (_, record) => {
          if (!record.cdeCode) {
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
          }

          const targetFqn = record.cdeFqn || `Data Dictionary.${record.cdeCode}`;

          return (
            <Link to={getGlossaryPath(targetFqn)}>
              <Tag className="tech-cde-pill">
                <span>🔗 {record.cdeCode}</span>
              </Tag>
            </Link>
          );
        },
      },
      {
        title: t('label.cde-name', { defaultValue: 'Tên thành tố CDE' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CDE_NAME,
        width: 220,
        render: (cdeName: string) => {
          if (!cdeName) {
            return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
          }

          return (
            <Typography.Paragraph
              className="m-0"
              ellipsis={{ tooltip: cdeName, rows: 2 }}>
              {cdeName}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('label.data-type', { defaultValue: 'Kiểu dữ liệu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATA_TYPE,
        width: 130,
        render: (_, record) => (
          <Tag className="tech-type-pill">
            {record.dataTypeDisplay || record.dataType || NO_DATA_PLACEHOLDER}
          </Tag>
        ),
      },
      {
        title: t('label.field-length-decimal', { defaultValue: 'Độ dài' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.FIELD_LENGTH,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.FIELD_LENGTH,
        width: 120,
        render: (_, record) => {
          if (record.dataLength !== undefined && record.dataLength !== null) {
            if (record.scale !== undefined && record.scale !== null && record.scale > 0) {
              return `${record.dataLength} (${record.scale})`;
            }

            return `${record.dataLength}`;
          }
          if (record.scale !== undefined && record.scale !== null) {
            return `(${record.scale})`;
          }

          return NO_DATA_PLACEHOLDER;
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
            type.includes('Atomic') ||
            type.includes('Nguyên tố') ||
            type.includes('nguyen to');

          return (
            <Tag
              className={classNames('tech-pill', {
                'tech-pill-atomic': isAtomic,
                'tech-pill-transformed': !isAtomic,
              })}>
              {record.elementTypeName || type}
            </Tag>
          );
        },
      },
      {
        title: t('label.field-generation-type', { defaultValue: 'Loại trường dữ liệu' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.GENERATION_TYPE,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.GENERATION_TYPE,
        width: 170,
        render: (_, record) => {
          const genType = record.generationType || '';
          if (!genType) {
            return NO_DATA_PLACEHOLDER;
          }
          const isSystem = genType.includes('SystemGenerated') || genType.includes('Tự sinh');
          const isDerived = genType.includes('SystemDerived') || genType.includes('Tính toán');
          const isManual = genType.includes('Manual') || genType.includes('Nhập');
          const isUpload = genType.includes('Upload') || genType.includes('Tải');

          return (
            <Tag
              className={classNames('tech-pill', {
                'tech-pill-system-generated': isSystem,
                'tech-pill-system-derived': isDerived,
                'tech-pill-manual': isManual,
                'tech-pill-upload': isUpload,
              })}>
              {record.generationTypeName || genType}
            </Tag>
          );
        },
      },
      {
        title: t('label.data-creation-method', { defaultValue: 'Phương thức tạo' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CREATION_METHOD,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.CREATION_METHOD,
        width: 140,
        render: (_, record) =>
          record.creationMethodName || record.creationMethod || NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.timeliness', { defaultValue: 'Thời gian' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TIMELINESS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TIMELINESS,
        width: 110,
        render: (timeliness: string) =>
          timeliness ? (
            <Tag className="tech-pill-time">{timeliness}</Tag>
          ) : (
            NO_DATA_PLACEHOLDER
          ),
      },
      {
        title: t('label.system-owner', { defaultValue: 'Chủ sở hữu hệ thống' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER,
        width: 180,
        render: (owner: string) => owner || NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.description', { defaultValue: 'Mô tả trường' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 240,
        render: (description: string) =>
          description ? (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant
              markdown={description}
              maxLength={80}
            />
          ) : (
            NO_DATA_PLACEHOLDER
          ),
      },
      {
        title: t('label.status', { defaultValue: 'Trạng thái' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
        width: 140,
        render: (status: string, record) => {
          const rawStatus = (status || record.status || 'Approved').trim();
          let entityStatus: EntityStatus = EntityStatus.Approved;
          if (rawStatus === 'Draft') {
            entityStatus = EntityStatus.Draft;
          } else if (
            rawStatus === 'In Review' ||
            rawStatus === 'InReview' ||
            rawStatus === 'Pending'
          ) {
            entityStatus = EntityStatus.InReview;
          } else if (rawStatus === 'Rejected') {
            entityStatus = EntityStatus.Rejected;
          } else if (rawStatus === 'Deprecated') {
            entityStatus = EntityStatus.Deprecated;
          }

          return (
            <StatusBadge
              dataTestId={`${record.columnName}-status`}
              label={entityStatus}
              status={EntityStatusClass[entityStatus]}
            />
          );
        },
      },
      {
        title: t('label.action-plural', { defaultValue: 'Thao tác' }),
        dataIndex: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
        key: TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
        width: 140,
        fixed: 'right',
        render: (_, record) => {
          const isInReview =
            record.status === 'In Review' ||
            record.status === 'InReview' ||
            record.status === 'Pending';
          const isApproved =
            !isInReview && (record.status || 'Approved').trim() === 'Approved';

          return (
            <div className="d-flex items-center gap-2">
              {canEdit && onEdit && (
                <Tooltip title={t('label.edit', { defaultValue: 'Chỉnh sửa' })}>
                  <Button
                    className="d-flex items-center justify-center p-0"
                    data-testid={`edit-btn-${record.columnName}`}
                    icon={<EditOutlined style={{ fontSize: 13, color: '#1890ff' }} />}
                    size="small"
                    type="text"
                    onClick={() => onEdit(record)}
                  />
                </Tooltip>
              )}
              {canApprove && isInReview && onApprove && (
                <Popconfirm
                  cancelText={t('label.cancel', { defaultValue: 'Hủy' })}
                  okText={t('label.approve', { defaultValue: 'Phê duyệt' })}
                  title={t('label.confirm-approve-title', {
                    defaultValue: 'Phê duyệt trường này?',
                  })}
                  onConfirm={() => onApprove(record)}>
                  <Tooltip title={t('label.approve', { defaultValue: 'Phê duyệt' })}>
                    <Button
                      className="d-flex items-center justify-center p-0"
                      data-testid={`approve-btn-${record.columnName}`}
                      icon={<CheckOutlined style={{ fontSize: 13, color: '#52c41a' }} />}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                </Popconfirm>
              )}
              {canReject && isInReview && onReject && (
                <Popconfirm
                  cancelText={t('label.cancel', { defaultValue: 'Hủy' })}
                  okText={t('label.reject', { defaultValue: 'Từ chối' })}
                  title={t('label.confirm-reject-title', {
                    defaultValue: 'Từ chối trường này?',
                  })}
                  onConfirm={() => onReject(record)}>
                  <Tooltip title={t('label.reject', { defaultValue: 'Từ chối' })}>
                    <Button
                      className="d-flex items-center justify-center p-0"
                      data-testid={`reject-btn-${record.columnName}`}
                      icon={<CloseOutlined style={{ fontSize: 13, color: '#ff4d4f' }} />}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                </Popconfirm>
              )}
              {canRevoke && isApproved && onRevoke && (
                <Popconfirm
                  cancelText={t('label.cancel', { defaultValue: 'Hủy' })}
                  okText={t('label.revoke-approval', { defaultValue: 'Hủy duyệt' })}
                  title={t('label.confirm-revoke-approval-title', {
                    defaultValue: 'Hủy phê duyệt trường này?',
                  })}
                  onConfirm={() => onRevoke(record)}>
                  <Tooltip title={t('label.revoke-approval', { defaultValue: 'Hủy phê duyệt' })}>
                    <Button
                      className="d-flex items-center justify-center p-0"
                      data-testid={`revoke-btn-${record.columnName}`}
                      icon={<UndoOutlined style={{ fontSize: 13, color: '#fa8c16' }} />}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                </Popconfirm>
              )}
              <Tooltip title={t('label.view-table-details', { defaultValue: 'Xem chi tiết bảng' })}>
                <Link
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
      },
    ],
    [t]
  );

  return (
    <Table
      resizableColumns
      columns={columns}
      customPaginationProps={{
        pageSizeOptions: ['15', '25', '50', '100'],
      }}
      data-testid="technical-dictionary-table"
      dataSource={data}
      defaultVisibleColumns={TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS}
      entityType={TECHNICAL_DICTIONARY_TABLE_PREFERENCE_KEY}
      loading={isLoading}
      rowKey="id"
      size="small"
      staticVisibleColumns={TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS}
    />
  );
};

export default TechnicalDictionaryTable;
