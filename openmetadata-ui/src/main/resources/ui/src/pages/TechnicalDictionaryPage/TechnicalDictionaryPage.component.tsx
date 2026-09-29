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
import { Alert, Modal, Result } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME } from '../../constants/Glossary.contant';
import {
  EntityReference,
  GlossaryTerm,
  LabelType,
  State,
  TagSource,
} from '../../generated/entity/data/glossaryTerm';
import { useTechnicalDictionaryCatalog } from '../../hooks/useTechnicalDictionaryCatalog';
import { useTechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { useTechnicalDictionaryRecords } from '../../hooks/useTechnicalDictionaryRecords';
import {
  createGlossaryTermWorkingVersion,
  transitionGlossaryTermWorkflow,
  transitionGlossaryWorkflow,
  updateGlossaryTermWorkingVersion,
} from '../../rest/glossaryAPI';
import {
  exportTechnicalDictionary,
  getTechnicalBootstrapJobs,
  getTechnicalStats,
  retryTechnicalBootstrapJob,
  TechnicalBootstrapJob,
  TechnicalStats,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TechnicalBootstrapStatus from './TechnicalBootstrapStatus.component';
import TechnicalBulkActionModal from './TechnicalBulkActionModal.component';
import TechnicalDictionaryHeader, {
  TechnicalCatalogAction,
} from './TechnicalDictionaryHeader.component';
import TechnicalDictionaryTable from './TechnicalDictionaryTable.component';
import TechnicalDictionaryToolbar from './TechnicalDictionaryToolbar.component';
import TechnicalImportModal from './TechnicalImportModal.component';
import TechnicalRecordModal, {
  TechnicalRecordFormValues,
  TechnicalRecordModalMode,
} from './TechnicalRecordModal.component';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import '../../components/Glossary/glossaryV1.less';
import './technicalDictionary.less';

const BOOTSTRAP_POLL_MS = 5000;

interface TechnicalDictionaryPageProps {
  isEmbedded?: boolean;
}

const nextMinor = (businessVersion: string) => {
  const [major, minor] = businessVersion.split('.');

  return `${major}.${Number(minor) + 1}`;
};

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const TechnicalDictionaryPage = ({
  isEmbedded = false,
}: TechnicalDictionaryPageProps) => {
  const { t } = useTranslation();
  const {
    glossary,
    catalog,
    versions,
    capabilities,
    isLoading: isCatalogLoading,
    error,
    selectVersion,
    reload: reloadCatalog,
  } = useTechnicalDictionaryCatalog();
  const options = useTechnicalDictionaryOptions();
  const records = useTechnicalDictionaryRecords({
    glossaryId: glossary?.id,
    businessVersion: catalog?.businessVersion,
  });
  const [stats, setStats] = useState<TechnicalStats>();
  const [job, setJob] = useState<TechnicalBootstrapJob>();
  const [statsKey, setStatsKey] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [modal, setModal] = useState<{
    mode: TechnicalRecordModalMode;
    row: TechnicalDictionaryRow;
  }>();
  const [isSaving, setIsSaving] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const refreshData = useCallback(() => {
    records.reload();
    setStatsKey((key) => key + 1);
    setSelectedKeys([]);
  }, [records.reload]);

  useEffect(() => {
    if (!glossary?.id || !catalog) {
      return;
    }
    getTechnicalStats(glossary.id, catalog.businessVersion)
      .then(setStats)
      .catch(() => setStats(undefined));
  }, [glossary?.id, catalog?.businessVersion, statsKey]);

  useEffect(() => {
    if (!glossary?.id || !catalog || !capabilities.canViewWorking) {
      setJob(undefined);

      return undefined;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const jobs = await getTechnicalBootstrapJobs(
        glossary.id,
        catalog.businessVersion
      ).catch(() => [] as TechnicalBootstrapJob[]);
      if (!active) {
        return;
      }
      const current = jobs[0];
      setJob(current);
      if (current?.status === 'Running' || current?.status === 'Pending') {
        timer = setTimeout(poll, BOOTSTRAP_POLL_MS);
      } else if (current?.status === 'Succeeded') {
        refreshData();
      }
    };
    poll();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [glossary?.id, catalog?.businessVersion, capabilities.canViewWorking]);

  const fail = useCallback((failure: unknown) => {
    showErrorToast(failure as AxiosError);
  }, []);

  const runRecordAction = useCallback(
    async (
      row: TechnicalDictionaryRow,
      action: 'submit' | 'approve' | 'reject' | 'reopen' | 'createVersion'
    ) => {
      try {
        if (action === 'createVersion') {
          await createGlossaryTermWorkingVersion(
            row.termId,
            nextMinor(row.businessVersion),
            row.parentBusinessVersion
          );
        } else if (action === 'approve') {
          await transitionGlossaryTermWorkflow(
            row.termId,
            'approve',
            { expectedRevision: row.workingRevision as number },
            row.parentBusinessVersion
          );
        } else {
          await transitionGlossaryTermWorkflow(
            row.termId,
            action,
            { expectedRevision: row.workingRevision as number },
            row.parentBusinessVersion
          );
        }
        showSuccessToast(t('message.technical-record-updated'));
        refreshData();
      } catch (failure) {
        fail(failure);
      }
    },
    [fail, refreshData, t]
  );

  const handleSave = useCallback(
    async (values: TechnicalRecordFormValues) => {
      if (!modal) {
        return;
      }
      const { row } = modal;
      const relatedTerms =
        values.cde === undefined
          ? row.cdeRelation
            ? [row.cdeRelation]
            : []
          : values.cde
          ? [{ term: { id: values.cde.id, type: 'glossaryTerm' } }]
          : [];
      const team = options.teams.find(
        (item) => item.id === values.systemOwnerId
      );
      const extension: Record<string, unknown> = {
        ...(values.rank ? { survivorshipRank: values.rank } : {}),
        ...(team ? { systemOwner: { ...team, type: 'team' } } : {}),
      };
      const tags = [
        values.elementType,
        values.generationType,
        values.creationMethod,
        values.timeliness,
      ]
        .filter((fqn): fqn is string => Boolean(fqn))
        .map((tagFQN) => ({
          tagFQN,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        }));
      setIsSaving(true);
      try {
        await updateGlossaryTermWorkingVersion(
          row.termId,
          row.workingRevision as number,
          {
            displayName: row.columnName,
            description: row.description,
            owners: [] as EntityReference[],
            domains: [] as EntityReference[],
            relatedTerms,
            tags,
            extension,
          } as unknown as GlossaryTerm,
          row.parentBusinessVersion
        );
        showSuccessToast(t('message.technical-record-updated'));
        setModal(undefined);
        refreshData();
      } catch (failure) {
        fail(failure);
      } finally {
        setIsSaving(false);
      }
    },
    [fail, modal, options.teams, refreshData, t]
  );

  const isLatestActive = Boolean(
    catalog && versions[0] === catalog.businessVersion && !catalog.isWorking
  );

  const runCatalogAction = useCallback(
    async (action: TechnicalCatalogAction) => {
      if (!glossary || !catalog) {
        return;
      }
      setIsBusy(true);
      try {
        const created =
          action === 'createDraft'
            ? String(Number(catalog.businessVersion) + 1)
            : undefined;
        await transitionGlossaryWorkflow(
          glossary.id,
          action,
          created
            ? { businessVersion: created }
            : { expectedRevision: catalog.workingRevision }
        );
        showSuccessToast(t('message.technical-catalog-updated'));
        await reloadCatalog();
        if (created) {
          selectVersion(created);
        }
        refreshData();
      } catch (failure) {
        fail(failure);
      } finally {
        setIsBusy(false);
      }
    },
    [catalog, fail, glossary, refreshData, reloadCatalog, selectVersion, t]
  );

  const handleCatalogAction = useCallback(
    (action: TechnicalCatalogAction) => {
      if (action === 'approve') {
        Modal.confirm({
          title: t('label.catalog-action-approve'),
          content: t('message.technical-catalog-approve-warning'),
          okText: t('label.approve'),
          cancelText: t('label.cancel'),
          onOk: () => runCatalogAction(action),
        });
      } else {
        runCatalogAction(action);
      }
    },
    [runCatalogAction, t]
  );

  const handleExport = useCallback(async () => {
    if (!glossary || !catalog) {
      return;
    }
    try {
      const file = await exportTechnicalDictionary(
        glossary.id,
        catalog.businessVersion
      );
      saveBlob(file.blob, file.fileName);
    } catch (failure) {
      fail(failure);
    }
  }, [catalog, fail, glossary]);

  const handleRetryBootstrap = useCallback(
    async (target: TechnicalBootstrapJob) => {
      if (!glossary) {
        return;
      }
      setIsBusy(true);
      try {
        setJob(await retryTechnicalBootstrapJob(glossary.id, target.jobId));
      } catch (failure) {
        fail(failure);
      } finally {
        setIsBusy(false);
      }
    },
    [fail, glossary]
  );

  const selectedTermIds = useMemo(
    () =>
      records.rows
        .filter((row) => selectedKeys.includes(row.key))
        .map((row) => row.termId),
    [records.rows, selectedKeys]
  );
  const canBulk =
    Boolean(catalog?.isWorking) &&
    (capabilities.canSubmit ||
      capabilities.canApprove ||
      capabilities.canReject);
  const canImport =
    !(catalog?.isReadOnly ?? true) && capabilities.canEditWorking;

  if (isCatalogLoading && !catalog) {
    return <Loader />;
  }
  if (error || !glossary || !catalog) {
    return (
      <Result
        data-testid="technical-dictionary-error"
        status={error === 'forbidden' ? '403' : '404'}
        title={t(
          error === 'forbidden'
            ? 'message.technical-dictionary-forbidden'
            : 'message.technical-dictionary-not-found'
        )}
      />
    );
  }

  const content = (
    <div
      className={
        isEmbedded
          ? 'tech-dict-content-card tech-dict-content-card-embedded'
          : 'tech-dict-content-card'
      }>
      <TechnicalBootstrapStatus
        canManage={capabilities.canViewWorking}
        isBusy={isBusy}
        job={job}
        onRetry={handleRetryBootstrap}
      />
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
        catalog={catalog}
        extraTableFilters={
          <TechnicalDictionaryToolbar
            canBulk={canBulk}
            canImport={canImport}
            capabilities={capabilities}
            filters={records.filters}
            options={options}
            searchText={records.searchText}
            onBulk={() => setBulkOpen(true)}
            onExport={handleExport}
            onFilters={records.setFilters}
            onImport={() => setImportOpen(true)}
            onSearchText={records.setSearchText}
          />
        }
        isLoading={records.isLoading}
        page={records.page}
        pageSize={records.pageSize}
        rows={records.rows}
        selectedKeys={selectedKeys}
        total={records.total}
        onApprove={(row) => runRecordAction(row, 'approve')}
        onCreateVersion={(row) => runRecordAction(row, 'createVersion')}
        onEdit={(row) => setModal({ mode: 'edit', row })}
        onPageChange={records.setPage}
        onPageSizeChange={records.setPageSize}
        onReject={(row) => runRecordAction(row, 'reject')}
        onReopen={(row) => runRecordAction(row, 'reopen')}
        onSelectionChange={setSelectedKeys}
        onSubmit={(row) => runRecordAction(row, 'submit')}
        onView={(row) => setModal({ mode: 'view', row })}
      />
      <TechnicalRecordModal
        isSaving={isSaving}
        mode={modal?.mode ?? 'view'}
        open={Boolean(modal)}
        options={options}
        row={modal?.row}
        onCancel={() => setModal(undefined)}
        onSave={handleSave}
      />
      <TechnicalBulkActionModal
        businessVersion={catalog.businessVersion}
        capabilities={capabilities}
        filters={records.filters}
        glossaryId={glossary.id}
        open={bulkOpen}
        selectedTermIds={selectedTermIds}
        onClose={() => setBulkOpen(false)}
        onDone={refreshData}
      />
      <TechnicalImportModal
        businessVersion={catalog.businessVersion}
        canCreateVersion={capabilities.canCreateVersion}
        glossaryId={glossary.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={refreshData}
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
          catalog={catalog}
          isBusy={isBusy}
          isLatestActive={isLatestActive}
          stats={stats}
          versions={versions}
          onCatalogAction={handleCatalogAction}
          onSelectVersion={selectVersion}
        />
        {content}
      </div>
    </PageLayoutV1>
  );
};

export default TechnicalDictionaryPage;
