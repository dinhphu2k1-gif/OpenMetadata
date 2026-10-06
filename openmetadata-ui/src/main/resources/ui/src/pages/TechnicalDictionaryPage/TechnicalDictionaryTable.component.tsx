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
import { Button, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import React, {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import SurvivorshipBadge from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component';
import {
  renderDictionaryMarkdown,
  renderDictionaryPastelTag,
} from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY,
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS as KEYS,
  TECHNICAL_PAGE_SIZE_OPTIONS,
} from '../../constants/TechnicalDictionary.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { getGlossaryTermsById } from '../../rest/glossaryAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import { getTagLabel } from './TechnicalDictionaryRows';
import TechnicalStatusBadge from './TechnicalStatusBadge.component';

export interface TechnicalDictionaryTableProps {
  rows: TechnicalDictionaryRow[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  extraTableFilters?: React.ReactNode;
  emptyContent?: React.ReactNode;
  /** Keys of the ticked rows; the page owns them so it can act on and clear them. */
  selectedRowKeys: React.Key[];
  /** Replaces the toolbar while rows are ticked; leave undefined to keep the toolbar. */
  bulkActionBar?: React.ReactNode;
  /** Hides the row checkboxes, for the frozen snapshot that cannot be acted on. */
  isReadOnly?: boolean;
  onSelectionChange: (keys: React.Key[]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (row: TechnicalDictionaryRow) => void;
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

const stopRowClick = (event: React.SyntheticEvent) => event.stopPropagation();

const TechnicalDictionaryTable = ({
  rows,
  isLoading,
  total,
  page,
  pageSize,
  extraTableFilters,
  emptyContent,
  selectedRowKeys,
  bulkActionBar,
  isReadOnly = false,
  onSelectionChange,
  onPageChange,
  onPageSizeChange,
  onView,
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
          to={getEntityDetailsPath(type, fqn, tab)}
          onClick={stopRowClick}>
          {name}
        </Link>
      ) : (
        <span className="tech-text-muted" title={name}>
          {name}
        </span>
      ),
    []
  );

  const renderFieldPath = useCallback(
    (row: TechnicalDictionaryRow) =>
      [
        {
          name: row.databaseName,
          fqn: row.databaseFqn,
          type: EntityType.DATABASE,
        },
        {
          name: row.schemaName,
          fqn: row.schemaFqn,
          type: EntityType.DATABASE_SCHEMA,
        },
        {
          name: row.tableName,
          fqn: row.tableFqn,
          type: EntityType.TABLE,
          tab: EntityTabs.SCHEMA,
        },
      ]
        .filter((segment) => segment.name)
        .map((segment, index) => (
          <Fragment key={segment.type}>
            {index > 0 && (
              <span aria-hidden="true" className="tech-field-path-separator">
                /
              </span>
            )}
            {renderLink(segment.name, segment.fqn, segment.type, segment.tab)}
          </Fragment>
        )),
    [renderLink]
  );

  const columns: ColumnsType<TechnicalDictionaryRow> = useMemo(
    () => [
      {
        title: t('label.field-name'),
        dataIndex: KEYS.FIELD_NAME,
        key: KEYS.FIELD_NAME,
        fixed: 'left',
        width: 260,
        render: (_, row) => (
          <div className="tech-field-cell">
            <button
              className="tech-field-name"
              data-testid={`view-btn-${row.columnName}`}
              title={row.columnName}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onView(row);
              }}>
              {row.columnName}
            </button>
            <div className="tech-field-path">{renderFieldPath(row)}</div>
          </div>
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
              onClick={(event) => {
                event.stopPropagation();
                if (row.cdeTermId) {
                  handleCdeClick(row.cdeTermId);
                }
              }}>
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
        title: t('label.technical-data-steward'),
        dataIndex: KEYS.SYSTEM_OWNER,
        key: KEYS.SYSTEM_OWNER,
        width: 170,
        render: (_, row) =>
          row.systemOwners.length ? (
            row.systemOwners.map((owner) => owner.name).join(', ')
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
        title: t('label.status'),
        dataIndex: KEYS.STATUS,
        key: KEYS.STATUS,
        width: 140,
        render: (_, row) => (
          <div className="d-flex flex-column items-start gap-1">
            <TechnicalStatusBadge
              dataTestId={`status-${row.columnName}`}
              status={row.status}
            />
            {row.hasPendingChange && row.rowRole !== 'CHANGE' && (
              <Tag color={row.changeOperation === 'DELETE' ? 'red' : 'gold'}>
                {t(
                  row.changeOperation === 'DELETE'
                    ? 'label.technical-change-delete-pending'
                    : row.changeRequestStatus === 'InReview'
                    ? 'label.technical-change-in-review'
                    : row.changeRequestStatus === 'Rejected'
                    ? 'label.technical-change-rejected'
                    : 'label.technical-change-draft'
                )}
              </Tag>
            )}
          </div>
        ),
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
    ],
    [handleCdeClick, onView, renderFieldPath, renderTag, t]
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
        className="cde-glossary-terms-table glossary-terms-table tech-dict-table"
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
        rowClassName="tech-dict-row"
        rowKey="key"
        rowSelection={
          isReadOnly
            ? undefined
            : {
                type: 'checkbox',
                fixed: true,
                columnWidth: 32,
                selectedRowKeys,
                onChange: onSelectionChange,
              }
        }
        selectionBar={bulkActionBar}
        size="small"
        staticVisibleColumns={TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS}
        sticky={{
          offsetScroll: 0,
          getContainer: () =>
            containerRef.current?.closest<HTMLElement>(
              '.page-layout-v1-vertical-scroll'
            ) ?? document.body,
        }}
        onRow={(row) => ({ onClick: () => onView(row) })}
      />
    </div>
  );
};

export default TechnicalDictionaryTable;
