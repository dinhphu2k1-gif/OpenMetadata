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
} from '@ant-design/icons';
import { Button, Tag, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { ColumnsType } from 'antd/lib/table';
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import {
  renderDictionaryMarkdown,
  renderDictionaryPastelTag,
} from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import SurvivorshipBadge from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY,
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS as KEYS,
  TECHNICAL_PAGE_SIZE_OPTIONS,
} from '../../constants/TechnicalDictionary.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getGlossaryTermsById } from '../../rest/glossaryAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryRow,
} from './technicalDictionary.interface';
import {
  canReviewTechnicalRecord,
  getTagLabel,
} from './TechnicalDictionaryRows';

export interface TechnicalDictionaryTableProps {
  rows: TechnicalDictionaryRow[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  capabilities: TechnicalDictionaryCapabilities;
  extraTableFilters?: React.ReactNode;
  emptyContent?: React.ReactNode;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (row: TechnicalDictionaryRow) => void;
  onEdit: (row: TechnicalDictionaryRow) => void;
  onDelete: (row: TechnicalDictionaryRow) => void;
  onApprove: (row: TechnicalDictionaryRow) => void;
  onReject: (row: TechnicalDictionaryRow) => void;
  currentUserName?: string;
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
  extraTableFilters,
  emptyContent,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  currentUserName,
}: TechnicalDictionaryTableProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCdeClick = useCallback(
    async (termId: string) => {
      try {
        const term = await getGlossaryTermsById(termId);
        if (term.fullyQualifiedName) {
          navigate(getGlossaryTermDetailsPath(term.fullyQualifiedName));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [navigate]
  );

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
      const canReview = canReviewTechnicalRecord(
        row,
        capabilities.canApprove,
        currentUserName
      );

      return (
        <div className="d-flex items-center gap-2">
        <Tooltip title={t('label.view')}>
          <Button
            aria-label={t('label.view')}
            className="text-grey-muted flex-center"
            data-testid={`view-btn-${row.columnName}`}
            icon={<EyeOutlined />}
            size="small"
            type="text"
            onClick={() => onView(row)}
          />
        </Tooltip>
        {capabilities.canEdit && (
          <Tooltip title={t('label.edit')}>
            <Button
              aria-label={t('label.edit')}
              className="text-grey-muted flex-center"
              data-testid={`edit-btn-${row.columnName}`}
              icon={<EditIcon height={14} width={14} />}
              size="small"
              type="text"
              onClick={() => onEdit(row)}
            />
          </Tooltip>
        )}
        {canReview && (
          <Tooltip title={t('label.approve')}>
            <Button
              aria-label={t('label.approve')}
              data-testid={`approve-btn-${row.columnName}`}
              icon={<CheckOutlined />}
              size="small"
              type="text"
              onClick={() => onApprove(row)}
            />
          </Tooltip>
        )}
        {canReview && (
          <Tooltip title={t('label.reject')}>
            <Button
              danger
              aria-label={t('label.reject')}
              data-testid={`reject-btn-${row.columnName}`}
              icon={<CloseOutlined />}
              size="small"
              type="text"
              onClick={() => onReject(row)}
            />
          </Tooltip>
        )}
        {capabilities.canEdit && (
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
        </div>
      );
    },
    [
      capabilities.canApprove,
      capabilities.canEdit,
      currentUserName,
      onApprove,
      onDelete,
      onEdit,
      onReject,
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
          </>
        ),
      },
      {
        title: t('label.status'),
        dataIndex: KEYS.STATUS,
        key: KEYS.STATUS,
        width: 130,
        render: (_, row) => (
          <Tag
            color={
              row.status === 'Approved'
                ? 'success'
                : row.status === 'Rejected'
                ? 'error'
                : 'processing'
            }>
            {t(
              row.status === 'Approved'
                ? 'label.approved'
                : row.status === 'Rejected'
                ? 'label.rejected'
                : 'label.technical-in-review'
            )}
          </Tag>
        ),
      },
      {
        title: t('label.cde-code-ref'),
        dataIndex: KEYS.CDE_CODE,
        key: KEYS.CDE_CODE,
        width: 150,
        render: (_, row) =>
          row.cdeCode ? (
            <Button
              className="p-0 h-auto tech-entity-link"
              data-testid={`cde-code-${row.cdeCode}`}
              title={row.cdeName || row.cdeCode}
              type="link"
              onClick={() => row.cdeTermId && handleCdeClick(row.cdeTermId)}>
              {row.cdeCode}
            </Button>
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
        title: t('label.description'),
        dataIndex: KEYS.DESCRIPTION,
        key: KEYS.DESCRIPTION,
        width: 240,
        render: (_, row) => renderDictionaryMarkdown(row.description),
      },
      {
        title: t('label.updated-at'),
        dataIndex: KEYS.UPDATED_AT,
        key: KEYS.UPDATED_AT,
        width: 170,
        render: (_, row) =>
          row.updatedAt ? formatDateTime(row.updatedAt) : <Placeholder />,
      },
      {
        title: t('label.updated-by'),
        dataIndex: KEYS.UPDATED_BY,
        key: KEYS.UPDATED_BY,
        width: 140,
        render: (_, row) => row.updatedBy || <Placeholder />,
      },
      {
        title: t('label.action-plural'),
        dataIndex: KEYS.ACTIONS,
        key: KEYS.ACTIONS,
        fixed: 'right',
        width: 110,
        render: (_, row) => renderActions(row),
      },
    ],
    [handleCdeClick, renderActions, renderLink, renderTag, t]
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
