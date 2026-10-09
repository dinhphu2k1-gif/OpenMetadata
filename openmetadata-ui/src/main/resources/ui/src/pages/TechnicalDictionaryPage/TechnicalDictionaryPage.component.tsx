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
import { Alert, Result } from 'antd';
import { AxiosError } from 'axios';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import PendingRequestsTab from '../../components/common/PendingRequestsTab/PendingRequestsTab.component';
import { usePendingRequestsCount } from '../../components/common/PendingRequestsTab/usePendingRequestsCount';
import ReviewActionConfirmModal from '../../components/common/ReviewActionConfirmModal/ReviewActionConfirmModal.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME } from '../../constants/Glossary.contant';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useTechnicalDictionaryContext } from '../../hooks/useTechnicalDictionaryContext';
import { useTechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { useTechnicalDictionaryRecords } from '../../hooks/useTechnicalDictionaryRecords';
import {
  bulkApproveTechnicalRecords,
  bulkRejectTechnicalRecords,
  bulkSubmitTechnicalRecords,
  TechnicalBulkReviewOutcome,
  TechnicalBulkReviewResult,
  exportTechnicalDictionary,
  rebuildTechnicalIndex,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TechnicalAddColumnModal from './TechnicalAddColumnModal.component';
import TechnicalBulkActionBar from './TechnicalBulkActionBar.component';
import TechnicalBulkResultModal from './TechnicalBulkResultModal.component';
import {
  TechnicalBulkResultItem,
  TechnicalDictionaryRow,
} from './technicalDictionary.interface';
import TechnicalDictionaryHeader from './TechnicalDictionaryHeader.component';
import {
  getReviewableTechnicalRecords,
  getSubmittableTechnicalRecords,
  toBulkResultItems,
} from './TechnicalDictionaryRows';
import TechnicalDictionaryTable from './TechnicalDictionaryTable.component';
import TechnicalDictionaryToolbar from './TechnicalDictionaryToolbar.component';
import {
  CHANGE_ACTIONS,
  TECHNICAL_REVIEW_ACTIONS,
  TechnicalReviewAction,
} from './technicalReviewActions';
import { useTechnicalPendingRequestsAdapter } from './useTechnicalPendingRequestsAdapter';
import '../../components/Glossary/glossaryV1.less';
import './technicalDictionary.less';

interface TechnicalDictionaryPageProps {
  isEmbedded?: boolean;
}

interface PendingReview {
  action: TechnicalReviewAction;
  rows: TechnicalDictionaryRow[];
}

interface BulkResultView {
  action: TechnicalReviewAction;
  items: TechnicalBulkResultItem[];
}

const BULK_ACTIONS = {
  submit: bulkSubmitTechnicalRecords,
  approve: bulkApproveTechnicalRecords,
  reject: bulkRejectTechnicalRecords,
};
const RECORD_NOT_FOUND = 'TD_RECORD_NOT_FOUND';

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const errorCodeOf = (error: unknown): string | undefined =>
  (error as AxiosError<{ code?: string }>)?.response?.data?.code;

/**
 * Runs one review action on many rows. Rows that carry a pending change go through the change
 * request API one by one, since there is no bulk endpoint for them; the rest use the bulk one.
 */
const runBulk = async (
  action: keyof typeof BULK_ACTIONS,
  rows: TechnicalDictionaryRow[]
): Promise<TechnicalBulkReviewResult> => {
  const outcomes = new Map<string, TechnicalBulkReviewOutcome>();
  const records = rows.filter((row) => !row.hasPendingChange);
  if (records.length > 0) {
    const response = await BULK_ACTIONS[action](
      records.map((row) => ({ id: row.termId, expectedRevision: row.revision }))
    );
    records.forEach((row, index) =>
      outcomes.set(row.key, response.results[index])
    );
  }
  await Promise.all(
    rows
      .filter((row) => row.hasPendingChange)
      .map(async (row) => {
        try {
          await CHANGE_ACTIONS[action](row.termId, row.revision);
          outcomes.set(row.key, { termId: row.termId, outcome: 'SUCCEEDED' });
        } catch (failure) {
          outcomes.set(row.key, {
            termId: row.termId,
            outcome: 'FAILED',
            code: errorCodeOf(failure),
            message: (failure as AxiosError<{ message?: string }>)?.response
              ?.data?.message,
          });
        }
      })
  );
  const results = rows.map(
    (row) => outcomes.get(row.key) as TechnicalBulkReviewOutcome
  );
  const failed = results.filter((item) => item.outcome === 'FAILED').length;

  return { succeeded: results.length - failed, failed, results };
};

const TechnicalDictionaryPage = ({
  isEmbedded = false,
}: TechnicalDictionaryPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const {
    context,
    dataDictionaryVersion,
    capabilities,
    isLoading: isContextLoading,
    error,
    reload: reloadContext,
  } = useTechnicalDictionaryContext();
  const options = useTechnicalDictionaryOptions();
  const records = useTechnicalDictionaryRecords({
    enabled: Boolean(dataDictionaryVersion) && capabilities.canView,
    dataDictionaryVersion,
  });
  const snapshotVersion = records.snapshotVersion;
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [review, setReview] = useState<PendingReview>();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResultView>();
  const [isBulkResultOpen, setIsBulkResultOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'requests'>('records');
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const pendingRequestsAdapter =
    useTechnicalPendingRequestsAdapter(pendingRefreshKey);
  const { count: pendingRequestsCount, refresh: refreshPendingCount } =
    usePendingRequestsCount(
      pendingRequestsAdapter,
      capabilities.canEdit || capabilities.canApprove,
      pendingRefreshKey
    );

  const selectionScope = JSON.stringify([
    records.filters,
    records.page,
    records.pageSize,
  ]);

  useEffect(() => {
    setSelectedKeys((keys) => (keys.length > 0 ? [] : keys));
  }, [selectionScope]);

  const selectedRows = useMemo(
    () => records.rows.filter((row) => selectedKeys.includes(row.key)),
    [records.rows, selectedKeys]
  );
  const submittableRows = useMemo(
    () => getSubmittableTechnicalRecords(selectedRows, capabilities.canEdit),
    [capabilities.canEdit, selectedRows]
  );
  const reviewableRows = useMemo(
    () =>
      getReviewableTechnicalRecords(
        selectedRows,
        capabilities.canApprove,
        currentUser?.name
      ),
    [capabilities.canApprove, currentUser?.name, selectedRows]
  );

  const refreshData = useCallback(() => {
    records.reload();
    setPendingRefreshKey((value) => value + 1);
  }, [records.reload]);

  const fail = useCallback((failure: unknown) => {
    showErrorToast(failure as AxiosError);
  }, []);

  /** A record that vanished or changed means the list on screen is stale. */
  const startReview = useCallback((pending: PendingReview) => {
    setReview(pending);
    setIsReviewOpen(true);
  }, []);

  const reviewMany = useCallback(
    async ({ action, rows }: PendingReview) => {
      try {
        const result = await runBulk(action, rows);
        setSelectedKeys([]);
        refreshData();
        if (result.failed === 0) {
          showSuccessToast(
            t(TECHNICAL_REVIEW_ACTIONS[action].bulkToastKey, {
              count: result.succeeded,
            })
          );
        } else {
          setBulkResult({
            action,
            items: toBulkResultItems(rows, result.results),
          });
          setIsBulkResultOpen(true);
          if (result.results.some((item) => item.code === RECORD_NOT_FOUND)) {
            await reloadContext();
          }
        }
      } catch (failure) {
        fail(failure);
      }
    },
    [fail, refreshData, reloadContext, t]
  );

  const handleReviewConfirm = useCallback(async () => {
    if (!review) {
      return;
    }
    setIsConfirming(true);
    try {
      await reviewMany(review);
    } finally {
      setIsConfirming(false);
      setIsReviewOpen(false);
    }
  }, [review, reviewMany]);

  /** Every record opens on its own page; a pending change opens as its working view. */
  const handleOpenDetail = useCallback(
    (row: TechnicalDictionaryRow) => {
      const version = snapshotVersion ?? dataDictionaryVersion ?? '';
      const working =
        !snapshotVersion && (row.rowRole === 'CHANGE' || row.hasPendingChange);
      navigate(
        `${ROUTES.TECHNICAL_DICTIONARY_DETAILS.replace(
          ':termId',
          row.termId
        )}?businessVersion=${encodeURIComponent(version)}${
          working ? '&view=working' : ''
        }`
      );
    },
    [dataDictionaryVersion, navigate, snapshotVersion]
  );

  const handleExport = useCallback(async () => {
    try {
      const file = await exportTechnicalDictionary();
      saveBlob(file.blob, file.fileName);
    } catch (failure) {
      fail(failure);
    }
  }, [fail]);

  const handleRebuildIndex = useCallback(async () => {
    try {
      await rebuildTechnicalIndex();
      showSuccessToast(t('message.technical-index-rebuilt'));
      refreshData();
    } catch (failure) {
      fail(failure);
    }
  }, [fail, refreshData, t]);

  const hasActiveFilters =
    Boolean(records.filters.q) ||
    Object.values(records.filters).some(
      (value) => Array.isArray(value) && value.length > 0
    );

  if (isContextLoading && !context) {
    return <Loader />;
  }
  if (error || !context) {
    return (
      <Result
        data-testid="technical-dictionary-error"
        status={error === 'forbidden' ? '403' : '500'}
        title={t(
          error === 'forbidden'
            ? 'message.technical-dictionary-forbidden'
            : 'message.technical-dictionary-load-failed'
        )}
      />
    );
  }

  const notBoundContent = (
    <Result
      data-testid="technical-dictionary-not-bound"
      status="info"
      title={t('message.technical-data-dictionary-not-approved')}
    />
  );

  const content = (
    <div
      className={
        isEmbedded
          ? 'tech-dict-content-card tech-dict-content-card-embedded'
          : 'tech-dict-content-card'
      }>
      {!dataDictionaryVersion ? (
        notBoundContent
      ) : (
        <>
          {records.failed && (
            <Alert
              showIcon
              className="m-b-md"
              data-testid="technical-dictionary-load-error"
              message={t('message.technical-dictionary-load-failed')}
              type="error"
            />
          )}
          <TechnicalDictionaryTable
            bulkActionBar={
              !snapshotVersion &&
              (capabilities.canEdit || capabilities.canApprove) &&
              selectedRows.length > 0 ? (
                <TechnicalBulkActionBar
                  canReview={capabilities.canApprove}
                  canSubmit={capabilities.canEdit}
                  reviewableCount={reviewableRows.length}
                  selectedRows={selectedRows}
                  submittableCount={submittableRows.length}
                  onApprove={() =>
                    startReview({
                      action: 'approve',
                      rows: reviewableRows,
                    })
                  }
                  onClear={() => setSelectedKeys([])}
                  onReject={() =>
                    startReview({
                      action: 'reject',
                      rows: reviewableRows,
                    })
                  }
                  onSubmit={() =>
                    startReview({
                      action: 'submit',
                      rows: submittableRows,
                    })
                  }
                />
              ) : undefined
            }
            emptyContent={
              hasActiveFilters ? undefined : (
                <div data-testid="technical-dictionary-empty">
                  <p>{t('message.technical-dictionary-empty')}</p>
                </div>
              )
            }
            extraTableFilters={
              <TechnicalDictionaryToolbar
                canAddColumn={
                  isEmbedded && capabilities.canEdit && !snapshotVersion
                }
                canSeeDrafts={capabilities.canEdit || capabilities.canApprove}
                filters={records.filters}
                options={options}
                searchOnly={Boolean(snapshotVersion)}
                searchText={records.searchText}
                onAddColumn={() => setAddColumnOpen(true)}
                onFilters={records.setFilters}
                onSearchText={records.setSearchText}
              />
            }
            isLoading={records.isLoading}
            isReadOnly={Boolean(snapshotVersion)}
            page={records.page}
            pageSize={records.pageSize}
            rows={records.rows}
            selectedRowKeys={selectedKeys}
            total={records.total}
            onPageChange={records.setPage}
            onPageSizeChange={records.setPageSize}
            onSelectionChange={setSelectedKeys}
            onView={handleOpenDetail}
          />
          <TechnicalAddColumnModal
            dataDictionaryVersion={dataDictionaryVersion}
            open={addColumnOpen}
            options={options}
            onClose={() => setAddColumnOpen(false)}
            onDone={refreshData}
          />
        </>
      )}
      <ReviewActionConfirmModal
        action={review?.action ?? 'approve'}
        count={review?.rows.length ?? 0}
        isLoading={isConfirming}
        open={isReviewOpen}
        onCancel={() => setIsReviewOpen(false)}
        onConfirm={handleReviewConfirm}
      />
      <TechnicalBulkResultModal
        action={bulkResult?.action ?? 'approve'}
        items={bulkResult?.items ?? []}
        open={isBulkResultOpen}
        onClose={() => setIsBulkResultOpen(false)}
      />
    </div>
  );

  if (isEmbedded) {
    return <div className="tech-dict-embedded-container">{content}</div>;
  }

  return (
    <PageLayoutV1
      mainContainerClassName="technical-dictionary-page-scroll"
      pageTitle={t('label.technical-dictionary')}>
      <div className="tech-dict-page-container">
        <div className="m-b-md">
          <TitleBreadcrumb
            titleLinks={[
              {
                name: TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME,
                url: '',
                activeTitle: true,
              },
            ]}
          />
        </div>
        <TechnicalDictionaryHeader
          capabilities={capabilities}
          dataDictionaryVersion={dataDictionaryVersion}
          isAdmin={isAdminUser}
          snapshotVersion={snapshotVersion}
          onAddColumn={() => setAddColumnOpen(true)}
          onExport={handleExport}
          onImport={() => navigate(ROUTES.TECHNICAL_DICTIONARY_IMPORT)}
          onRebuildIndex={handleRebuildIndex}
          onSelectVersion={records.viewSnapshot}
        />
        <div className="tech-dict-tab-card">
          <div className="tech-dict-tab-list" role="tablist">
            <button
              aria-selected={activeTab === 'records'}
              className={`tech-dict-tab ${
                activeTab === 'records' ? 'active' : ''
              }`}
              data-testid="technical-dictionary-tab"
              role="tab"
              type="button"
              onClick={() => setActiveTab('records')}>
              {t('label.technical-field-plural')}
              <span
                className="tech-dict-tab-count"
                data-testid="technical-dictionary-count">
                {records.total}
              </span>
            </button>
            {(capabilities.canEdit || capabilities.canApprove) &&
              !snapshotVersion && (
                <button
                  aria-selected={activeTab === 'requests'}
                  className={`tech-dict-tab ${
                    activeTab === 'requests' ? 'active' : ''
                  }`}
                  data-testid="technical-pending-requests-tab"
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab('requests')}>
                  {t('label.pending-request-plural')}
                  <span className="tech-dict-tab-count">
                    {pendingRequestsCount}
                  </span>
                </button>
              )}
          </div>
        </div>
        {activeTab === 'requests' ? (
          <div className="tech-dict-content-card">
            <PendingRequestsTab
              adapter={pendingRequestsAdapter}
              canDecide={capabilities.canApprove}
              refreshKey={pendingRefreshKey}
              scopeKey={dataDictionaryVersion ?? ''}
              testId="technical-pending-requests"
              onDecided={() => {
                refreshPendingCount();
                refreshData();
              }}
            />
          </div>
        ) : (
          content
        )}
      </div>
    </PageLayoutV1>
  );
};

export default TechnicalDictionaryPage;
