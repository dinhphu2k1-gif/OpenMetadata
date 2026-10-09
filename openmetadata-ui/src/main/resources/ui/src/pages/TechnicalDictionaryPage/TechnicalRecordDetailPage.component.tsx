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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Form, InputNumber, Result } from 'antd';
import { AxiosError } from 'axios';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import ApprovedRecordHistoryModal from '../../components/common/ApprovedRecordHistory/ApprovedRecordHistoryModal.component';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import { EditIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import ReviewActionConfirmModal from '../../components/common/ReviewActionConfirmModal/ReviewActionConfirmModal.component';
import { TagSelectableList } from '../../components/common/TagSelectableList/TagSelectableList.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UserTeamSelectableList } from '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import WorkflowActionBar from '../../components/common/WorkflowActionBar/WorkflowActionBar.component';
import type {
  WorkflowAction,
  WorkflowMenuItem,
} from '../../components/common/WorkflowActionBar/WorkflowActionBar.interface';
import CDESelectableList from '../../components/Glossary/CDESelectableList/CDESelectableList.component';
import {
  GovernedGlossaryField as Field,
  GovernedGlossarySection as Section,
} from '../../components/Glossary/GlossaryTerms/GovernedGlossaryDetailLayout';
import SurvivorshipBadge from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component';
import { renderDictionaryPastelTag } from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TagsViewer from '../../components/Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { ROUTES } from '../../constants/constants';
import {
  TECHNICAL_CLASSIFICATIONS,
  TECHNICAL_MAX_RANK,
} from '../../constants/TechnicalDictionary.constants';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../generated/type/tagLabel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useTechnicalDictionaryContext } from '../../hooks/useTechnicalDictionaryContext';
import { getGlossaryTermsById } from '../../rest/glossaryAPI';
import {
  cancelTechnicalChangeRequest,
  deleteTechnicalRecord,
  exportTechnicalSnapshot,
  getTechnicalChangeRequest,
  getTechnicalRecord,
  getTechnicalRecordCorrections,
  getTechnicalRecordVersions,
  getTechnicalSnapshotRecord,
  requestTechnicalRecordDeletion,
  saveTechnicalChangeRequest,
  submitTechnicalChangeRequest,
  TechnicalChangeRequest,
  TechnicalOwnerInput,
  TechnicalRecordStatus,
  TechnicalRecordVersions,
  updateTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';
import { fromTechnicalCorrection } from '../../utils/ApprovedRecordHistoryUtils';
import { getGlossaryTermDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import './technicalDictionary.less';
import {
  canReviewTechnicalRecord,
  toTechnicalDictionaryRow,
  toWorkingRow,
} from './TechnicalDictionaryRows';
import {
  CHANGE_ACTIONS,
  RECORD_ACTIONS,
  TechnicalReviewAction,
  TECHNICAL_REVIEW_ACTIONS,
} from './technicalReviewActions';
import TechnicalVersionBadges from './TechnicalVersionBadges.component';

const toOwnerInputs = (
  owners: TechnicalDictionaryRow['systemOwners']
): TechnicalOwnerInput[] =>
  owners.map((owner) => ({ id: owner.id, type: owner.type }));

const ENTITY_STATUS: Record<TechnicalRecordStatus, EntityStatus> = {
  Draft: EntityStatus.Draft,
  'In Review': EntityStatus.InReview,
  Approved: EntityStatus.Approved,
  Rejected: EntityStatus.Rejected,
  Archived: EntityStatus.Archived,
};
const VERSION_PARAM = 'businessVersion';
const VIEW_PARAM = 'view';
const WORKING_VIEW = 'working';
const REVISION_CONFLICT = 'TD_RECORD_REVISION_CONFLICT';
const CHANGE_REQUEST_STALE = 'TD_CHANGE_REQUEST_STALE';
const DELETE_BODY_KEYS: Record<DeleteKind, string> = {
  request: 'message.technical-request-delete-confirm',
  change: 'message.technical-cancel-change-confirm',
  declaration: 'message.technical-declaration-delete-confirm',
};

type LoadState = 'loading' | 'ready' | 'missing' | 'failed';
type DeleteKind = 'request' | 'declaration' | 'change';
type TagField =
  | 'elementType'
  | 'generationType'
  | 'creationMethod'
  | 'timeliness';

interface EditValues {
  rank?: number | null;
  elementType?: string;
  generationType?: string;
  creationMethod?: string;
  timeliness?: string;
}

/** One declared Column on its own page, in any state, now or as it was in a replaced version. */
const TechnicalRecordDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { termId } = useParams<{ termId: string }>();
  const [searchParams] = useSearchParams();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const {
    dataDictionaryVersion,
    capabilities,
    isLoading: isContextLoading,
  } = useTechnicalDictionaryContext();
  const [form] = Form.useForm<EditValues>();
  const [row, setRow] = useState<TechnicalDictionaryRow>();
  const [state, setState] = useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingRank, setIsEditingRank] = useState(false);
  const [openPicker, setOpenPicker] = useState<
    TagField | 'cde' | 'systemOwner'
  >();
  const [isBusy, setIsBusy] = useState(false);
  const [deleteKind, setDeleteKind] = useState<DeleteKind>();
  const [review, setReview] = useState<TechnicalReviewAction>();
  const [versions, setVersions] = useState<TechnicalRecordVersions>();
  const loadedRecordKey = useRef<string>();

  const requestedVersion = searchParams.get(VERSION_PARAM) ?? undefined;
  const viewedVersion =
    requestedVersion && requestedVersion !== dataDictionaryVersion
      ? requestedVersion
      : undefined;
  const wantsWorking = searchParams.get(VIEW_PARAM) === WORKING_VIEW;

  const detailPath = useCallback(
    (version?: string, recordId = termId, working = false) =>
      `${ROUTES.TECHNICAL_DICTIONARY_DETAILS.replace(
        ':termId',
        recordId ?? ''
      )}?${VERSION_PARAM}=${encodeURIComponent(
        version ?? dataDictionaryVersion ?? ''
      )}${working ? `&${VIEW_PARAM}=${WORKING_VIEW}` : ''}`,
    [dataDictionaryVersion, termId]
  );

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const loadCorrections = useCallback(
    async () =>
      (await getTechnicalRecordCorrections(termId ?? '')).map(
        fromTechnicalCorrection
      ),
    [termId]
  );
  const goToList = useCallback(
    () => navigate(ROUTES.TECHNICAL_DICTIONARY),
    [navigate]
  );

  useEffect(() => {
    if (!requestedVersion && dataDictionaryVersion) {
      navigate(detailPath(undefined, termId, wantsWorking), { replace: true });
    }
  }, [
    dataDictionaryVersion,
    detailPath,
    navigate,
    requestedVersion,
    termId,
    wantsWorking,
  ]);

  useEffect(() => {
    if (!termId) {
      return undefined;
    }
    let isCurrent = true;
    getTechnicalRecordVersions(termId)
      .then((loaded) => isCurrent && setVersions(loaded))
      .catch(() => isCurrent && setVersions(undefined));

    return () => {
      isCurrent = false;
    };
  }, [termId]);

  useEffect(() => {
    if (!termId || isContextLoading) {
      return undefined;
    }
    let isCurrent = true;
    const load = async () => {
      if (viewedVersion) {
        const frozen = toTechnicalDictionaryRow(
          await getTechnicalSnapshotRecord(viewedVersion, termId)
        );

        return { row: { ...frozen, status: 'Archived' as const } };
      }
      const record = await getTechnicalRecord(termId);
      if (wantsWorking && record.hasPendingChange) {
        const { working } = toWorkingRow(
          await getTechnicalChangeRequest(termId)
        );

        return { row: working };
      }

      return { row: toTechnicalDictionaryRow(record) };
    };
    const recordKey = `${termId}|${viewedVersion ?? ''}`;
    if (loadedRecordKey.current !== recordKey) {
      setState('loading');
    }
    setIsEditingRank(false);
    load()
      .then((loaded) => {
        if (isCurrent) {
          setRow(loaded.row);
          loadedRecordKey.current = recordKey;
          setState('ready');
        }
      })
      .catch((error: AxiosError) => {
        if (isCurrent) {
          setState(error.response?.status === 404 ? 'missing' : 'failed');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [termId, viewedVersion, wantsWorking, isContextLoading, reloadKey]);

  useEffect(
    () => setIsHistoryOpen(false),
    [termId, viewedVersion, wantsWorking]
  );

  const selectVersion = useCallback(
    (version?: string) =>
      navigate(
        version
          ? detailPath(version)
          : detailPath(undefined, versions?.currentRecordId ?? termId)
      ),
    [detailPath, navigate, termId, versions?.currentRecordId]
  );

  const openCde = useCallback(
    async (cdeTermId: string) => {
      try {
        const term = await getGlossaryTermsById(cdeTermId);
        if (term.fullyQualifiedName) {
          navigate(getGlossaryTermDetailsPath(term.fullyQualifiedName));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [navigate]
  );

  const startRankEdit = useCallback(() => {
    form.setFieldsValue({ rank: row?.rank });
    setIsEditingRank(true);
  }, [form, row?.rank]);

  const failAction = useCallback(
    (failure: unknown) => {
      const code = (failure as AxiosError<{ code?: string }>)?.response?.data
        ?.code;
      if (code === REVISION_CONFLICT || code === CHANGE_REQUEST_STALE) {
        showErrorToast(t('message.technical-record-changed-by-someone'));
        setIsEditingRank(false);
        reload();
      } else {
        showErrorToast(failure as AxiosError);
      }
    },
    [reload, t]
  );

  const applyChangeRequest = useCallback((change: TechnicalChangeRequest) => {
    setRow(toWorkingRow(change).working);
  }, []);

  const saveValues = useCallback(
    async (
      current: TechnicalDictionaryRow,
      values: EditValues,
      cde?: { id: string } | null,
      systemOwners?: TechnicalOwnerInput[]
    ) => {
      const request = {
        expectedRevision: current.revision,
        cde: cde === undefined ? current.cdeTermId : cde?.id,
        rank: values.rank ?? undefined,
        elementType: values.elementType,
        generationType: values.generationType,
        creationMethod: values.creationMethod,
        timeliness: values.timeliness,
        systemOwners: systemOwners ?? toOwnerInputs(current.systemOwners),
      };
      if (current.hasPendingChange) {
        const saved = await saveTechnicalChangeRequest(
          current.termId,
          { ...request, operation: 'UPDATE' },
          true
        );
        if (current.changeRequestStatus === 'Rejected') {
          await submitTechnicalChangeRequest(current.termId, saved.revision);
          showSuccessToast(t('message.technical-record-submitted'));
          reload();
        } else {
          applyChangeRequest(saved);
        }
      } else {
        setRow(
          toTechnicalDictionaryRow(
            await updateTechnicalRecord(current.termId, request)
          )
        );
      }
    },
    [applyChangeRequest, reload, t]
  );

  const currentValues = (current: TechnicalDictionaryRow): EditValues => ({
    rank: current.rank,
    elementType: current.elementType?.fqn,
    generationType: current.generationType?.fqn,
    creationMethod: current.creationMethod?.fqn,
    timeliness: current.timeliness?.fqn,
  });

  const saveField = useCallback(
    async (
      patch: EditValues,
      cde?: { id: string } | null,
      systemOwners?: TechnicalOwnerInput[]
    ) => {
      if (!row) {
        return;
      }
      setIsBusy(true);
      try {
        await saveValues(
          row,
          { ...currentValues(row), ...patch },
          cde,
          systemOwners
        );
        setIsEditingRank(false);
        setOpenPicker(undefined);
      } catch (failure) {
        failAction(failure);
      } finally {
        setIsBusy(false);
      }
    },
    [failAction, row, saveValues]
  );

  const saveRank = useCallback(async () => {
    const { rank } = await form.validateFields(['rank']);
    if (row?.cdeTermId && !rank) {
      form.setFields([
        { name: 'rank', errors: [t('message.technical-rank-required')] },
      ]);
    } else {
      await saveField({ rank });
    }
  }, [form, row?.cdeTermId, saveField, t]);

  const saveCde = useCallback(
    async (cde?: EntityReference) => {
      if (cde && !row?.rank) {
        showErrorToast(t('message.technical-rank-required'));
      } else {
        await saveField({}, cde ?? null);
      }
    },
    [row?.rank, saveField, t]
  );

  const createChangeDraft = useCallback(async () => {
    if (!row) {
      return;
    }
    setIsBusy(true);
    try {
      await saveTechnicalChangeRequest(row.termId, {
        expectedRevision: row.revision,
        operation: 'UPDATE',
        cde: row.cdeTermId,
        rank: row.rank,
        elementType: row.elementType?.fqn,
        generationType: row.generationType?.fqn,
        creationMethod: row.creationMethod?.fqn,
        timeliness: row.timeliness?.fqn,
        systemOwners: toOwnerInputs(row.systemOwners),
      });
      showSuccessToast(t('message.technical-change-draft-created'));
      navigate(detailPath(undefined, row.termId, true));
    } catch (failure) {
      failAction(failure);
    } finally {
      setIsBusy(false);
    }
  }, [detailPath, failAction, navigate, row, t]);

  const handleDelete = useCallback(async () => {
    if (!row || !deleteKind) {
      return;
    }
    try {
      if (deleteKind === 'request') {
        await requestTechnicalRecordDeletion(row.termId, row.revision);
        showSuccessToast(t('message.technical-deletion-request-submitted'));
        navigate(detailPath(undefined, row.termId, true));
      } else if (deleteKind === 'change') {
        await cancelTechnicalChangeRequest(row.termId, row.revision);
        navigate(detailPath(undefined, row.termId));
      } else {
        await deleteTechnicalRecord(row.termId, row.revision);
        showSuccessToast(t('message.technical-declaration-deleted'));
        goToList();
      }
    } catch (failure) {
      failAction(failure);
    } finally {
      setDeleteKind(undefined);
    }
  }, [deleteKind, detailPath, failAction, goToList, navigate, row, t]);

  const handleReview = useCallback(async () => {
    if (!row || !review) {
      return;
    }
    setIsBusy(true);
    try {
      await (row.hasPendingChange ? CHANGE_ACTIONS : RECORD_ACTIONS)[review](
        row.termId,
        row.revision
      );
      showSuccessToast(t(TECHNICAL_REVIEW_ACTIONS[review].recordToastKey));
      if (review === 'approve' && row.hasPendingChange) {
        navigate(detailPath(undefined, row.termId));
      } else {
        reload();
      }
    } catch (failure) {
      failAction(failure);
    } finally {
      setIsBusy(false);
      setReview(undefined);
    }
  }, [detailPath, failAction, navigate, reload, review, row, t]);

  const handleDownload = useCallback(async () => {
    if (!viewedVersion) {
      return;
    }
    try {
      const file = await exportTechnicalSnapshot(viewedVersion);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      showErrorToast(failure as AxiosError);
    }
  }, [viewedVersion]);

  const canWork = Boolean(row && capabilities.canEdit && !viewedVersion);
  const canViewHistory = Boolean(
    row && !viewedVersion && row.status === 'Approved'
  );
  const isChange = Boolean(row?.hasPendingChange);
  const isOpenDraft = row?.status === 'Draft' || row?.status === 'Rejected';
  const isDeleteChange = row?.changeOperation === 'DELETE';
  const canCreateChange = Boolean(
    row && canWork && row.status === 'Approved' && !isChange
  );
  const canSubmitNow = Boolean(row && canWork && row.status === 'Draft');
  const canReviewNow = Boolean(
    row &&
      !viewedVersion &&
      canReviewTechnicalRecord(row, capabilities.canApprove, currentUser?.name)
  );
  const deleteOption: { kind: DeleteKind; labelKey: string } | undefined =
    !row || !canWork
      ? undefined
      : row.status === 'Approved' && !isChange
      ? { kind: 'request', labelKey: 'label.technical-request-delete' }
      : isChange && isOpenDraft
      ? { kind: 'change', labelKey: 'label.technical-cancel-change' }
      : isOpenDraft
      ? { kind: 'declaration', labelKey: 'label.delete-declaration' }
      : undefined;
  const deleteOptionKind = deleteOption?.kind;
  const openHistory = useCallback(() => setIsHistoryOpen(true), []);
  const openRejectReview = useCallback(() => setReview('reject'), []);
  const openApproveReview = useCallback(() => setReview('approve'), []);
  const openSubmitReview = useCallback(() => setReview('submit'), []);
  const openDeleteConfirmation = useCallback(() => {
    if (deleteOptionKind) {
      setDeleteKind(deleteOptionKind);
    }
  }, [deleteOptionKind]);
  const technicalWorkflowActions = useMemo(() => {
    const secondary: WorkflowAction[] = [];
    const primaryCandidates: WorkflowAction[] = [];

    if (canReviewNow) {
      secondary.push({
        key: 'reject',
        label: t('label.reject'),
        onClick: openRejectReview,
        testId: 'technical-record-reject',
        danger: true,
      });
      primaryCandidates.push({
        key: 'approve',
        label: t('label.approve'),
        onClick: openApproveReview,
        testId: 'technical-record-approve',
        variant: 'approve',
      });
    }
    if (canCreateChange) {
      secondary.push({
        key: 'create-change',
        label: t('label.technical-create-change-draft'),
        onClick: createChangeDraft,
        testId: 'technical-record-create-change',
        loading: isBusy,
      });
    }
    if (viewedVersion) {
      secondary.push({
        key: 'download',
        label: t('label.technical-download-snapshot', {
          version: viewedVersion,
        }),
        onClick: handleDownload,
        testId: 'technical-record-download',
      });
    }
    if (canSubmitNow) {
      primaryCandidates.push({
        key: 'submit',
        label: t('label.submit-for-review'),
        onClick: openSubmitReview,
        testId: 'technical-record-submit',
      });
    }

    return {
      secondary: [...secondary, ...primaryCandidates.slice(1)],
      primary: primaryCandidates[0],
    };
  }, [
    canCreateChange,
    canReviewNow,
    canSubmitNow,
    createChangeDraft,
    handleDownload,
    isBusy,
    openApproveReview,
    openRejectReview,
    openSubmitReview,
    t,
    viewedVersion,
  ]);
  const technicalWorkflowMenu = useMemo<WorkflowMenuItem[]>(
    () =>
      deleteOption
        ? [
            {
              key: 'delete',
              name: t(deleteOption.labelKey),
              description: t(DELETE_BODY_KEYS[deleteOption.kind]),
              icon: IconDelete,
              onClick: openDeleteConfirmation,
              testId: 'delete-button',
              danger: true,
            },
          ]
        : [],
    [deleteOption, openDeleteConfirmation, t]
  );

  if (state === 'loading' || isContextLoading) {
    return <Loader />;
  }

  if (state !== 'ready' || !row) {
    return (
      <div data-testid="technical-record-detail-error">
        <Result
          extra={
            <Button type="primary" onClick={goToList}>
              {t('label.technical-dictionary')}
            </Button>
          }
          status={state === 'failed' ? '500' : '404'}
          title={t(
            state === 'failed'
              ? 'message.technical-dictionary-load-failed'
              : viewedVersion
              ? 'message.technical-record-not-in-version'
              : 'message.technical-record-not-found'
          )}
        />
      </div>
    );
  }

  const canEditNow = canWork && !isDeleteChange && isOpenDraft;

  const placeholder = (
    <span className="text-grey-muted">{t('cde.not-set')}</span>
  );
  const editIcon = (label: string, testId: string, onClick?: () => void) => (
    <EditIconButton
      data-testid={testId}
      size="small"
      title={t('label.edit-entity', { entity: label })}
      onClick={onClick}
    />
  );
  const field = (label: string, content: ReactNode, action?: ReactNode) => (
    <Field action={action} label={label}>
      {content}
    </Field>
  );
  const toTagLabels = (
    value: TechnicalDictionaryRow['elementType']
  ): TagLabel[] =>
    value
      ? [
          {
            tagFQN: value.fqn,
            name: value.fqn.split('.').pop(),
            displayName: value.label,
            source: TagSource.Classification,
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ]
      : [];
  const tagField = (name: TagField, label: string, classification: string) => {
    const selectedTags = toTagLabels(row[name]);

    return field(
      label,
      <TagsViewer
        showNoDataPlaceholder
        displayType={DisplayType.READ_MORE}
        entityFqn={row.columnFqn}
        tagType={TagSource.Classification}
        tags={selectedTags}
      />,
      canEditNow ? (
        <TagSelectableList
          hasPermission
          classificationFilter={classification}
          multiSelect={false}
          popoverProps={{
            open: openPicker === name,
            overlayClassName: 'cde-tag-select-popover',
            placement: 'bottomLeft',
            onOpenChange: (open) => setOpenPicker(open ? name : undefined),
          }}
          searchPlaceholder={t('label.search-for-type', { type: label })}
          selectedTags={selectedTags}
          onCancel={() => setOpenPicker(undefined)}
          onUpdate={async (tags) => {
            await saveField({ [name]: tags[0]?.tagFQN });
          }}>
          {editIcon(label, `technical-edit-${name}`)}
        </TagSelectableList>
      ) : undefined
    );
  };

  return (
    <PageLayoutV1
      mainContainerClassName="technical-dictionary-page-scroll"
      pageTitle={row.columnName}>
      <div
        className="tech-dict-page-container"
        data-testid="technical-record-detail">
        <div className="m-b-md">
          <TitleBreadcrumb
            titleLinks={[
              {
                name: t('label.technical-dictionary'),
                url: ROUTES.TECHNICAL_DICTIONARY,
              },
              { name: row.columnName, url: '', activeTitle: true },
            ]}
          />
        </div>

        <div className="tech-dict-page-header">
          <div className="tech-dict-title-row">
            <div className="tech-dict-title-left">
              <div className="tech-dict-icon-wrapper">
                <ColumnBulkIcon height={22} width={22} />
              </div>
              <div className="tech-dict-title-copy">
                <div className="tech-dict-title-heading">
                  <h1
                    className="tech-dict-title"
                    data-testid="technical-record-title">
                    {row.columnName}
                  </h1>
                  {dataDictionaryVersion && (
                    <TechnicalVersionBadges
                      currentStatus={ENTITY_STATUS[row.status]}
                      dataDictionaryVersion={dataDictionaryVersion}
                      snapshotVersion={viewedVersion}
                      testId="technical-record-version-button"
                      versions={versions?.data}
                      onSelectVersion={selectVersion}
                    />
                  )}
                </div>
                <div className="tech-dict-subtitle">
                  <span data-testid="technical-record-path">
                    {row.columnFqn}
                  </span>
                  <CopyToClipboardButton copyText={row.columnFqn} />
                </div>
              </div>
            </div>
            <WorkflowActionBar
              historyTestId="correction-history-button"
              menu={technicalWorkflowMenu}
              menuTestId="technical-record-more-actions"
              primary={technicalWorkflowActions.primary}
              secondary={technicalWorkflowActions.secondary}
              onHistory={canViewHistory ? openHistory : undefined}
            />
          </div>
        </div>

        <div className="tech-dict-tab-card">
          <div className="tech-dict-tab-list" role="tablist">
            <button
              aria-selected
              className="tech-dict-tab active"
              data-testid="technical-record-overview-tab"
              role="tab"
              type="button">
              {t('label.overview')}
            </button>
          </div>
        </div>

        <div className="tech-dict-content-card tech-dict-record-card">
          <Form className="cde-detail-summary" form={form} layout="vertical">
            <section
              className="tech-dict-record-description"
              data-testid="technical-record-description">
              <header>{t('label.description')}</header>
              <div>
                {row.description || (
                  <span className="text-grey-muted">
                    {t('message.technical-no-description')}
                  </span>
                )}
              </div>
            </section>

            <Section
              title={t('label.technical-source-information')}
              variant="classification">
              <Field label={t('label.source')}>
                {row.serviceName
                  ? renderDictionaryPastelTag(row.serviceName, 'source')
                  : placeholder}
              </Field>
              <Field label={t('label.technical-source-table')}>
                {[row.databaseName, row.schemaName, row.tableName]
                  .filter(Boolean)
                  .join(' / ') || placeholder}
              </Field>
              <Field label={t('label.data-type')}>
                {row.dataType
                  ? renderDictionaryPastelTag(row.dataType, 'classification')
                  : placeholder}
              </Field>
              {field(
                t('label.technical-data-steward'),
                row.systemOwners.length
                  ? row.systemOwners.map((owner) => owner.name).join(', ')
                  : placeholder,
                canEditNow ? (
                  <UserTeamSelectableList
                    hasPermission
                    listHeight={200}
                    multiple={{ team: true, user: true }}
                    owner={row.systemOwners.map((owner) => ({
                      id: owner.id,
                      name: owner.name,
                      type: owner.type,
                    }))}
                    popoverProps={{
                      open: openPicker === 'systemOwner',
                      placement: 'bottomLeft',
                      onOpenChange: (open) =>
                        setOpenPicker(open ? 'systemOwner' : undefined),
                    }}
                    onUpdate={async (owners) => {
                      await saveField(
                        {},
                        undefined,
                        (owners ?? []).map((owner) => ({
                          id: owner.id,
                          type: owner.type === 'user' ? 'user' : 'team',
                        }))
                      );
                    }}>
                    {editIcon(
                      t('label.technical-data-steward'),
                      'technical-edit-system-owner'
                    )}
                  </UserTeamSelectableList>
                ) : undefined
              )}
            </Section>

            <Section
              title={t('label.technical-cde-reference')}
              variant="classification">
              {field(
                t('label.cde-code-ref'),
                row.cdeCode ? (
                  <Button
                    className="p-0 h-auto tech-entity-link"
                    data-testid={`cde-code-${row.cdeCode}`}
                    title={row.cdeName || row.cdeCode}
                    type="link"
                    onClick={() => row.cdeTermId && openCde(row.cdeTermId)}>
                    {row.cdeCode}
                  </Button>
                ) : (
                  placeholder
                ),
                canEditNow ? (
                  <CDESelectableList
                    dataDictionaryVersion={dataDictionaryVersion}
                    isOpen={openPicker === 'cde'}
                    selectedCde={
                      row.cdeTermId
                        ? {
                            id: row.cdeTermId,
                            name: row.cdeCode,
                            displayName: row.cdeName,
                            type: 'glossaryTerm',
                          }
                        : undefined
                    }
                    onOpenChange={(open) =>
                      setOpenPicker(open ? 'cde' : undefined)
                    }
                    onSelect={saveCde}>
                    {editIcon(t('label.cde-code-ref'), 'technical-edit-cde')}
                  </CDESelectableList>
                ) : undefined
              )}
              <Field label={t('label.cde-name')}>
                {row.cdeName || placeholder}
              </Field>
              {field(
                t('label.rank'),
                isEditingRank ? (
                  <div className="cde-inline-date-editor">
                    <Form.Item
                      className="m-0"
                      name="rank"
                      rules={[
                        {
                          type: 'number',
                          min: 1,
                          max: TECHNICAL_MAX_RANK,
                          message: t('message.technical-rank-range', {
                            max: TECHNICAL_MAX_RANK,
                          }),
                        },
                      ]}>
                      <InputNumber
                        autoFocus
                        data-testid="technical-rank-input"
                        max={TECHNICAL_MAX_RANK}
                        min={1}
                        precision={0}
                      />
                    </Form.Item>
                    <Button
                      aria-label={t('label.save')}
                      className="cde-inline-date-action"
                      data-testid="technical-rank-save"
                      icon={<CheckOutlined />}
                      loading={isBusy}
                      size="small"
                      type="primary"
                      onClick={saveRank}
                    />
                    <Button
                      aria-label={t('label.cancel')}
                      className="cde-inline-date-action"
                      data-testid="technical-rank-cancel"
                      disabled={isBusy}
                      icon={<CloseOutlined />}
                      size="small"
                      onClick={() => setIsEditingRank(false)}
                    />
                  </div>
                ) : row.rank ? (
                  <SurvivorshipBadge
                    rule={{
                      assetFqn: row.columnFqn || row.termId,
                      rank: row.rank,
                    }}
                  />
                ) : (
                  placeholder
                ),
                canEditNow && !isEditingRank
                  ? editIcon(
                      t('label.rank'),
                      'technical-edit-rank',
                      startRankEdit
                    )
                  : undefined
              )}
            </Section>

            <Section
              title={t('label.technical-specification')}
              variant="classification">
              {tagField(
                'elementType',
                t('label.data-element-type'),
                TECHNICAL_CLASSIFICATIONS.ELEMENT_TYPE
              )}
              {tagField(
                'generationType',
                t('label.generation-type'),
                TECHNICAL_CLASSIFICATIONS.GENERATION_TYPE
              )}
              {tagField(
                'creationMethod',
                t('label.creation-method'),
                TECHNICAL_CLASSIFICATIONS.CREATION_METHOD
              )}
              {tagField(
                'timeliness',
                t('label.timeliness'),
                TECHNICAL_CLASSIFICATIONS.TIMELINESS
              )}
            </Section>
          </Form>
        </div>

        <ConfirmationModal
          bodyText={deleteKind ? t(DELETE_BODY_KEYS[deleteKind]) : ''}
          cancelText={t('label.cancel')}
          confirmText={t(
            deleteKind === 'request'
              ? 'label.technical-request-delete'
              : 'label.delete'
          )}
          header={t(deleteOption?.labelKey ?? 'label.technical-request-delete')}
          visible={Boolean(deleteKind)}
          onCancel={() => setDeleteKind(undefined)}
          onConfirm={handleDelete}
        />
        <ApprovedRecordHistoryModal
          load={loadCorrections}
          open={isHistoryOpen}
          scope="technical"
          subtitle={row.columnFqn}
          onClose={() => setIsHistoryOpen(false)}
        />
        <ReviewActionConfirmModal
          action={review ?? 'approve'}
          isLoading={isBusy}
          message={t(`message.technical-confirm-${review ?? 'approve'}`)}
          open={Boolean(review)}
          onCancel={() => setReview(undefined)}
          onConfirm={handleReview}
        />
      </div>
    </PageLayoutV1>
  );
};

export default TechnicalRecordDetailPage;
