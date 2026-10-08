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
import { ExclamationCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Alert, Input, Modal, Spin } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  TEXT_BODY_COLOR,
} from '../../../constants/constants';
import { TABLE_CONSTANTS } from '../../../constants/Teams.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import BulkSelectionBar from '../BulkSelectionBar/BulkSelectionBar.component';
import { BulkSelectionChip } from '../BulkSelectionBar/BulkSelectionBar.interface';
import ErrorPlaceHolder from '../ErrorWithPlaceholder/ErrorPlaceHolder';
import GovernanceListFilterDropdown from '../GovernanceList/GovernanceListFilterDropdown.component';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import ReviewActionConfirmModal from '../ReviewActionConfirmModal/ReviewActionConfirmModal.component';
import StatusBadge from '../StatusBadge/StatusBadge.component';
import { StatusType } from '../StatusBadge/StatusBadge.interface';
import Table from '../Table/Table';
import './pending-requests-tab.less';
import {
  PendingRequest,
  PendingRequestAction,
  PendingRequestChangeDetail,
  PendingRequestFilter,
  PendingRequestFailure,
  PendingRequestsTabProps,
  PendingRequestType,
  PendingRequestTypeCounts,
} from './PendingRequestsTab.interface';

const SEARCH_DEBOUNCE_MS = 400;
const REQUESTED_AT_FORMAT = 'dd/MM/yyyy HH:mm';
const TYPES: PendingRequestType[] = ['create', 'update', 'delete'];
const TYPE_LABEL_KEYS: Record<PendingRequestType, string> = {
  create: 'label.request-type-create',
  update: 'label.request-type-update',
  delete: 'label.request-type-delete',
};
const TYPE_BADGE: Record<PendingRequestType, StatusType> = {
  create: StatusType.Success,
  update: StatusType.Acknowledged,
  delete: StatusType.Failure,
};
const EMPTY_COUNTS: PendingRequestTypeCounts = {
  create: 0,
  update: 0,
  delete: 0,
};

export const PendingRequestsTab: FC<PendingRequestsTabProps> = ({
  adapter,
  canDecide,
  scopeKey,
  refreshKey,
  searchPlaceholder,
  onDecided,
  testId = 'pending-requests-tab',
}) => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeType, setActiveType] = useState<PendingRequestType | 'all'>(
    'all'
  );
  const [filters, setFilters] = useState<PendingRequestFilter[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>(
    {}
  );
  const [selected, setSelected] = useState<Map<string, PendingRequest>>(
    new Map()
  );
  const [details, setDetails] = useState<
    Record<string, PendingRequestChangeDetail>
  >({});
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PendingRequestAction | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [actionFailures, setActionFailures] = useState<PendingRequestFailure[]>(
    []
  );
  const [typeCounts, setTypeCounts] =
    useState<PendingRequestTypeCounts>(EMPTY_COUNTS);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adapter.fetchRequests({
        searchText: searchText.trim() || undefined,
        types: activeType === 'all' ? undefined : [activeType],
        filters: filterValues,
        page,
        pageSize,
      });
      setRequests(result.items);
      setTotal(result.total);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [adapter, searchText, activeType, filterValues, page, pageSize]);

  const loadAuxiliaryData = useCallback(async () => {
    const [countsResult, filtersResult] = await Promise.allSettled([
      adapter.fetchTypeCounts?.(),
      adapter.fetchFilters?.(),
    ]);
    if (countsResult.status === 'fulfilled' && countsResult.value) {
      setTypeCounts(countsResult.value);
    }
    if (filtersResult.status === 'fulfilled' && filtersResult.value) {
      setFilters(filtersResult.value);
    }
  }, [adapter]);

  useEffect(() => {
    load();
  }, [load, scopeKey, refreshKey]);
  useEffect(() => {
    loadAuxiliaryData();
  }, [loadAuxiliaryData, scopeKey, refreshKey]);

  const clearSelection = useCallback(() => setSelected(new Map()), []);
  useEffect(() => {
    setPage(1);
    clearSelection();
  }, [
    scopeKey,
    searchText,
    activeType,
    filterValues,
    pageSize,
    clearSelection,
  ]);
  useEffect(() => {
    setExpandedKeys([]);
  }, [scopeKey, searchText, activeType, filterValues, page, pageSize]);

  const debouncedSearch = useMemo(
    () => debounce(setSearchText, SEARCH_DEBOUNCE_MS),
    []
  );
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const selectedRequests = useMemo(() => [...selected.values()], [selected]);
  const withdrawableRequests = useMemo(
    () => selectedRequests.filter((request) => request.canWithdraw),
    [selectedRequests]
  );
  const decisionableRequests = useMemo(
    () => selectedRequests.filter((request) => request.canDecide !== false),
    [selectedRequests]
  );
  const actionTargets =
    pendingAction === 'withdraw' ? withdrawableRequests : decisionableRequests;
  const selectedCounts = useMemo(
    () =>
      selectedRequests.reduce<PendingRequestTypeCounts>(
        (counts, request) => ({
          ...counts,
          [request.type]: counts[request.type] + 1,
        }),
        { ...EMPTY_COUNTS }
      ),
    [selectedRequests]
  );
  const selectionChips = useMemo<BulkSelectionChip[]>(
    () =>
      TYPES.filter((type) => selectedCounts[type] > 0).map((type) => ({
        tone: type,
        count: selectedCounts[type],
        label: `${selectedCounts[type]} ${t(
          TYPE_LABEL_KEYS[type]
        ).toLocaleLowerCase()}`,
        testId: `pending-requests-${type}-count`,
      })),
    [selectedCounts, t]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) {
      return;
    }
    setIsApplying(true);
    try {
      let result = await adapter.applyAction(pendingAction, actionTargets);
      let attempts = 0;
      while ((result.remaining ?? 0) > 0 && attempts < 100) {
        const next = await adapter.applyAction(pendingAction, actionTargets);
        result = {
          succeeded: result.succeeded + next.succeeded,
          failures: [...result.failures, ...next.failures],
          remaining: next.remaining,
        };
        attempts += 1;
      }
      const failed = result.failures.length;
      setActionFailures(result.failures);
      showSuccessToast(
        t('message.bulk-action-completed', {
          success: result.succeeded,
          failedText:
            failed > 0 ? `, ${t('label.failed-count', { count: failed })}` : '',
        })
      );
      setPendingAction(null);
      clearSelection();
      onDecided?.(result, pendingAction);
      await Promise.all([load(), loadAuxiliaryData()]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsApplying(false);
    }
  }, [
    actionTargets,
    adapter,
    clearSelection,
    load,
    loadAuxiliaryData,
    onDecided,
    pendingAction,
    t,
  ]);

  const handleExpand = useCallback(
    async (expanded: boolean, request: PendingRequest) => {
      if (!expanded || details[request.id] || loadingDetails.has(request.id)) {
        return;
      }
      setLoadingDetails((current) => new Set(current).add(request.id));
      try {
        const detail = await adapter.fetchChangeDetail(request);
        setDetails((current) => ({ ...current, [request.id]: detail }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoadingDetails((current) => {
          const next = new Set(current);
          next.delete(request.id);

          return next;
        });
      }
    },
    [adapter, details, loadingDetails]
  );

  const handleToggleExpand = useCallback(
    (expanded: boolean, request: PendingRequest) => {
      setExpandedKeys((current) =>
        expanded
          ? [...current, request.id]
          : current.filter((key) => key !== request.id)
      );
      handleExpand(expanded, request);
    },
    [handleExpand]
  );

  const columns = useMemo<ColumnsType<PendingRequest>>(
    () => [
      {
        title: t('cde.term-code'),
        dataIndex: 'code',
        key: 'code',
        width: 120,
        render: (code: string, record) => {
          const expanded = expandedKeys.includes(record.id);

          return (
            <>
              <Icon
                className="m-r-xs vertical-baseline pending-requests-expand-icon"
                component={expanded ? IconDown : IconRight}
                data-testid="expand-icon"
                style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleExpand(!expanded, record);
                }}
              />
              {record.detailPath ? (
                <Link
                  className="pending-requests-code"
                  to={record.detailPath}
                  onClick={(event) => event.stopPropagation()}>
                  {code}
                </Link>
              ) : (
                <span
                  className="pending-requests-code"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleExpand(!expanded, record);
                  }}>
                  {code}
                </span>
              )}
            </>
          );
        },
      },
      {
        title: t('cde.business-term-name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (name?: string) => name || NO_DATA_PLACEHOLDER,
      },
      {
        title: t('cde.version'),
        dataIndex: 'version',
        key: 'version',
        width: 110,
        render: (version?: string) => version || NO_DATA_PLACEHOLDER,
      },
      {
        title: t('label.request-type'),
        dataIndex: 'type',
        key: 'type',
        width: 170,
        render: (type: PendingRequestType, record) => (
          <div className="pending-requests-badges">
            <StatusBadge
              dataTestId={`${record.code}-request-type`}
              label={t(TYPE_LABEL_KEYS[type])}
              status={TYPE_BADGE[type]}
            />
          </div>
        ),
      },
      {
        title: t('label.change-summary'),
        dataIndex: 'changedFields',
        key: 'changedFields',
        width: 270,
        render: (changedFields: string[] = []) => (
          <div className="pending-requests-change-chips">
            {changedFields.map((field) => (
              <span className="pending-requests-change-chip" key={field}>
                {field}
              </span>
            ))}
          </div>
        ),
      },
      {
        title: t('label.requested-by'),
        dataIndex: 'requestedBy',
        key: 'requestedBy',
        width: 200,
        render: (requestedBy) => (
          <OwnerLabel
            isCompactView={false}
            owners={requestedBy ? [requestedBy] : []}
            showLabel={false}
          />
        ),
      },
      {
        title: t('label.requested-at'),
        dataIndex: 'requestedAt',
        key: 'requestedAt',
        width: 180,
        render: (at?: number) =>
          at ? (
            <span>{customFormatDateTime(at, REQUESTED_AT_FORMAT)}</span>
          ) : (
            NO_DATA_PLACEHOLDER
          ),
      },
    ],
    [expandedKeys, handleToggleExpand, t]
  );

  const toolbar = (
    <>
      <Input
        allowClear
        data-testid="pending-requests-search"
        placeholder={searchPlaceholder ?? t('label.search')}
        style={{ width: 280 }}
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          debouncedSearch(event.target.value);
        }}
        onPressEnter={(event) => {
          debouncedSearch.cancel();
          setSearchText(event.currentTarget.value);
        }}
      />
      <div
        aria-label={t('label.request-type')}
        className="pending-requests-segmented"
        role="group">
        {(['all', ...TYPES] as const).map((type) => {
          const isActive = activeType === type;
          const count =
            type === 'all'
              ? TYPES.reduce((sum, item) => sum + typeCounts[item], 0)
              : typeCounts[type];

          return (
            <button
              aria-pressed={isActive}
              className={classNames('pending-requests-segment', {
                active: isActive,
              })}
              data-testid={`pending-requests-type-${type}`}
              key={type}
              type="button"
              onClick={() => {
                setExpandedKeys([]);
                setActiveType(type);
              }}>
              {type !== 'all' && (
                <span
                  className={`pending-requests-type-dot pending-requests-type-dot--${type}`}
                />
              )}
              <span>
                {type === 'all' ? t('label.all') : t(TYPE_LABEL_KEYS[type])}
              </span>
              <span
                className={classNames('pending-requests-type-count', {
                  'is-zero': count === 0,
                })}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {filters.map((filter) => (
        <GovernanceListFilterDropdown
          dataTestId={`pending-requests-filter-${filter.key}`}
          key={filter.key}
          label={filter.label}
          options={filter.options}
          selectedValues={filterValues[filter.key] ?? []}
          onChange={(values) =>
            setFilterValues((current) => ({
              ...current,
              [filter.key]: values.filter((value) => value !== 'all'),
            }))
          }
        />
      ))}
    </>
  );

  const approvalWarning =
    pendingAction === 'approve'
      ? adapter.getApprovalWarning?.(decisionableRequests)
      : undefined;

  return (
    <div className="pending-requests-tab" data-testid={testId}>
      <Table<PendingRequest>
        resizableColumns
        className="glossary-terms-table cde-glossary-terms-table"
        columns={columns}
        components={TABLE_CONSTANTS}
        containerClassName="dictionary-table-container"
        customPaginationProps={{
          currentPage: page,
          isLoading,
          isNumberBased: true,
          pageSize,
          pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
          paging: { total },
          pagingHandler: ({ currentPage }) => setPage(currentPage),
          onShowSizeChange: setPageSize,
          showPagination: total > pageSize,
        }}
        data-testid="pending-requests-table"
        dataSource={requests}
        defaultVisibleColumns={[
          'version',
          'type',
          'changedFields',
          'requestedBy',
          'requestedAt',
        ]}
        entityType="pendingRequests"
        expandable={{
          expandedRowClassName: (record) =>
            `pending-requests-expanded-row pending-requests-expanded-row--${record.type}`,
          expandedRowKeys: expandedKeys,
          expandedRowRender: (record) => {
            const detail = details[record.id];
            if (!detail) {
              return (
                <div className="pending-requests-detail-loading">
                  <Spin size="small" />
                </div>
              );
            }

            const filledFields = detail.fields?.filter(({ empty }) => !empty);
            const emptyFields = detail.fields?.filter(({ empty }) => empty);
            const summary = {
              create: t('label.proposed-information'),
              update: t('message.changed-field-count', {
                count: detail.diffs?.length ?? 0,
              }),
              delete:
                detail.warning ?? t('message.pending-delete-approval-warning'),
            }[record.type];

            return (
              <div className="pending-requests-detail">
                <div className="pending-requests-detail__summary">
                  {record.type === 'delete' && (
                    <ExclamationCircleOutlined
                      aria-hidden
                      className="pending-requests-detail__warning-icon"
                    />
                  )}
                  <span>{summary}</span>
                </div>
                {Boolean(detail.diffs?.length) && (
                  <div className="pending-requests-diffs">
                    <div className="pending-requests-diff pending-requests-diff--head">
                      <span>{t('label.field')}</span>
                      <span>{t('label.current-value')}</span>
                      <span>{t('label.proposed-value')}</span>
                    </div>
                    {detail.diffs?.map((diff) => (
                      <div className="pending-requests-diff" key={diff.field}>
                        <span className="pending-requests-detail-label">
                          {diff.field}
                        </span>
                        <span
                          className={classNames('pending-requests-old-value', {
                            'pending-requests-detail__empty': diff.oldEmpty,
                          })}
                          data-label={t('label.current-value')}>
                          {diff.oldEmpty
                            ? t('label.no-value-yet')
                            : diff.oldValue}
                        </span>
                        <span
                          className={classNames('pending-requests-new-value', {
                            'pending-requests-detail__empty': diff.newEmpty,
                          })}
                          data-label={t('label.proposed-value')}>
                          {diff.newEmpty
                            ? t('label.no-value-yet')
                            : diff.newValue}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {Boolean(filledFields?.length) && (
                  <div className="pending-requests-diffs">
                    <div className="pending-requests-diff pending-requests-diff--two-columns pending-requests-diff--head">
                      <span>{t('label.field')}</span>
                      <span>{t('label.value')}</span>
                    </div>
                    {filledFields?.map((field) => (
                      <div
                        className="pending-requests-diff pending-requests-diff--two-columns"
                        key={field.label}>
                        <span className="pending-requests-detail-label">
                          {field.label}
                        </span>
                        <span className="pending-requests-field-value">
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {Boolean(emptyFields?.length) && (
                  <div className="pending-requests-detail__empty pending-requests-detail__empty-summary">
                    {t('message.empty-field-summary', {
                      count: emptyFields?.length,
                      fields: emptyFields?.map(({ label }) => label).join(', '),
                    })}
                  </div>
                )}
              </div>
            );
          },
          onExpand: handleToggleExpand,
          showExpandColumn: false,
        }}
        extraTableFilters={toolbar}
        extraTableFiltersClassName="dictionary-table-toolbar"
        key={activeType}
        loading={isLoading}
        locale={{
          emptyText: (
            <ErrorPlaceHolder
              className="p-md"
              placeholderText={t('message.no-pending-requests')}
              type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
            />
          ),
        }}
        pagination={false}
        rowClassName={(record) =>
          classNames(
            'pending-requests-row-expandable',
            `pending-requests-row--${record.type}`,
            {
              'pending-requests-row--expanded': expandedKeys.includes(
                record.id
              ),
            }
          )
        }
        rowKey="id"
        rowSelection={{
          selectedRowKeys: [...selected.keys()],
          preserveSelectedRowKeys: true,
          getCheckboxProps: (record) => ({
            disabled:
              record.selectable === false ||
              !(
                (canDecide && record.canDecide !== false) ||
                record.canWithdraw
              ),
            'aria-label': t('label.select-entity', {
              entity: record.name,
            }),
          }),
          onChange: (_keys, rows) =>
            setSelected((previous) => {
              const pageIds = new Set(requests.map(({ id }) => id));
              const next = new Map(
                [...previous].filter(([id]) => !pageIds.has(id))
              );
              rows.forEach((row) => next.set(row.id, row));

              return next;
            }),
        }}
        selectionBar={
          selectedRequests.length > 0 ? (
            <BulkSelectionBar
              actions={[
                ...(withdrawableRequests.length > 0
                  ? [
                      {
                        type: 'withdraw' as const,
                        count: withdrawableRequests.length,
                        testId: 'pending-requests-withdraw-btn',
                        onPress: () => setPendingAction('withdraw'),
                      },
                    ]
                  : []),
                ...(canDecide && decisionableRequests.length > 0
                  ? [
                      {
                        type: 'reject' as const,
                        count: decisionableRequests.length,
                        testId: 'pending-requests-reject-btn',
                        onPress: () => setPendingAction('reject'),
                      },
                      {
                        type: 'approve' as const,
                        count: decisionableRequests.length,
                        testId: 'pending-requests-approve-btn',
                        onPress: () => setPendingAction('approve'),
                      },
                    ]
                  : []),
              ]}
              chips={selectionChips}
              clearTestId="pending-requests-clear-selection"
              countTestId="pending-requests-selected-count"
              selectedCount={selectedRequests.length}
              testId="pending-requests-bulk-bar"
              onClear={clearSelection}
            />
          ) : undefined
        }
        staticVisibleColumns={['code', 'name']}
      />

      {pendingAction && (
        <ReviewActionConfirmModal
          action={pendingAction}
          count={actionTargets.length}
          isLoading={isApplying}
          open={Boolean(pendingAction)}
          onCancel={() => !isApplying && setPendingAction(null)}
          onConfirm={handleConfirm}>
          <div className="pending-requests-confirm-chips">
            {selectionChips.map((chip) => (
              <span
                className={`bulk-selection-chip bulk-selection-chip--${chip.tone}`}
                key={chip.tone}>
                <span className="bulk-selection-chip-dot" />
                {chip.label}
              </span>
            ))}
          </div>
          {approvalWarning && (
            <div className="pending-requests-confirm-warning">
              <strong>{approvalWarning.message}</strong>
              <ul>
                {approvalWarning.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </ReviewActionConfirmModal>
      )}
      <Modal
        destroyOnClose
        footer={null}
        open={actionFailures.length > 0}
        title={t('label.failed-count', { count: actionFailures.length })}
        onCancel={() => setActionFailures([])}>
        <Alert
          showIcon
          message={t('message.partial-action-failure')}
          type="warning"
        />
        <ul className="m-t-md" data-testid="pending-requests-failure-details">
          {actionFailures.map((failure) => (
            <li key={`${failure.id}:${failure.code ?? ''}`}>
              <strong>{failure.id}</strong>
              {failure.code ? ` · ${failure.code}` : ''}
              {failure.message ? ` · ${failure.message}` : ''}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

export default PendingRequestsTab;
