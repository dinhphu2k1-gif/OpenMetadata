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
import { Alert, Button, Result } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME } from '../../constants/Glossary.contant';
import { useAuth } from '../../hooks/authHooks';
import { useTechnicalDictionaryContext } from '../../hooks/useTechnicalDictionaryContext';
import { useTechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { useTechnicalDictionaryRecords } from '../../hooks/useTechnicalDictionaryRecords';
import {
  deleteTechnicalRecord,
  exportTechnicalDictionary,
  exportTechnicalSnapshot,
  rebuildTechnicalIndex,
  updateTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TechnicalAddColumnModal from './TechnicalAddColumnModal.component';
import TechnicalDictionaryHeader from './TechnicalDictionaryHeader.component';
import TechnicalDictionaryTable from './TechnicalDictionaryTable.component';
import TechnicalDictionaryToolbar from './TechnicalDictionaryToolbar.component';
import TechnicalRecordModal, {
  TechnicalRecordFormValues,
  TechnicalRecordModalMode,
} from './TechnicalRecordModal.component';
import TechnicalSnapshotsModal from './TechnicalSnapshotsModal.component';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import '../../components/Glossary/glossaryV1.less';
import './technicalDictionary.less';

interface TechnicalDictionaryPageProps {
  isEmbedded?: boolean;
}

interface PendingConfirmation {
  header: string;
  body: string;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
}

const RESET_BANNER_DAYS = 30;
const RESET_BANNER_STORAGE_PREFIX = 'technicalDictionary.resetBanner.';
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const REVISION_CONFLICT = 'TD_RECORD_REVISION_CONFLICT';
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

/** The banner is shown for a month after a reset unless the user closed it. */
export const isResetBannerVisible = (
  resetAt: number | null | undefined,
  now: number,
  dismissed: boolean
): boolean =>
  Boolean(resetAt) &&
  !dismissed &&
  now - (resetAt as number) <= RESET_BANNER_DAYS * MILLIS_PER_DAY;

const readDismissed = (resetAt?: number | null): boolean => {
  try {
    return (
      Boolean(resetAt) &&
      localStorage.getItem(`${RESET_BANNER_STORAGE_PREFIX}${resetAt}`) === '1'
    );
  } catch {
    return false;
  }
};

const rememberDismissed = (resetAt?: number | null) => {
  try {
    localStorage.setItem(`${RESET_BANNER_STORAGE_PREFIX}${resetAt}`, '1');
  } catch {
    // Storage may be unavailable; the banner then simply shows again.
  }
};

const TechnicalDictionaryPage = ({
  isEmbedded = false,
}: TechnicalDictionaryPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
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
  const [modal, setModal] = useState<{
    mode: TechnicalRecordModalMode;
    row: TechnicalDictionaryRow;
  }>();
  const [isSaving, setIsSaving] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>();
  const [isConfirming, setIsConfirming] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setBannerDismissed(readDismissed(context?.resetAt));
  }, [context?.resetAt]);

  const refreshData = useCallback(() => {
    records.reload();
  }, [records.reload]);

  const fail = useCallback((failure: unknown) => {
    showErrorToast(failure as AxiosError);
  }, []);

  /** A record that vanished or changed means the list on screen is stale. */
  const failRecordAction = useCallback(
    async (failure: unknown) => {
      const code = errorCodeOf(failure);
      if (code === REVISION_CONFLICT) {
        showErrorToast(t('message.technical-record-changed-by-someone'));
        setModal(undefined);
        refreshData();
      } else if (code === RECORD_NOT_FOUND) {
        showErrorToast(
          t('message.technical-dictionary-was-reset', {
            version: dataDictionaryVersion,
          })
        );
        setModal(undefined);
        await reloadContext();
        refreshData();
      } else {
        fail(failure);
      }
    },
    [dataDictionaryVersion, fail, refreshData, reloadContext, t]
  );

  const handleConfirm = useCallback(async () => {
    if (!confirmation) {
      return;
    }
    setIsConfirming(true);
    try {
      await confirmation.onConfirm();
    } finally {
      setIsConfirming(false);
      setConfirmation(undefined);
    }
  }, [confirmation]);

  const handleDelete = useCallback(
    (row: TechnicalDictionaryRow) => {
      setConfirmation({
        header: t('label.delete-declaration'),
        body: t('message.technical-declaration-delete-confirm'),
        confirmText: t('label.delete'),
        onConfirm: async () => {
          try {
            await deleteTechnicalRecord(row.termId, row.revision);
            showSuccessToast(t('message.technical-declaration-deleted'));
            setModal(undefined);
            refreshData();
          } catch (failure) {
            await failRecordAction(failure);
          }
        },
      });
    },
    [failRecordAction, refreshData, t]
  );

  const handleSave = useCallback(
    async (values: TechnicalRecordFormValues) => {
      if (!modal) {
        return;
      }
      const { row } = modal;
      setIsSaving(true);
      try {
        await updateTechnicalRecord(row.termId, {
          expectedRevision: row.revision,
          cde: values.cde === undefined ? row.cdeTermId : values.cde?.id,
          rank: values.rank ?? undefined,
          elementType: values.elementType,
          generationType: values.generationType,
          creationMethod: values.creationMethod,
          timeliness: values.timeliness,
          // The form has no system-owner field; keep the one already set.
          systemOwnerId: values.systemOwnerId ?? row.systemOwner?.id,
        });
        showSuccessToast(t('message.technical-record-updated'));
        setModal(undefined);
        refreshData();
      } catch (failure) {
        await failRecordAction(failure);
      } finally {
        setIsSaving(false);
      }
    },
    [failRecordAction, modal, refreshData, t]
  );

  const handleExport = useCallback(async () => {
    try {
      const file = await exportTechnicalDictionary();
      saveBlob(file.blob, file.fileName);
    } catch (failure) {
      fail(failure);
    }
  }, [fail]);

  const handleDownloadPreviousSnapshot = useCallback(async () => {
    if (!context?.previousDataDictionaryVersion) {
      return;
    }
    try {
      const file = await exportTechnicalSnapshot(
        context.previousDataDictionaryVersion
      );
      saveBlob(file.blob, file.fileName);
    } catch (failure) {
      fail(failure);
    }
  }, [context?.previousDataDictionaryVersion, fail]);

  const handleRebuildIndex = useCallback(async () => {
    try {
      await rebuildTechnicalIndex();
      showSuccessToast(t('message.technical-index-rebuilt'));
      refreshData();
    } catch (failure) {
      fail(failure);
    }
  }, [fail, refreshData, t]);

  const dismissBanner = useCallback(() => {
    rememberDismissed(context?.resetAt);
    setBannerDismissed(true);
  }, [context?.resetAt]);

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

  const showBanner = isResetBannerVisible(
    context.resetAt,
    Date.now(),
    bannerDismissed
  );

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
      {showBanner && context.resetAt && (
        <Alert
          closable
          showIcon
          action={
            context.previousDataDictionaryVersion ? (
              <Button
                data-testid="technical-reset-banner-download"
                size="small"
                type="link"
                onClick={handleDownloadPreviousSnapshot}>
                {t('label.technical-download-snapshot', {
                  version: context.previousDataDictionaryVersion,
                })}
              </Button>
            ) : undefined
          }
          className="m-b-md"
          data-testid="technical-dictionary-reset-banner"
          message={t('message.technical-dictionary-reset-banner', {
            date: formatDateTime(context.resetAt),
            version: dataDictionaryVersion,
          })}
          type="info"
          onClose={dismissBanner}
        />
      )}
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
            capabilities={capabilities}
            emptyContent={
              hasActiveFilters ? undefined : (
                <div data-testid="technical-dictionary-empty">
                  <p>{t('message.technical-dictionary-empty')}</p>
                </div>
              )
            }
            extraTableFilters={
              <TechnicalDictionaryToolbar
                canAddColumn={capabilities.canEdit}
                filters={records.filters}
                options={options}
                searchText={records.searchText}
                onAddColumn={() => setAddColumnOpen(true)}
                onFilters={records.setFilters}
                onSearchText={records.setSearchText}
              />
            }
            isLoading={records.isLoading}
            page={records.page}
            pageSize={records.pageSize}
            rows={records.rows}
            total={records.total}
            onDelete={handleDelete}
            onEdit={(row) => setModal({ mode: 'edit', row })}
            onPageChange={records.setPage}
            onPageSizeChange={records.setPageSize}
            onView={(row) => setModal({ mode: 'view', row })}
          />
          <TechnicalRecordModal
            dataDictionaryVersion={dataDictionaryVersion}
            isSaving={isSaving}
            mode={modal?.mode ?? 'view'}
            open={Boolean(modal)}
            options={options}
            row={modal?.row}
            onCancel={() => setModal(undefined)}
            onDelete={
              capabilities.canEdit && modal
                ? () => handleDelete(modal.row)
                : undefined
            }
            onSave={handleSave}
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
      <ConfirmationModal
        bodyText={confirmation?.body ?? ''}
        cancelText={t('label.cancel')}
        confirmText={confirmation?.confirmText ?? ''}
        header={confirmation?.header ?? ''}
        isLoading={isConfirming}
        visible={Boolean(confirmation)}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={handleConfirm}
      />
      <TechnicalSnapshotsModal
        open={snapshotsOpen}
        onClose={() => setSnapshotsOpen(false)}
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
          onExport={handleExport}
          onImport={() => navigate(ROUTES.TECHNICAL_DICTIONARY_IMPORT)}
          onOpenSnapshots={() => setSnapshotsOpen(true)}
          onRebuildIndex={handleRebuildIndex}
        />
        {content}
      </div>
    </PageLayoutV1>
  );
};

export default TechnicalDictionaryPage;
