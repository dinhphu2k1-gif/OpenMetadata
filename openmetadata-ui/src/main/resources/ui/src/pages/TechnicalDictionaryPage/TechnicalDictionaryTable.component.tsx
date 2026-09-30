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
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  RollbackOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Button, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import {
  renderDictionaryMarkdown,
  renderDictionaryOwnerList,
  renderDictionaryPastelTag,
  renderDictionaryStatusBadge,
} from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import SurvivorshipBadge from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component';
import { renderCDEReleaseVersionType } from '../../components/Glossary/GlossaryTermTab/CDEGlossaryTableColumns';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY,
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS as KEYS,
  TECHNICAL_PAGE_SIZE_OPTIONS,
} from '../../constants/TechnicalDictionary.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { getBusinessVersion } from '../../utils/BusinessVersionUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import {
  TechnicalCatalogState,
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryRow,
} from './technicalDictionary.interface';
import {
  canDeleteRow,
  getTagLabel,
  isEditableRow,
  isSourceUnavailable,
} from './TechnicalDictionaryRows';

export interface TechnicalDictionaryTableProps {
  rows: TechnicalDictionaryRow[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  capabilities: TechnicalDictionaryCapabilities;
  catalog?: TechnicalCatalogState;
  selectedKeys: string[];
  extraTableFilters?: React.ReactNode;
  emptyContent?: React.ReactNode;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectionChange: (keys: string[]) => void;
  onView: (row: TechnicalDictionaryRow) => void;
  onEdit: (row: TechnicalDictionaryRow) => void;
  onSubmit: (row: TechnicalDictionaryRow) => void;
  onApprove: (row: TechnicalDictionaryRow) => void;
  onReject: (row: TechnicalDictionaryRow) => void;
  onReopen: (row: TechnicalDictionaryRow) => void;
  onCreateVersion: (row: TechnicalDictionaryRow) => void;
  onDelete: (row: TechnicalDictionaryRow) => void;
}

const Placeholder = () => (
  <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
);

const TAG_VARIANTS = {
  elementType: 'method',
  generationType: 'quality',
  creationMethod: 'source',
  timeliness: 'frequency',
} as const;

const TechnicalDictionaryTable = ({
  rows,
  isLoading,
  total,
  page,
  pageSize,
  capabilities,
  catalog,
  selectedKeys,
  extraTableFilters,
  emptyContent,
  onPageChange,
  onPageSizeChange,
  onSelectionChange,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onReopen,
  onCreateVersion,
  onDelete,
}: TechnicalDictionaryTableProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isReadOnly = catalog?.isReadOnly ?? true;

  const renderTag = useCallback(
    (
      tag: TechnicalDictionaryRow['elementType'],
      variant: (typeof TAG_VARIANTS)[keyof typeof TAG_VARIANTS]
    ) =>
      tag ? (
        renderDictionaryPastelTag(getTagLabel(tag), variant)
      ) : (
        <Placeholder />
      ),
    []
  );

  const renderLink = useCallback(
    (
      name: string,
      fqn: string | undefined,
      type: EntityType,
      tab?: EntityTabs
    ) =>
      !name ? (
        <Placeholder />
      ) : fqn ? (
        <Link
          className="tech-entity-link"
          title={name}
          to={getEntityDetailsPath(type, fqn, tab)}>
          {name}
        </Link>
      ) : (
        <span className="tech-text-muted" title={name}>
          {name}
        </span>
      ),
    []
  );

  const renderActions = useCallback(
    (row: TechnicalDictionaryRow) => {
      const unavailable = isSourceUnavailable(row);
      const isWorking = row.recordType === 'working';
      const canWrite = !isReadOnly && isWorking;

      return (
        <div className="d-flex items-center gap-2">
          <Tooltip title={t('label.view')}>
            <Button
              aria-label={t('label.view')}
              data-testid={`view-btn-${row.columnName}`}
              icon={<EyeOutlined />}
              size="small"
              type="text"
              onClick={() => onView(row)}
            />
          </Tooltip>
          {capabilities.canEditWorking && isEditableRow(row) && !isReadOnly && (
            <Tooltip title={t('label.edit')}>
              <Button
                aria-label={t('label.edit')}
                data-testid={`edit-btn-${row.columnName}`}
                icon={<EditIcon height={14} width={14} />}
                size="small"
                type="text"
                onClick={() => onEdit(row)}
              />
            </Tooltip>
          )}
          {capabilities.canSubmit &&
            canWrite &&
            row.status === 'Draft' &&
            !unavailable && (
              <Tooltip title={t('label.submit-for-review')}>
                <Button
                  aria-label={t('label.submit-for-review')}
                  data-testid={`submit-btn-${row.columnName}`}
                  icon={<SendOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onSubmit(row)}
                />
              </Tooltip>
            )}
          {capabilities.canApprove &&
            canWrite &&
            row.status === 'In Review' &&
            !unavailable && (
              <Tooltip title={t('label.approve')}>
                <Button
                  aria-label={t('label.approve')}
                  className="text-success"
                  data-testid={`approve-btn-${row.columnName}`}
                  icon={<CheckOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onApprove(row)}
                />
              </Tooltip>
            )}
          {capabilities.canReject && canWrite && row.status === 'In Review' && (
            <Tooltip title={t('label.reject')}>
              <Button
                aria-label={t('label.reject')}
                className="text-danger"
                data-testid={`reject-btn-${row.columnName}`}
                icon={<CloseOutlined />}
                size="small"
                type="text"
                onClick={() => onReject(row)}
              />
            </Tooltip>
          )}
          {capabilities.canEditWorking &&
            canWrite &&
            row.status === 'Rejected' && (
              <Tooltip title={t('label.reopen')}>
                <Button
                  aria-label={t('label.reopen')}
                  icon={<RollbackOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onReopen(row)}
                />
              </Tooltip>
            )}
          {canDeleteRow(row, capabilities, isReadOnly) && (
            <Tooltip title={t('label.delete-declaration')}>
              <Button
                aria-label={t('label.delete-declaration')}
                className="text-danger"
                data-testid={`delete-btn-${row.columnName}`}
                icon={<DeleteOutlined />}
                size="small"
                type="text"
                onClick={() => onDelete(row)}
              />
            </Tooltip>
          )}
          {capabilities.canCreateVersion &&
            !isReadOnly &&
            row.recordType === 'published' &&
            row.status === 'Approved' && (
              <Tooltip title={t('label.create-new-version')}>
                <Button
                  aria-label={t('label.create-new-version')}
                  data-testid={`create-version-btn-${row.columnName}`}
                  icon={<PlusOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onCreateVersion(row)}
                />
              </Tooltip>
            )}
        </div>
      );
    },
    [
      capabilities,
      isReadOnly,
      onApprove,
      onCreateVersion,
      onDelete,
      onEdit,
      onReject,
      onReopen,
      onSubmit,
      onView,
      t,
    ]
  );

  const columns: ColumnsType<TechnicalDictionaryRow> = useMemo(
    () => [
      {
        title: t('label.database-name'),
        dataIndex: KEYS.DATABASE_NAME,
        key: KEYS.DATABASE_NAME,
        fixed: 'left',
        width: 150,
        render: (_, row) =>
          renderLink(row.databaseName, row.databaseFqn, EntityType.DATABASE),
      },
      {
        title: t('label.schema-name'),
        dataIndex: KEYS.SCHEMA_NAME,
        key: KEYS.SCHEMA_NAME,
        fixed: 'left',
        width: 130,
        render: (_, row) =>
          renderLink(row.schemaName, row.schemaFqn, EntityType.DATABASE_SCHEMA),
      },
      {
        title: t('label.table-name'),
        dataIndex: KEYS.TABLE_NAME,
        key: KEYS.TABLE_NAME,
        fixed: 'left',
        width: 190,
        render: (_, row) =>
          renderLink(
            row.tableName,
            row.tableFqn,
            EntityType.TABLE,
            EntityTabs.SCHEMA
          ),
      },
      {
        title: t('label.column-name'),
        dataIndex: KEYS.COLUMN_NAME,
        key: KEYS.COLUMN_NAME,
        fixed: 'left',
        width: 160,
        render: (_, row) => (
          <span className="tech-column-name" title={row.columnName}>
            {row.columnName}
          </span>
        ),
      },
      {
        title: t('label.data-owner'),
        dataIndex: KEYS.DATA_OWNER,
        key: KEYS.DATA_OWNER,
        width: 180,
        render: (_, row) =>
          renderDictionaryOwnerList(row.dataOwners, 'tech-owner'),
      },
      {
        title: t('label.source'),
        dataIndex: KEYS.SERVICE_NAME,
        key: KEYS.SERVICE_NAME,
        width: 170,
        render: (_, row) => (
          <>
            {row.serviceName ? (
              renderDictionaryPastelTag(row.serviceName, 'source')
            ) : (
              <Placeholder />
            )}
            {row.sourceStatus === 'Unavailable' && (
              <Tag
                color="error"
                data-testid={`source-unavailable-${row.columnName}`}>
                {t('label.source-unavailable')}
              </Tag>
            )}
            {row.sourceStatus === 'Changed' && (
              <Tag
                color="warning"
                data-testid={`source-changed-${row.columnName}`}>
                {t('label.source-changed')}
              </Tag>
            )}
          </>
        ),
      },
      {
        title: t('label.cde-code-ref'),
        dataIndex: KEYS.CDE_CODE,
        key: KEYS.CDE_CODE,
        width: 150,
        render: (_, row) =>
          row.cdeCode ? (
            <span
              data-testid={`cde-code-${row.cdeCode}`}
              title={row.cdeName || row.cdeCode}>
              {row.cdeCode}
            </span>
          ) : (
            <Placeholder />
          ),
      },
      {
        title: t('label.cde-name'),
        dataIndex: KEYS.CDE_NAME,
        key: KEYS.CDE_NAME,
        width: 220,
        render: (_, row) => renderDictionaryMarkdown(row.cdeName),
      },
      {
        title: t('label.rank'),
        dataIndex: KEYS.SURVIVORSHIP_RANK,
        key: KEYS.SURVIVORSHIP_RANK,
        width: 130,
        render: (_, row) =>
          row.rank ? (
            <SurvivorshipBadge
              rule={{ assetFqn: row.columnFqn || row.termId, rank: row.rank }}
            />
          ) : (
            <Placeholder />
          ),
      },
      {
        title: t('label.data-type'),
        dataIndex: KEYS.DATA_TYPE,
        key: KEYS.DATA_TYPE,
        width: 140,
        render: (_, row) =>
          row.dataType ? (
            renderDictionaryPastelTag(row.dataType, 'classification')
          ) : (
            <Placeholder />
          ),
      },
      {
        title: t('label.data-element-type'),
        dataIndex: KEYS.ELEMENT_TYPE,
        key: KEYS.ELEMENT_TYPE,
        width: 160,
        render: (_, row) =>
          renderTag(row.elementType, TAG_VARIANTS.elementType),
      },
      {
        title: t('label.generation-type'),
        dataIndex: KEYS.GENERATION_TYPE,
        key: KEYS.GENERATION_TYPE,
        width: 180,
        render: (_, row) =>
          renderTag(row.generationType, TAG_VARIANTS.generationType),
      },
      {
        title: t('label.creation-method'),
        dataIndex: KEYS.CREATION_METHOD,
        key: KEYS.CREATION_METHOD,
        width: 160,
        render: (_, row) =>
          renderTag(row.creationMethod, TAG_VARIANTS.creationMethod),
      },
      {
        title: t('label.timeliness'),
        dataIndex: KEYS.TIMELINESS,
        key: KEYS.TIMELINESS,
        width: 110,
        render: (_, row) => renderTag(row.timeliness, TAG_VARIANTS.timeliness),
      },
      {
        title: t('label.system-owner'),
        dataIndex: KEYS.SYSTEM_OWNER,
        key: KEYS.SYSTEM_OWNER,
        width: 180,
        render: (_, row) =>
          row.systemOwner ? (
            renderDictionaryOwnerList([row.systemOwner], 'tech-system-owner')
          ) : (
            <Placeholder />
          ),
      },
      {
        title: t('label.description'),
        dataIndex: KEYS.DESCRIPTION,
        key: KEYS.DESCRIPTION,
        width: 240,
        render: (_, row) => renderDictionaryMarkdown(row.description),
      },
      {
        title: t('label.version'),
        dataIndex: KEYS.VERSION,
        key: KEYS.VERSION,
        width: 110,
        render: (_, row) => getBusinessVersion(row.businessVersion),
      },
      {
        title: t('label.release-version-type'),
        dataIndex: KEYS.RELEASE_VERSION_TYPE,
        key: KEYS.RELEASE_VERSION_TYPE,
        width: 190,
        render: (_, row) =>
          renderCDEReleaseVersionType(
            row.releaseVersionType,
            row.businessVersion
          ),
      },
      {
        title: t('label.status'),
        dataIndex: KEYS.STATUS,
        key: KEYS.STATUS,
        width: 140,
        render: (_, row) =>
          renderDictionaryStatusBadge(
            row.status as EntityStatus,
            `${row.columnName}-status`
          ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: KEYS.ACTIONS,
        key: KEYS.ACTIONS,
        fixed: 'right',
        width: 150,
        render: (_, row) => renderActions(row),
      },
    ],
    [renderActions, renderLink, renderTag, t]
  );

  const paginationProps = useMemo(
    () => ({
      currentPage: page,
      showPagination: total > 0,
      isNumberBased: true,
      isLoading,
      pageSize,
      paging: { total },
      pagingHandler: ({ currentPage }: PagingHandlerParams) =>
        onPageChange(currentPage),
      onShowSizeChange: onPageSizeChange,
      pageSizeOptions: TECHNICAL_PAGE_SIZE_OPTIONS,
    }),
    [isLoading, onPageChange, onPageSizeChange, page, pageSize, total]
  );

  // The sticky horizontal scrollbar is measured from the first render, before
  // the columns exist; ask antd to measure again once rows are present.
  useLayoutEffect(() => {
    if (isLoading || rows.length === 0) {
      return undefined;
    }
    const frame = globalThis.requestAnimationFrame(() =>
      globalThis.requestAnimationFrame(() =>
        globalThis.dispatchEvent(new Event('resize'))
      )
    );

    return () => globalThis.cancelAnimationFrame(frame);
  }, [columns, isLoading, rows.length]);

  return (
    <div
      className="glossary-terms-scroll-container"
      ref={containerRef}
      style={{ position: 'relative' }}>
      <Table
        resizableColumns
        className="cde-glossary-terms-table glossary-terms-table"
        columns={columns}
        containerClassName="cde-glossary-table-container"
        customPaginationProps={paginationProps}
        data-testid="technical-dictionary-table"
        dataSource={rows}
        defaultVisibleColumns={TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS}
        entityType={TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY}
        extraTableFilters={extraTableFilters}
        extraTableFiltersClassName="cde-glossary-table-toolbar tech-dict-table-toolbar"
        loading={isLoading}
        locale={emptyContent ? { emptyText: emptyContent } : undefined}
        pagination={false}
        rowKey="key"
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => onSelectionChange(keys.map(String)),
          getCheckboxProps: (row) => ({
            disabled: row.recordType !== 'working',
          }),
        }}
        size="small"
        staticVisibleColumns={TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS}
        sticky={{
          offsetScroll: 0,
          getContainer: () =>
            containerRef.current?.closest<HTMLElement>(
              '.page-layout-v1-vertical-scroll'
            ) ?? document.body,
        }}
      />
    </div>
  );
};

export default TechnicalDictionaryTable;
