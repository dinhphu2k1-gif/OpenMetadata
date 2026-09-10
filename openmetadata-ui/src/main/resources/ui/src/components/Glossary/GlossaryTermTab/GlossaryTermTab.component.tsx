/*
 *  Copyright 2023 Collate.
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
  DownloadOutlined,
  DownOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  Input,
  MenuProps,
  Modal,
  Row,
  Space,
  TableProps,
  Tooltip,
} from 'antd';
import {
  ColumnsType,
  ExpandableConfig,
  TableRowSelection,
} from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { debounce, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as IconDrag } from '../../../assets/svg/drag.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { ReactComponent as DownUpArrowIcon } from '../../../assets/svg/ic-down-up-arrow.svg';
import { ReactComponent as UpDownArrowIcon } from '../../../assets/svg/ic-up-down-arrow.svg';
import { ReactComponent as PlusOutlinedIcon } from '../../../assets/svg/plus-outlined.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import StatusBadge from '../../../components/common/StatusBadge/StatusBadge.component';
import {
  API_RES_MAX_SIZE,
  DE_ACTIVE_COLOR,
  INITIAL_PAGING_VALUE,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  TEXT_BODY_COLOR,
} from '../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../constants/docs.constants';
import { TaskOperation } from '../../../constants/Feeds.constants';
import {
  CDE_DEFAULT_VISIBLE_COLUMNS,
  CDE_GLOSSARY_TABLE_PREFERENCE_KEY,
  CDE_GLOSSARY_TERM_FIELDS,
  CDE_STATIC_VISIBLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  DQ_DEFAULT_VISIBLE_COLUMNS,
  DQ_GLOSSARY_TABLE_PREFERENCE_KEY,
  DQ_GLOSSARY_TERM_FIELDS,
  DQ_STATIC_VISIBLE_COLUMNS,
  GLOSSARY_TERM_STATUS_OPTIONS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS,
  isDataDictionaryGlossary,
  isDataQualityGlossary,
  isTechnicalDictionaryGlossary,
  STATIC_VISIBLE_COLUMNS,
} from '../../../constants/Glossary.contant';
import { TABLE_CONSTANTS } from '../../../constants/Teams.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { CursorType } from '../../../enums/pagination.enum';
import { ResolveTask } from '../../../generated/api/feed/resolveTask';
import {
  EntityReference,
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import {
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { User } from '../../../generated/entity/teams/user';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getAllFeeds, updateTask } from '../../../rest/feedsAPI';
import {
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryTermChildrenLazy,
  getGlossaryTerms,
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityBulkEditPath } from '../../../utils/EntityPureUtils';
import {
  EntityStatusClass,
  getEntityStatusLabel,
} from '../../../utils/EntityStatusUtils';
import Fqn from '../../../utils/Fqn';
import {
  buildTree,
  findExpandableKeysForArray,
  glossaryTermTableColumnsWidth,
  permissionForApproveOrReject,
} from '../../../utils/GlossaryUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { DraggableBodyRowProps } from '../../common/Draggable/DraggableBodyRowProps.interface';
import Loader from '../../common/Loader/Loader';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import StatusAction from '../../common/StatusAction/StatusAction';
import Table from '../../common/Table/Table';
import TagButton from '../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';
import {
  CDE_TAG_CLASSIFICATIONS,
  getCDEGlossaryTableColumns,
  getCDEReferenceLabel,
} from './CDEGlossaryTableColumns';
import CDEFilterDropdown from './CDEFilterDropdown.component';
import {
  DQ_TAG_CLASSIFICATIONS,
  getDQGlossaryTableColumns,
  getDQReferenceLabel,
} from './DQGlossaryTableColumns';
import TechnicalDictionaryPage from '../../../pages/TechnicalDictionaryPage/TechnicalDictionaryPage.component';
import { exportCDEToExcel } from '../CDEImportExport/CDEImportExport.utils';
import { getEntityImportPath } from '../../../utils/EntityPureUtils';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';
import GlossaryBulkActionBar from './GlossaryBulkActionBar/GlossaryBulkActionBar.component';
import GlossaryBulkActionModal, {
  BulkActionType,
} from './GlossaryBulkActionModal/GlossaryBulkActionModal.component';

const GlossaryTermTab = ({ isGlossary, className }: GlossaryTermTabProps) => {
  const navigate = useNavigate();
  const { currentUser, selectedPersona } = useApplicationStore();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const {
    activeGlossary,
    glossaryChildTerms,
    setGlossaryChildTerms,
    onAddGlossaryTerm,
    onEditGlossaryTerm,
    refreshGlossaryTerms,
  } = useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const isCDEGlossary = useMemo(() => {
    const glossary = isGlossary
      ? activeGlossary
      : (activeGlossary as unknown as GlossaryTerm).glossary;

    return isDataDictionaryGlossary(
      glossary?.name,
      glossary?.displayName,
      activeGlossary.fullyQualifiedName
    );
  }, [activeGlossary, isGlossary]);

  const canImportCDE = useMemo(() => {
    if (currentUser?.isAdmin) {
      return true;
    }
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    const isSteward =
      userRoles.some((r) => r.includes('steward')) ||
      personaName.includes('steward');

    const isProposer =
      !isSteward &&
      (userRoles.some((r) => r.includes('proposer')) ||
        personaName.includes('proposer'));

    return isProposer;
  }, [currentUser, selectedPersona]);
  const isDQGlossary = useMemo(() => {
    const glossary = isGlossary
      ? activeGlossary
      : (activeGlossary as unknown as GlossaryTerm).glossary;

    return isDataQualityGlossary(
      glossary?.name,
      glossary?.displayName,
      activeGlossary.fullyQualifiedName
    );
  }, [activeGlossary, isGlossary]);
  const isTechGlossary = useMemo(() => {
    const glossary = isGlossary
      ? activeGlossary
      : (activeGlossary as unknown as GlossaryTerm).glossary;

    return isTechnicalDictionaryGlossary(
      glossary?.name,
      glossary?.displayName,
      activeGlossary.fullyQualifiedName
    );
  }, [activeGlossary, isGlossary]);
  const [termTaskThreads, setTermTaskThreads] = useState<
    Record<string, Thread[]>
  >({});

  const { glossaryTerms, expandableKeys } = useMemo(() => {
    const terms = Array.isArray(glossaryChildTerms)
      ? (glossaryChildTerms as ModifiedGlossaryTerm[])
      : [];

    return {
      expandableKeys: findExpandableKeysForArray(terms),
      glossaryTerms: terms,
    };
  }, [glossaryChildTerms, findExpandableKeysForArray]);

  const isConsumer = useMemo(() => {
    if (currentUser?.isAdmin) {
      return false;
    }
    const userRoles = currentUser?.roles?.map((r) => r.name) ?? [];
    const isElevated = userRoles.some((r) =>
      ['DataSteward', 'DataProposer', 'Admin', 'Organization'].includes(r)
    );

    return (
      !isElevated &&
      userRoles.some((r) => ['BasicConsumer', 'DataConsumer'].includes(r))
    );
  }, [currentUser]);

  const isUserSteward = useMemo(() => {
    if (currentUser?.isAdmin) {
      return true;
    }
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    return (
      userRoles.some((r) => r.includes('steward')) ||
      personaName.includes('steward')
    );
  }, [currentUser, selectedPersona]);

  const isUserProposer = useMemo(() => {
    if (currentUser?.isAdmin) {
      return true;
    }
    if (isUserSteward) {
      return false;
    }
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    return (
      userRoles.some((r) => r.includes('proposer')) ||
      personaName.includes('proposer')
    );
  }, [currentUser, selectedPersona, isUserSteward]);

  const isGlossaryReviewer = useMemo(() => {
    return Boolean(
      activeGlossary.reviewers?.some((r) => r.id === currentUser?.id)
    );
  }, [activeGlossary.reviewers, currentUser?.id]);

  const canSubmitForReview = useMemo(() => {
    if (currentUser?.isAdmin) {
      return true;
    }

    if (isUserSteward) {
      return false;
    }

    return isUserProposer;
  }, [currentUser?.isAdmin, isUserProposer, isUserSteward]);

  const canApproveOrReject = useMemo(() => {
    if (currentUser?.isAdmin) {
      return true;
    }

    return isUserSteward || isGlossaryReviewer;
  }, [currentUser?.isAdmin, isUserSteward, isGlossaryReviewer]);

  const canSelectRows = useMemo(() => {
    if (isConsumer) {
      return false;
    }

    return canSubmitForReview || canApproveOrReject;
  }, [isConsumer, canSubmitForReview, canApproveOrReject]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedTermsMap, setSelectedTermsMap] = useState<
    Map<string, ModifiedGlossaryTerm>
  >(new Map());

  const selectedTerms = useMemo(() => {
    return Array.from(selectedTermsMap.values());
  }, [selectedTermsMap]);

  const [bulkModalConfig, setBulkModalConfig] = useState<{
    open: boolean;
    actionType: BulkActionType;
    terms: ModifiedGlossaryTerm[];
  }>({
    open: false,
    actionType: 'submitForReview',
    terms: [],
  });

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedTermsMap(new Map());
  }, []);

  useEffect(() => {
    handleClearSelection();
  }, [activeGlossary?.fullyQualifiedName, handleClearSelection]);

  const handleRowSelectionChange = useCallback(
    (newKeys: React.Key[], newSelectedRows: ModifiedGlossaryTerm[]) => {
      setSelectedRowKeys(newKeys);
      setSelectedTermsMap((prevMap) => {
        const nextMap = new Map(prevMap);
        const newKeySet = new Set(newKeys);
        for (const key of nextMap.keys()) {
          if (!newKeySet.has(key)) {
            nextMap.delete(key);
          }
        }
        newSelectedRows.forEach((row) => {
          if (row && !row.isLoadMoreButton && row.fullyQualifiedName) {
            nextMap.set(row.fullyQualifiedName, row);
          }
        });

        return nextMap;
      });
    },
    []
  );

  const rowSelection: TableRowSelection<ModifiedGlossaryTerm> | undefined =
    useMemo(() => {
      if (!canSelectRows) {
        return undefined;
      }

      return {
        type: 'checkbox',
        selectedRowKeys,
        onChange: handleRowSelectionChange,
        getCheckboxProps: (record: ModifiedGlossaryTerm) => ({
          disabled: Boolean(record.isLoadMoreButton),
        }),
      };
    }, [canSelectRows, selectedRowKeys, handleRowSelectionChange]);

  const handleBulkSubmitForReview = useCallback(
    (termsToSubmit?: ModifiedGlossaryTerm[]) => {
      const draftTerms =
        termsToSubmit && termsToSubmit.length > 0
          ? termsToSubmit
          : selectedTerms.filter(
              (term) => term.entityStatus === EntityStatus.Draft
            );
      if (draftTerms.length === 0) {
        return;
      }
      setBulkModalConfig({
        open: true,
        actionType: 'submitForReview',
        terms: draftTerms,
      });
    },
    [selectedTerms]
  );

  const handleBulkApprove = useCallback(
    (termsToApprove?: ModifiedGlossaryTerm[]) => {
      const inReviewTerms =
        termsToApprove && termsToApprove.length > 0
          ? termsToApprove
          : selectedTerms.filter(
              (term) => term.entityStatus === EntityStatus.InReview
            );
      if (inReviewTerms.length === 0) {
        return;
      }
      setBulkModalConfig({
        open: true,
        actionType: 'approve',
        terms: inReviewTerms,
      });
    },
    [selectedTerms]
  );

  const handleBulkReject = useCallback(
    (termsToReject?: ModifiedGlossaryTerm[]) => {
      const inReviewTerms =
        termsToReject && termsToReject.length > 0
          ? termsToReject
          : selectedTerms.filter(
              (term) => term.entityStatus === EntityStatus.InReview
            );
      if (inReviewTerms.length === 0) {
        return;
      }
      setBulkModalConfig({
        open: true,
        actionType: 'reject',
        terms: inReviewTerms,
      });
    },
    [selectedTerms]
  );

  const handleBulkRevoke = useCallback(
    (termsToRevoke?: ModifiedGlossaryTerm[]) => {
      const approvedTerms =
        termsToRevoke && termsToRevoke.length > 0
          ? termsToRevoke
          : selectedTerms.filter(
              (term) =>
                (term.entityStatus ?? EntityStatus.Approved) ===
                EntityStatus.Approved
            );
      if (approvedTerms.length === 0) {
        return;
      }
      setBulkModalConfig({
        open: true,
        actionType: 'revoke',
        terms: approvedTerms,
      });
    },
    [selectedTerms]
  );

  const handleCloseBulkModal = useCallback(() => {
    setBulkModalConfig((prev) => ({ ...prev, open: false, terms: [] }));
  }, []);

  const [movedGlossaryTerm, setMovedGlossaryTerm] =
    useState<MoveGlossaryTermType>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isStatusDropdownVisible, setIsStatusDropdownVisible] =
    useState<boolean>(false);
  const [statusDropdownSelection, setStatusDropdownSelection] = useState<
    string[]
  >(() =>
    isConsumer
      ? [EntityStatus.Approved]
      : ['all', EntityStatus.Draft, EntityStatus.InReview, EntityStatus.Approved]
  );
  const [selectedStatus, setSelectedStatus] = useState<string[]>(() =>
    isConsumer
      ? [EntityStatus.Approved]
      : ['all', EntityStatus.Draft, EntityStatus.InReview, EntityStatus.Approved]
  );

  useEffect(() => {
    if (isConsumer) {
      setStatusDropdownSelection([EntityStatus.Approved]);
      setSelectedStatus([EntityStatus.Approved]);
    }
  }, [isConsumer]);
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const [totalTermsCount, setTotalTermsCount] = useState<number>(0);

  // CDE Column Filters
  const [selectedCdeDomains, setSelectedCdeDomains] = useState<string[]>(['all']);
  const [selectedCdeDataSources, setSelectedCdeDataSources] = useState<string[]>(['all']);
  const [selectedCdeOwners, setSelectedCdeOwners] = useState<string[]>(['all']);
  const [selectedCdeClassifications, setSelectedCdeClassifications] = useState<string[]>(['all']);
  const [allCdeTerms, setAllCdeTerms] = useState<ModifiedGlossaryTerm[]>([]);

  // DQ Column Filters
  const [selectedDqDimensions, setSelectedDqDimensions] = useState<string[]>(['all']);
  const [selectedDqDataSources, setSelectedDqDataSources] = useState<string[]>(['all']);
  const [selectedDqOwners, setSelectedDqOwners] = useState<string[]>(['all']);
  const [selectedDqMethods, setSelectedDqMethods] = useState<string[]>(['all']);
  const [selectedDqTargetPopulations, setSelectedDqTargetPopulations] = useState<string[]>(['all']);
  const [allDqTerms, setAllDqTerms] = useState<ModifiedGlossaryTerm[]>([]);

  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    pageSize,
    pagingCursor,
  } = usePaging(PAGE_SIZE_BASE);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});

  const previousGlossaryFQNRef = useRef<string>();
  const lastFetchKeyRef = useRef('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [toggleExpandBtn, setToggleExpandBtn] = useState(false);
  // handle search
  const handleSearch = useCallback(
    async (value: string) => {
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      setSearchTerm(value);
    },
    [handlePageChange]
  );

  const debouncedSetSearchTerm = useCallback(debounce(handleSearch, 500), [
    handleSearch,
  ]);

  // Reset CDE & DQ filters when active glossary changes
  useEffect(() => {
    setSelectedCdeDomains(['all']);
    setSelectedCdeDataSources(['all']);
    setSelectedCdeOwners(['all']);
    setSelectedCdeClassifications(['all']);
    setSelectedDqDimensions(['all']);
    setSelectedDqDataSources(['all']);
    setSelectedDqOwners(['all']);
    setSelectedDqMethods(['all']);
    setSelectedDqTargetPopulations(['all']);
  }, [activeGlossary?.fullyQualifiedName]);

  // Fetch full list of CDE terms for options and comprehensive client-side filtering
  const fetchAllCdeTerms = useCallback(async () => {
    if (!activeGlossary?.id || !isCDEGlossary) {
      return;
    }
    try {
      const key = isGlossary ? 'glossary' : 'parent';
      const { data } = await getGlossaryTerms({
        [key]: activeGlossary.id,
        limit: API_RES_MAX_SIZE,
        fields: CDE_GLOSSARY_TERM_FIELDS,
        ...(isConsumer ? { entityStatus: EntityStatus.Approved } : {}),
      });
      setAllCdeTerms(data as ModifiedGlossaryTerm[]);
    } catch (error) {
      // fallback to glossaryChildTerms
    }
  }, [activeGlossary?.id, isCDEGlossary, isGlossary, isConsumer]);

  useEffect(() => {
    if (isCDEGlossary && activeGlossary?.id) {
      fetchAllCdeTerms();
    }
  }, [fetchAllCdeTerms, isCDEGlossary, activeGlossary?.id]);

  // Fetch full list of DQ terms for options and comprehensive client-side filtering
  const fetchAllDqTerms = useCallback(async () => {
    if (!activeGlossary?.id || !isDQGlossary) {
      return;
    }
    try {
      const key = isGlossary ? 'glossary' : 'parent';
      const { data } = await getGlossaryTerms({
        [key]: activeGlossary.id,
        limit: API_RES_MAX_SIZE,
        fields: DQ_GLOSSARY_TERM_FIELDS,
        ...(isConsumer ? { entityStatus: EntityStatus.Approved } : {}),
      });
      setAllDqTerms(data as ModifiedGlossaryTerm[]);
    } catch (error) {
      // fallback to glossaryChildTerms
    }
  }, [activeGlossary?.id, isDQGlossary, isGlossary, isConsumer]);

  useEffect(() => {
    if (isDQGlossary && activeGlossary?.id) {
      fetchAllDqTerms();
    }
  }, [fetchAllDqTerms, isDQGlossary, activeGlossary?.id]);


  const hasActiveCdeFilters = useMemo(
    () =>
      !selectedCdeDomains.includes('all') ||
      !selectedCdeDataSources.includes('all') ||
      !selectedCdeOwners.includes('all') ||
      !selectedCdeClassifications.includes('all'),
    [
      selectedCdeDomains,
      selectedCdeDataSources,
      selectedCdeOwners,
      selectedCdeClassifications,
    ]
  );

  const hasActiveDqFilters = useMemo(
    () =>
      !selectedDqDimensions.includes('all') ||
      !selectedDqDataSources.includes('all') ||
      !selectedDqOwners.includes('all') ||
      !selectedDqMethods.includes('all') ||
      !selectedDqTargetPopulations.includes('all'),
    [
      selectedDqDimensions,
      selectedDqDataSources,
      selectedDqOwners,
      selectedDqMethods,
      selectedDqTargetPopulations,
    ]
  );

  const sourceTermsForOptions = useMemo(() => {
    if (allCdeTerms.length > 0) {
      return allCdeTerms;
    }
    if (Array.isArray(glossaryChildTerms)) {
      return glossaryChildTerms as ModifiedGlossaryTerm[];
    }

    return [];
  }, [allCdeTerms, glossaryChildTerms]);

  const sourceDqTermsForOptions = useMemo(() => {
    if (allDqTerms.length > 0) {
      return allDqTerms;
    }
    if (Array.isArray(glossaryChildTerms)) {
      return glossaryChildTerms as ModifiedGlossaryTerm[];
    }

    return [];
  }, [allDqTerms, glossaryChildTerms]);

  const cdeDomainOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceTermsForOptions.forEach((term) => {
      term.domains?.forEach((d) => {
        const label = d.displayName || d.name || '';
        if (label) {
          map.set(label, label);
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceTermsForOptions]);

  const cdeDataSourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (t.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.dataSource) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceTermsForOptions]);

  const cdeOwnerOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceTermsForOptions.forEach((term) => {
      term.owners?.forEach((o) => {
        const label = getCDEReferenceLabel(o);
        const val = o.id || o.fullyQualifiedName || o.name || '';
        if (label && val) {
          map.set(val, label);
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceTermsForOptions]);

  const cdeClassificationOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (
          t.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.dataClassification
        ) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceTermsForOptions]);

  const dqDimensionOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceDqTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dimension) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceDqTermsForOptions]);

  const dqDataSourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceDqTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dataSource) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceDqTermsForOptions]);

  const dqOwnerOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceDqTermsForOptions.forEach((term) => {
      term.owners?.forEach((o) => {
        const label = getDQReferenceLabel(o);
        const val = o.id || o.fullyQualifiedName || o.name || '';
        if (label && val) {
          map.set(val, label);
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceDqTermsForOptions]);

  const dqMethodOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceDqTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.method) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceDqTermsForOptions]);

  const dqTargetPopulationOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceDqTermsForOptions.forEach((term) => {
      term.tags?.forEach((t) => {
        if (
          t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.targetPopulation
        ) {
          const label =
            t.displayName ??
            t.name ??
            t.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
            '';
          if (label) {
            map.set(t.tagFQN, label);
          }
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [sourceDqTermsForOptions]);

  const availableCdeDomains = useMemo(() => {
    const domainMap = new Map<string, EntityReference>();
    (activeGlossary.domains ?? []).forEach((d) => {
      if (d.fullyQualifiedName) {
        domainMap.set(d.fullyQualifiedName, d);
      }
    });
    sourceTermsForOptions.forEach((term) => {
      term.domains?.forEach((d) => {
        if (d.fullyQualifiedName) {
          domainMap.set(d.fullyQualifiedName, d);
        }
      });
    });

    return Array.from(domainMap.values());
  }, [activeGlossary.domains, sourceTermsForOptions]);

  const fetchChildTerms = async (parentFQN: string, after?: string) => {
    setLoadingChildren((prev) => ({ ...prev, [parentFQN]: true }));
    try {
      const response = isDQGlossary
        ? await getGlossaryTermChildrenLazy(
            parentFQN,
            50,
            after,
            DQ_GLOSSARY_TERM_FIELDS
          )
        : isCDEGlossary
        ? await getGlossaryTermChildrenLazy(
            parentFQN,
            50,
            after,
            CDE_GLOSSARY_TERM_FIELDS
          )
        : await getGlossaryTermChildrenLazy(parentFQN, 50, after);
      const { data, paging } = response;

      // Validate glossaryChildTerms is an array
      if (!Array.isArray(glossaryChildTerms)) {
        return;
      }

      // Recursive function to update nested terms
      const updateNestedTerms = (
        terms: ModifiedGlossary[]
      ): ModifiedGlossary[] => {
        return terms.map((term) => {
          if (term.fullyQualifiedName === parentFQN) {
            // Merge existing children with new children, avoiding duplicates
            const existingChildren = term.children || [];
            const newChildren = (data as ModifiedGlossary[]) || [];
            const mergedChildren = [...existingChildren];

            newChildren.forEach((newChild) => {
              if (
                !mergedChildren.some(
                  (existing) =>
                    existing.fullyQualifiedName === newChild.fullyQualifiedName
                )
              ) {
                mergedChildren.push(newChild);
              }
            });

            return {
              ...term,
              children: mergedChildren,
              childrenCount: paging?.total ?? term.childrenCount,
              paging,
            };
          } else if (term.children && term.children.length > 0) {
            return {
              ...term,
              children: updateNestedTerms(term.children as ModifiedGlossary[]),
            };
          }

          return term;
        }) as ModifiedGlossary[];
      };

      setGlossaryChildTerms(updateNestedTerms(glossaryChildTerms));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingChildren((prev) => ({ ...prev, [parentFQN]: false }));
    }
  };

  const fetchAllTerms = async (
    pagingCursor: PagingHandlerParams = {
      cursorType: null,
      cursorValue: undefined,
    }
  ) => {
    if (!activeGlossary?.fullyQualifiedName) {
      return;
    }

    setIsTableLoading(true);
    try {
      let data: ModifiedGlossary[] = [];
      let pagingResponse: Paging | undefined;

      const rawStatuses = selectedStatus.filter((s) => s !== 'all');
      const entityStatusParam = isConsumer
        ? [EntityStatus.Approved]
        : rawStatuses.length === 0 || selectedStatus.includes('all')
        ? [EntityStatus.Draft, EntityStatus.InReview, EntityStatus.Approved]
        : (rawStatuses as EntityStatus[]);

      // Use search API if search term is present
      if (searchTerm.trim()) {
        const response = await searchGlossaryTermsPaginated({
          q: searchTerm,
          glossaryFqn: activeGlossary.fullyQualifiedName,
          limit: pageSize,
          entityStatus: entityStatusParam?.join(','),
        });
        data = response.data;
        pagingResponse = response.paging;
      } else {
        const after =
          pagingCursor.cursorType === CursorType.AFTER
            ? pagingCursor.cursorValue
            : undefined;
        const before =
          pagingCursor.cursorType === CursorType.BEFORE
            ? pagingCursor.cursorValue
            : undefined;

        // Use regular listing API when no search term
        const response = isDQGlossary
          ? await getFirstLevelGlossaryTermsPaginated(
              activeGlossary?.fullyQualifiedName || '',
              pageSize,
              after,
              entityStatusParam?.join(','),
              DQ_GLOSSARY_TERM_FIELDS,
              before
            )
          : isCDEGlossary
          ? await getFirstLevelGlossaryTermsPaginated(
              activeGlossary?.fullyQualifiedName || '',
              pageSize,
              after,
              entityStatusParam?.join(','),
              CDE_GLOSSARY_TERM_FIELDS,
              before
            )
          : await getFirstLevelGlossaryTermsPaginated(
              activeGlossary?.fullyQualifiedName || '',
              pageSize,
              after,
              entityStatusParam?.join(','),
              undefined,
              before
            );
        data = response.data;
        pagingResponse = response.paging;
      }

      setTotalTermsCount(pagingResponse?.total ?? data.length);
      handlePagingChange(pagingResponse ?? { total: data.length });
      setGlossaryChildTerms(data as ModifiedGlossary[]);
      setExpandedRowKeys([]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTableLoading(false);
    }
  };

  const handleBulkActionSuccess = useCallback(() => {
    handleCloseBulkModal();
    handleClearSelection();
    refreshGlossaryTerms?.();
    fetchAllTerms();
    if (isCDEGlossary) {
      fetchAllCdeTerms();
    }
    if (isDQGlossary) {
      fetchAllDqTerms();
    }
  }, [
    handleCloseBulkModal,
    handleClearSelection,
    refreshGlossaryTerms,
    fetchAllTerms,
    isCDEGlossary,
    fetchAllCdeTerms,
    isDQGlossary,
    fetchAllDqTerms,
  ]);

  const fetchExpadedTree = async () => {
    setIsTableLoading(true);
    setIsExpandingAll(true);
    const key = isGlossary ? 'glossary' : 'parent';
    const { data } = await getGlossaryTerms({
      [key]: activeGlossary?.id || '',
      limit: API_RES_MAX_SIZE,
      fields: [
        TabSpecificField.OWNERS,
        TabSpecificField.PARENT,
        TabSpecificField.CHILDREN,
        TabSpecificField.REVIEWERS,
        ...(isDQGlossary
          ? [
              TabSpecificField.TAGS,
              TabSpecificField.EXTENSION,
              TabSpecificField.RELATED_TERMS,
            ]
          : isCDEGlossary
          ? [
              TabSpecificField.TAGS,
              TabSpecificField.DOMAINS,
              TabSpecificField.EXTENSION,
            ]
          : []),
      ],
      ...(isConsumer ? { entityStatus: EntityStatus.Approved } : {}),
    });
    setGlossaryChildTerms(buildTree(data) as ModifiedGlossary[]);
    const keys = data.reduce((prev, curr) => {
      if (curr.children?.length) {
        prev.push(curr.fullyQualifiedName ?? '');
      }

      return prev;
    }, [] as string[]);

    setExpandedRowKeys(keys);
    setIsTableLoading(false);
    setIsExpandingAll(false);
  };
  const fetchAllTasks = useCallback(async () => {
    if (!activeGlossary?.fullyQualifiedName) {
      return;
    }

    const entityType = isGlossary
      ? EntityType.GLOSSARY
      : EntityType.GLOSSARY_TERM;

    try {
      const { data } = await getAllFeeds(
        `<#E::${entityType}::${activeGlossary.fullyQualifiedName}>`,
        undefined,
        ThreadType.Task,
        undefined,
        ThreadTaskStatus.Open,
        undefined,
        API_RES_MAX_SIZE
      );

      // Organize tasks by glossary term FQN
      const tasksByTerm = data.reduce(
        (acc: Record<string, Thread[]>, thread: Thread) => {
          const termFQN = thread.about;
          if (termFQN) {
            if (!acc[termFQN]) {
              acc[termFQN] = [];
            }
            acc[termFQN].push(thread);
          }

          return acc;
        },
        {}
      );

      setTermTaskThreads(tasksByTerm);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [activeGlossary?.fullyQualifiedName]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const currentFQN = activeGlossary?.fullyQualifiedName;
    const previousFQN = previousGlossaryFQNRef.current;

    if (currentFQN && currentFQN !== previousFQN) {
      // Clear existing terms when switching glossaries
      previousGlossaryFQNRef.current = currentFQN;
      lastFetchKeyRef.current = '';

      if (previousFQN !== undefined) {
        setToggleExpandBtn(false);
        setGlossaryChildTerms([]);
        handlePageChange(INITIAL_PAGING_VALUE, {
          cursorType: null,
          cursorValue: undefined,
        });
      }
    }
  }, [activeGlossary?.fullyQualifiedName]);

  // Clear terms when component unmounts
  useEffect(() => {
    return () => {
      setGlossaryChildTerms([]);
    };
  }, []);

  const handleTermsPaging = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchTerm) {
        handlePageChange(currentPage);
      } else if (cursorType) {
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [handlePageChange, pageSize, paging, searchTerm]
  );

  const glossaryTermStatus: EntityStatus | null = useMemo(() => {
    if (!isGlossary) {
      return (
        (activeGlossary as GlossaryTerm).entityStatus ?? EntityStatus.Approved
      );
    }

    return null;
  }, [isGlossary, activeGlossary]);

  const tableColumnsWidth = useMemo(
    () => glossaryTermTableColumnsWidth(containerWidth, permissions.Create),
    [permissions.Create, containerWidth]
  );

  const updateGlossaryTermStatus = (
    terms: ModifiedGlossary[],
    targetFqn: string,
    newStatus: EntityStatus
  ): ModifiedGlossary[] => {
    return terms.map((term) => {
      if (term.fullyQualifiedName === targetFqn) {
        return {
          ...term,
          entityStatus: newStatus,
        };
      }

      if (term.children && term.children.length > 0) {
        return {
          ...term,
          children: updateGlossaryTermStatus(
            term.children as ModifiedGlossary[],
            targetFqn,
            newStatus
          ),
        };
      }

      return term;
    }) as ModifiedGlossary[];
  };

  const updateTaskData = useCallback(
    async (
      data: ResolveTask,
      taskId: string | number,
      glossaryTermFqn: string
    ) => {
      try {
        if (!taskId) {
          return;
        }

        await updateTask(TaskOperation.RESOLVE, taskId + '', data);
        showSuccessToast(t('server.task-resolved-successfully'));

        const currentExpandedKeys = [...expandedRowKeys];
        setExpandedRowKeys(currentExpandedKeys);

        if (glossaryChildTerms && glossaryTermFqn) {
          const newStatus =
            data.newValue === 'approved'
              ? EntityStatus.Approved
              : EntityStatus.Rejected;

          const updatedTerms = updateGlossaryTermStatus(
            glossaryChildTerms,
            glossaryTermFqn,
            newStatus
          );

          if (
            !selectedStatus.includes('all') &&
            !selectedStatus.includes(newStatus)
          ) {
            setGlossaryChildTerms(
              updatedTerms.filter(
                (term) => term.fullyQualifiedName !== glossaryTermFqn
              )
            );
          } else {
            setGlossaryChildTerms(updatedTerms);
          }

          // remove resolved task from term task threads
          if (termTaskThreads[glossaryTermFqn]) {
            const updatedThreads = { ...termTaskThreads };
            updatedThreads[glossaryTermFqn] = updatedThreads[
              glossaryTermFqn
            ].filter(
              (thread) => !(thread.id && thread.id.toString() === taskId)
            );

            setTermTaskThreads(updatedThreads);
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [expandedRowKeys, glossaryChildTerms, selectedStatus, termTaskThreads]
  );

  const handleApproveGlossaryTerm = useCallback(
    async (record: ModifiedGlossaryTerm) => {
      const { permission, taskId } = permissionForApproveOrReject(
        record,
        currentUser as User,
        termTaskThreads,
        activeGlossary?.reviewers,
        permissions
      );

      if (!permission) {
        return;
      }

      if (taskId) {
        const data = { newValue: 'approved' } as ResolveTask;
        updateTaskData(data, taskId, record.fullyQualifiedName ?? '');
      } else {
        try {
          const jsonPatch = [
            {
              op: 'replace',
              path: '/entityStatus',
              value: EntityStatus.Approved,
            },
          ];
          await patchGlossaryTerm(record.id, jsonPatch);
          refreshGlossaryTerms && refreshGlossaryTerms();
          showSuccessToast(
            t('message.entity-approved-success', {
              entity: t('label.glossary-term'),
            })
          );
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [
      currentUser,
      termTaskThreads,
      activeGlossary?.reviewers,
      permissions,
      updateTaskData,
      refreshGlossaryTerms,
      t,
    ]
  );

  const handleRejectGlossaryTerm = useCallback(
    async (record: ModifiedGlossaryTerm) => {
      const { permission, taskId } = permissionForApproveOrReject(
        record,
        currentUser as User,
        termTaskThreads,
        activeGlossary?.reviewers,
        permissions
      );

      if (!permission) {
        return;
      }

      if (taskId) {
        const data = { newValue: 'rejected' } as ResolveTask;
        updateTaskData(data, taskId, record.fullyQualifiedName ?? '');
      } else {
        try {
          const jsonPatch = [
            {
              op: 'replace',
              path: '/entityStatus',
              value: EntityStatus.Draft,
            },
          ];
          await patchGlossaryTerm(record.id, jsonPatch);
          refreshGlossaryTerms && refreshGlossaryTerms();
          showSuccessToast(
            t('message.entity-rejected-success', {
              entity: t('label.glossary-term'),
            })
          );
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [
      currentUser,
      termTaskThreads,
      activeGlossary?.reviewers,
      permissions,
      updateTaskData,
      refreshGlossaryTerms,
      t,
    ]
  );

  const handleLoadMoreChildren = useCallback(
    (record: ModifiedGlossaryTerm) => {
      if (record.childrenPagingAfter) {
        fetchChildTerms(
          record.fullyQualifiedName || '',
          record.childrenPagingAfter
        );
      }
    },
    [fetchChildTerms]
  );

  const columns = useMemo(() => {
    const data: ColumnsType<ModifiedGlossaryTerm> = [
      {
        title: t('label.term-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
        className: 'glossary-name-column',
        ellipsis: true,
        width: tableColumnsWidth.name,
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            const parentRecord = (
              record as ModifiedGlossaryTerm & {
                parentRecord?: ModifiedGlossaryTerm;
              }
            ).parentRecord;
            const isLoading =
              loadingChildren[parentRecord?.fullyQualifiedName || ''];

            const loadedCount = parentRecord?.children?.length ?? 0;
            const totalCount = parentRecord?.childrenCount ?? 0;
            const remainingCount = totalCount - loadedCount;

            return (
              <Button
                className="text-primary"
                data-testid="load-more-children-button"
                loading={isLoading}
                size="small"
                type="link"
                onClick={() =>
                  parentRecord && handleLoadMoreChildren(parentRecord)
                }>
                {t('label.view-more-count', {
                  countValue: remainingCount,
                })}
              </Button>
            );
          }

          const name = getEntityName(record);

          return (
            <>
              {record.style?.iconURL && (
                <img
                  alt={record.name}
                  className="m-r-xss vertical-baseline"
                  data-testid="tag-icon"
                  height={12}
                  src={record.style.iconURL}
                />
              )}
              <Link
                className="cursor-pointer vertical-baseline"
                data-testid={name}
                style={{ color: record.style?.color }}
                to={getGlossaryPath(record.fullyQualifiedName ?? record.name)}>
                {name}
              </Link>
            </>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: tableColumnsWidth.description,
        render: (description: string, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return description?.trim() ? (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant
              markdown={description}
              maxLength={120}
            />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          );
        },
      },
      {
        title: t('label.status'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        // this check is added to the width, since the last column is optional and to maintain
        // the re-sizing of the column should not be affected the others columns width sizes.
        ...(permissions.Create && {
          width: tableColumnsWidth.status,
        }),
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          const status = record.entityStatus ?? EntityStatus.Approved;
          const { permission } = permissionForApproveOrReject(
            record,
            currentUser as User,
            termTaskThreads,
            activeGlossary?.reviewers,
            permissions
          );

          if (
            !isCDEGlossary &&
            !isDQGlossary &&
            status === EntityStatus.InReview &&
            permission
          ) {
            return (
              <StatusAction
                dataTestId={record.name}
                onApprove={() => handleApproveGlossaryTerm(record)}
                onReject={() => handleRejectGlossaryTerm(record)}
              />
            );
          }

          return (
            <StatusBadge
              dataTestId={(record.fullyQualifiedName ?? '') + '-status'}
              label={status}
              status={EntityStatusClass[status]}
            />
          );
        },
        onFilter: (value, record) => record.entityStatus === value,
      },
      {
        title: t('label.reviewer'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        width: tableColumnsWidth.reviewers,
        render: (reviewers: EntityReference[], record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return (
            <OwnerLabel
              isCompactView={false}
              owners={reviewers}
              placeHolder={t('label.no-entity', {
                entity: t('label.reviewer-plural'),
              })}
              showLabel={false}
            />
          );
        },
      },
      {
        title: t('label.synonym-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.SYNONYMS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.SYNONYMS,
        width: tableColumnsWidth.synonyms,
        render: (synonyms: string[], record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return isEmpty(synonyms) ? (
            <div>{NO_DATA_PLACEHOLDER}</div>
          ) : (
            <div className="d-flex flex-wrap">
              {synonyms.map((synonym: string) => (
                <TagButton
                  className="glossary-synonym-tag"
                  key={synonym}
                  label={synonym}
                />
              ))}
            </div>
          );
        },
      },
      ...ownerTableObject<ModifiedGlossaryTerm>().map((col) => ({
        ...col,
        render: (owners: EntityReference[], record: ModifiedGlossaryTerm) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          return col.render ? col.render(owners, record, 0) : null;
        },
      })),
    ];
    if (permissions.Create) {
      data.push({
        title: t('label.action-plural'),
        dataIndex: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
        key: GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
        render: (_, record) => {
          const isLoadMoreRow = record.isLoadMoreButton;

          if (isLoadMoreRow) {
            return null;
          }

          const status = record.entityStatus ?? EntityStatus.Approved;
          const allowAddTerm = status === EntityStatus.Approved;

          return (
            <div className="d-flex items-center">
              {allowAddTerm && (
                <Tooltip
                  title={t('label.add-entity', {
                    entity: t('label.glossary-term'),
                  })}>
                  <Button
                    className="add-new-term-btn text-grey-muted flex-center"
                    data-testid="add-classification"
                    icon={
                      <PlusOutlinedIcon color={DE_ACTIVE_COLOR} width="14px" />
                    }
                    size="small"
                    type="text"
                    onClick={() => {
                      onAddGlossaryTerm(record as GlossaryTerm);
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.glossary-term'),
                })}>
                <Button
                  className="cursor-pointer flex-center"
                  data-testid="edit-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                  onClick={() => onEditGlossaryTerm(record as GlossaryTerm)}
                />
              </Tooltip>
            </div>
          );
        },
      });
    }

    if (isDQGlossary) {
      const governanceColumnKeys = new Set([
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
      ]);
      const governanceColumns = data
        .filter((column) => governanceColumnKeys.has(String(column.key)))
        .map((column) => {
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS) {
            return {
              ...column,
              width: 140,
              align: 'center' as const,
            };
          }
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS) {
            return {
              ...column,
              width: 180,
            };
          }
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS) {
            return {
              ...column,
              width: 80,
              align: 'center' as const,
            };
          }

          return column;
        });

      return [
        ...getDQGlossaryTableColumns({
          handleLoadMoreChildren,
          loadingChildren,
          t,
        }),
        ...governanceColumns,
      ];
    }

    if (isCDEGlossary) {
      const governanceColumnKeys = new Set([
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS,
        GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
      ]);
      const governanceColumns = data
        .filter((column) => governanceColumnKeys.has(String(column.key)))
        .map((column) => {
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS) {
            return {
              ...column,
              width: 140,
              align: 'center' as const,
            };
          }
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.REVIEWERS) {
            return {
              ...column,
              width: 180,
            };
          }
          if (column.key === GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS) {
            return {
              ...column,
              width: 80,
              align: 'center' as const,
            };
          }

          return column;
        });

      return [
        ...getCDEGlossaryTableColumns({
          handleLoadMoreChildren,
          loadingChildren,
          t,
        }),
        ...governanceColumns,
      ];
    }

    return data;
  }, [
    permissions,
    tableColumnsWidth,
    termTaskThreads,
    handleApproveGlossaryTerm,
    handleRejectGlossaryTerm,
    handleLoadMoreChildren,
    isCDEGlossary,
    isDQGlossary,
    loadingChildren,
    t,
  ]);

  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      const statusValues = [
        EntityStatus.Draft,
        EntityStatus.InReview,
        EntityStatus.Approved,
      ];

      if (key === 'all') {
        if (checked) {
          setStatusDropdownSelection(['all', ...statusValues]);
        } else {
          setStatusDropdownSelection([]);
        }
      } else {
        setStatusDropdownSelection((prev: string[]) => {
          const newCheckedList = checked
            ? [...prev, key]
            : prev.filter((item) => item !== key && item !== 'all');

          const allStatusChecked = statusValues.every((status) =>
            newCheckedList.includes(status)
          );

          if (allStatusChecked) {
            return ['all', ...statusValues];
          }

          return newCheckedList.filter((item) => item !== 'all');
        });
      }
    },
    [setStatusDropdownSelection]
  );

  const handleStatusSelectionDropdownSave = () => {
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
    setSelectedStatus(statusDropdownSelection);
    setIsStatusDropdownVisible(false);
  };

  const handleStatusSelectionDropdownCancel = () => {
    setStatusDropdownSelection(selectedStatus);
    setIsStatusDropdownVisible(false);
  };

  const toggleExpandAll = useCallback(async () => {
    if (expandedRowKeys.length === expandableKeys.length) {
      // Collapse all - immediate UI update
      lastFetchKeyRef.current = '';
      setToggleExpandBtn(false);
      setExpandedRowKeys([]);
    } else {
      setToggleExpandBtn(true);
      fetchExpadedTree();
    }
  }, [
    glossaryTerms,
    glossaryChildTerms,
    setGlossaryChildTerms,
    loadingChildren,
    setLoadingChildren,
    expandedRowKeys,
    expandableKeys,
    setExpandedRowKeys,
    showErrorToast,
    selectedStatus,
  ]);

  const isAllExpanded = useMemo(() => {
    return expandedRowKeys.length === expandableKeys.length;
  }, [expandedRowKeys, expandableKeys]);

  const availableStatusOptions = useMemo(() => {
    if (isConsumer) {
      return [
        {
          value: EntityStatus.Approved,
          text: getEntityStatusLabel(EntityStatus.Approved),
        },
      ];
    }

    return GLOSSARY_TERM_STATUS_OPTIONS;
  }, [isConsumer]);

  const statusDropdownMenu: MenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'statusSelection',
          label: (
            <div className="status-selection-dropdown">
              <Checkbox.Group
                className="glossary-col-sel-checkbox-group"
                value={statusDropdownSelection}>
                {availableStatusOptions.map((option) => (
                  <div key={option.value}>
                    <Checkbox
                      className="custom-glossary-col-sel-checkbox"
                      disabled={isConsumer}
                      value={option.value}
                      onChange={(e) =>
                        handleCheckboxChange(option.value, e.target.checked)
                      }>
                      <p className="glossary-dropdown-label">{option.text}</p>
                    </Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            </div>
          ),
        },
        {
          key: 'divider',
          type: 'divider',
          className: 'm-b-xs',
        },
        {
          key: 'actions',
          label: (
            <div className="flex-center">
              <Space>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  type="primary"
                  onClick={handleStatusSelectionDropdownSave}>
                  {t('label.save')}
                </Button>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  type="default"
                  onClick={handleStatusSelectionDropdownCancel}>
                  {t('label.cancel')}
                </Button>
              </Space>
            </div>
          ),
        },
      ],
    }),
    [
      statusDropdownSelection,
      handleStatusSelectionDropdownSave,
      handleStatusSelectionDropdownCancel,
    ]
  );

  const handleEditGlossary = () => {
    navigate({
      pathname: getEntityBulkEditPath(
        isGlossary ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM,
        activeGlossary?.fullyQualifiedName ?? ''
      ),
    });
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm]
  );



  const handleAddGlossaryTermClick = () => {
    onAddGlossaryTerm(
      isGlossary ? undefined : (activeGlossary as GlossaryTerm)
    );
  };

  const getRowClassName = useCallback(
    (record: ModifiedGlossaryTerm) => {
      const isNested = (record.level ?? 0) > 0;
      const isExpanded = expandedRowKeys.includes(
        record.fullyQualifiedName || ''
      );

      return isNested || isExpanded ? 'glossary-nested-row' : '';
    },
    [expandedRowKeys]
  );

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      expandIcon: ({ expanded, onExpand, record }) => {
        const isLoadMoreRow = record.isLoadMoreButton;

        if (isLoadMoreRow) {
          return <span className="expand-cell-empty-icon-container" />;
        }

        const { children, childrenCount } = record;
        const isLoading = loadingChildren[record.fullyQualifiedName || ''];

        return (childrenCount ?? children?.length ?? 0) > 0 ? (
          <>
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
            {isLoading ? (
              <span className="m-r-xs expand-loader">
                <Loader size="x-small" />
              </span>
            ) : (
              <Icon
                className="m-r-xs vertical-baseline"
                component={expanded ? IconDown : IconRight}
                data-testid="expand-icon"
                style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
                onClick={(e) => onExpand(record, e)}
              />
            )}
          </>
        ) : (
          <>
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
            <span className="expand-cell-empty-icon-container" />
          </>
        );
      },
      expandedRowKeys: expandedRowKeys,
      onExpand: async (expanded, record) => {
        if (expanded) {
          // Add to expanded keys immediately for responsive UI
          setExpandedRowKeys((prev) => [
            ...prev,
            record.fullyQualifiedName || '',
          ]);

          // Load children if needed
          if (
            (!record.children || record.children.length === 0) &&
            record.childrenCount &&
            record.childrenCount > 0
          ) {
            await fetchChildTerms(record.fullyQualifiedName || '');
          }

          return;
        }
        // Remove from expanded keys immediately
        const newExpandedKeys = expandedRowKeys.filter(
          (key) => key !== record.fullyQualifiedName
        );
        setExpandedRowKeys(newExpandedKeys);
      },
      rowExpandable: (record) => {
        const rec = record;
        const isLoadMoreRow = rec.isLoadMoreButton;

        return (
          !isLoadMoreRow &&
          ((rec.childrenCount ?? 0) > 0 || (rec.children?.length ?? 0) > 0)
        );
      },
    }),
    [
      glossaryTerms,
      setGlossaryChildTerms,
      expandedRowKeys,
      loadingChildren,
      fetchChildTerms,
      glossaryChildTerms,
    ]
  );

  const handleMoveRow = useCallback(
    async (dragRecord: GlossaryTerm, dropRecord?: GlossaryTerm) => {
      const dropRecordFqnPart =
        Fqn.split(dragRecord.fullyQualifiedName ?? '').length === 2;

      if (isUndefined(dropRecord) && dropRecordFqnPart) {
        return;
      }
      if (dragRecord.id === dropRecord?.id) {
        return;
      }

      setMovedGlossaryTerm({
        from: dragRecord,
        to: dropRecord,
      });
      setIsModalOpen(true);
    },
    []
  );

  const handleTableHover = (value: boolean) => setIsTableHovered(value);

  const handleChangeGlossaryTerm = async () => {
    if (movedGlossaryTerm) {
      setIsTableLoading(true);
      const newTermData = {
        ...movedGlossaryTerm.from,
        parent: isUndefined(movedGlossaryTerm.to)
          ? null
          : {
              fullyQualifiedName: movedGlossaryTerm.to.fullyQualifiedName,
            },
      };
      const jsonPatch = compare(movedGlossaryTerm.from, newTermData);

      try {
        await patchGlossaryTerm(movedGlossaryTerm.from?.id || '', jsonPatch);
        refreshGlossaryTerms?.();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
        setIsTableHovered(false);
      }
    }
  };

  const onTableRow: TableProps<ModifiedGlossaryTerm>['onRow'] = (
    record,
    index
  ) =>
    ({
      index,
      handleMoveRow,
      handleTableHover,
      record,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const onTableHeader: TableProps<ModifiedGlossaryTerm>['onHeaderRow'] = () =>
    ({
      handleMoveRow,
      handleTableHover,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const onDragConfirmationModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsTableHovered(false);
    setConfirmCheckboxChecked(false);
  }, []);

  const hasReviewers = useMemo(() => {
    return !isEmpty(activeGlossary.reviewers);
  }, [movedGlossaryTerm, activeGlossary]);

  const processTermsWithLoadMore = useCallback(
    (terms: ModifiedGlossaryTerm[], level = 0): ModifiedGlossaryTerm[] => {
      return terms.map((term) => {
        let processedTerm: ModifiedGlossaryTerm = { ...term, level };

        if (term.children && term.children.length > 0) {
          processedTerm = {
            ...processedTerm,
            children: processTermsWithLoadMore(term.children, level + 1),
          };
        }

        if (term.hasMoreChildren) {
          const loadMoreItem: ModifiedGlossaryTerm = {
            id: `${term.fullyQualifiedName}-load-more`,
            name: 'load-more-placeholder',
            fullyQualifiedName: `${term.fullyQualifiedName}-load-more`,
            description: '',
            displayName: '',
            entityStatus: term.entityStatus,
            isLoadMoreButton: true,
            parentRecord: term,
            level: level + 1,
          } as ModifiedGlossaryTerm;

          processedTerm = {
            ...processedTerm,
            children: [...(processedTerm.children ?? []), loadMoreItem],
          };
        }

        return processedTerm;
      });
    },
    []
  );

  const filteredGlossaryTerms = useMemo(() => {
    if (!Array.isArray(glossaryTerms)) {
      return [];
    }

    if (isCDEGlossary && hasActiveCdeFilters) {
      const sourceList: ModifiedGlossaryTerm[] =
        allCdeTerms.length > 0
          ? (buildTree(allCdeTerms) as ModifiedGlossaryTerm[])
          : glossaryTerms;

      const filterPredicate = (term: ModifiedGlossaryTerm): boolean => {
        if (!selectedCdeDomains.includes('all')) {
          const termDomains =
            term.domains?.map((d) => d.displayName || d.name || '') || [];
          if (!selectedCdeDomains.some((d) => termDomains.includes(d))) {
            return false;
          }
        }

        if (!selectedCdeDataSources.includes('all')) {
          const termSources =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.dataSource
              )
              .map((t) => t.tagFQN) || [];
          if (!selectedCdeDataSources.some((s) => termSources.includes(s))) {
            return false;
          }
        }

        if (!selectedCdeOwners.includes('all')) {
          const termOwners =
            term.owners?.map(
              (o) =>
                o.id ||
                o.fullyQualifiedName ||
                o.name ||
                getCDEReferenceLabel(o)
            ) || [];
          if (!selectedCdeOwners.some((o) => termOwners.includes(o))) {
            return false;
          }
        }

        if (!selectedCdeClassifications.includes('all')) {
          const termClasses =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] ===
                  CDE_TAG_CLASSIFICATIONS.dataClassification
              )
              .map((t) => t.tagFQN) || [];
          if (
            !selectedCdeClassifications.some((c) => termClasses.includes(c))
          ) {
            return false;
          }
        }

        if (searchTerm.trim()) {
          const termLower = searchTerm.toLowerCase();
          const nameMatch = term.name?.toLowerCase().includes(termLower);
          const dispMatch = term.displayName
            ?.toLowerCase()
            .includes(termLower);
          if (!nameMatch && !dispMatch) {
            return false;
          }
        }

        return true;
      };

      const filterRecursive = (
        nodes: ModifiedGlossaryTerm[]
      ): ModifiedGlossaryTerm[] => {
        const result: ModifiedGlossaryTerm[] = [];

        for (const node of nodes) {
          const selfMatches = filterPredicate(node);
          const matchingChildren = node.children?.length
            ? filterRecursive(node.children as ModifiedGlossaryTerm[])
            : [];

          if (selfMatches || matchingChildren.length > 0) {
            result.push({
              ...node,
              children:
                matchingChildren.length > 0 ? matchingChildren : node.children,
              childrenCount:
                matchingChildren.length > 0
                  ? matchingChildren.length
                  : node.childrenCount,
            });
          }
        }

        return result;
      };

      return processTermsWithLoadMore(filterRecursive(sourceList));
    }

    if (isDQGlossary && hasActiveDqFilters) {
      const sourceList: ModifiedGlossaryTerm[] =
        allDqTerms.length > 0
          ? (buildTree(allDqTerms) as ModifiedGlossaryTerm[])
          : glossaryTerms;

      const filterPredicate = (term: ModifiedGlossaryTerm): boolean => {
        if (!selectedDqDimensions.includes('all')) {
          const termDims =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dimension
              )
              .map((t) => t.tagFQN) || [];
          if (!selectedDqDimensions.some((d) => termDims.includes(d))) {
            return false;
          }
        }

        if (!selectedDqDataSources.includes('all')) {
          const termSources =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dataSource
              )
              .map((t) => t.tagFQN) || [];
          if (!selectedDqDataSources.some((s) => termSources.includes(s))) {
            return false;
          }
        }

        if (!selectedDqOwners.includes('all')) {
          const termOwners =
            term.owners?.map(
              (o) =>
                o.id ||
                o.fullyQualifiedName ||
                o.name ||
                getDQReferenceLabel(o)
            ) || [];
          if (!selectedDqOwners.some((o) => termOwners.includes(o))) {
            return false;
          }
        }

        if (!selectedDqMethods.includes('all')) {
          const termMethods =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.method
              )
              .map((t) => t.tagFQN) || [];
          if (!selectedDqMethods.some((m) => termMethods.includes(m))) {
            return false;
          }
        }

        if (!selectedDqTargetPopulations.includes('all')) {
          const termPops =
            term.tags
              ?.filter(
                (t) =>
                  t.tagFQN.split('.')[0] ===
                  DQ_TAG_CLASSIFICATIONS.targetPopulation
              )
              .map((t) => t.tagFQN) || [];
          if (!selectedDqTargetPopulations.some((p) => termPops.includes(p))) {
            return false;
          }
        }

        if (searchTerm.trim()) {
          const termLower = searchTerm.toLowerCase();
          const nameMatch = term.name?.toLowerCase().includes(termLower);
          const dispMatch = term.displayName
            ?.toLowerCase()
            .includes(termLower);
          const descMatch = term.description
            ?.toLowerCase()
            .includes(termLower);
          const ext = term.extension as Record<string, unknown> | undefined;
          const cdeCodeMatch = String(ext?.cdeCode ?? '')
            .toLowerCase()
            .includes(termLower);
          const cdeNameMatch = String(ext?.cdeName ?? '')
            .toLowerCase()
            .includes(termLower);
          const ruleExplMatch = String(ext?.ruleExplanation ?? '')
            .toLowerCase()
            .includes(termLower);

          if (
            !nameMatch &&
            !dispMatch &&
            !descMatch &&
            !cdeCodeMatch &&
            !cdeNameMatch &&
            !ruleExplMatch
          ) {
            return false;
          }
        }

        return true;
      };

      const filterRecursive = (
        nodes: ModifiedGlossaryTerm[]
      ): ModifiedGlossaryTerm[] => {
        const result: ModifiedGlossaryTerm[] = [];

        for (const node of nodes) {
          const selfMatches = filterPredicate(node);
          const matchingChildren = node.children?.length
            ? filterRecursive(node.children as ModifiedGlossaryTerm[])
            : [];

          if (selfMatches || matchingChildren.length > 0) {
            result.push({
              ...node,
              children:
                matchingChildren.length > 0 ? matchingChildren : node.children,
              childrenCount:
                matchingChildren.length > 0
                  ? matchingChildren.length
                  : node.childrenCount,
            });
          }
        }

        return result;
      };

      return processTermsWithLoadMore(filterRecursive(sourceList));
    }

    return processTermsWithLoadMore(glossaryTerms);
  }, [
    glossaryTerms,
    processTermsWithLoadMore,
    isCDEGlossary,
    hasActiveCdeFilters,
    allCdeTerms,
    selectedCdeDomains,
    selectedCdeDataSources,
    selectedCdeOwners,
    selectedCdeClassifications,
    isDQGlossary,
    hasActiveDqFilters,
    allDqTerms,
    selectedDqDimensions,
    selectedDqDataSources,
    selectedDqOwners,
    selectedDqMethods,
    selectedDqTargetPopulations,
    searchTerm,
  ]);

  useEffect(() => {
    if (
      isCDEGlossary &&
      hasActiveCdeFilters &&
      filteredGlossaryTerms.length > 0
    ) {
      const keys = findExpandableKeysForArray(filteredGlossaryTerms);
      setExpandedRowKeys((prev) => Array.from(new Set([...prev, ...keys])));
    }
  }, [
    isCDEGlossary,
    hasActiveCdeFilters,
    filteredGlossaryTerms,
    findExpandableKeysForArray,
  ]);

  useEffect(() => {
    if (
      isDQGlossary &&
      hasActiveDqFilters &&
      filteredGlossaryTerms.length > 0
    ) {
      const keys = findExpandableKeysForArray(filteredGlossaryTerms);
      setExpandedRowKeys((prev) => Array.from(new Set([...prev, ...keys])));
    }
  }, [
    isDQGlossary,
    hasActiveDqFilters,
    filteredGlossaryTerms,
    findExpandableKeysForArray,
  ]);

  useEffect(() => {
    if (!tableContainerRef.current) {
      return;
    }
    setContainerWidth(tableContainerRef.current.offsetWidth);
  }, []);

  const extraTableFilters = useMemo(() => {
    let expandCollapseLabel = '';

    if (isExpandingAll) {
      expandCollapseLabel = t('label.loading');
    } else if (isAllExpanded) {
      expandCollapseLabel = t('label.collapse-all');
    } else {
      expandCollapseLabel = t('label.expand-all');
    }

    return (
      <>
        <Input
          allowClear
          data-testid="search-glossary-terms-input"
          placeholder={
            isDQGlossary
              ? t('dq.search-placeholder')
              : isCDEGlossary
              ? t('cde.search-placeholder')
              : t('label.search-entity', {
                  entity: t('label.term-plural'),
                })
          }
          style={{ width: isDQGlossary ? 300 : isCDEGlossary ? 280 : 250 }}
          value={searchInput}
          onChange={handleSearchChange}
        />

        <Dropdown
          className="custom-glossary-dropdown-menu status-dropdown"
          menu={statusDropdownMenu}
          open={isStatusDropdownVisible}
          trigger={['click']}
          onOpenChange={setIsStatusDropdownVisible}>
          <Button
            className="text-primary remove-button-background-hover"
            data-testid="glossary-status-dropdown"
            size="small"
            type="text">
            <Space>
              {t('label.status')}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>

        {isCDEGlossary && (
          <>
            <CDEFilterDropdown
              dataTestId="cde-domain-filter"
              label={t('cde.business-group')}
              options={cdeDomainOptions}
              selectedValues={selectedCdeDomains}
              onChange={setSelectedCdeDomains}
            />
            <CDEFilterDropdown
              dataTestId="cde-datasource-filter"
              label={t('cde.data-source')}
              options={cdeDataSourceOptions}
              selectedValues={selectedCdeDataSources}
              onChange={setSelectedCdeDataSources}
            />
            <CDEFilterDropdown
              dataTestId="cde-owner-filter"
              label={t('cde.data-owner')}
              options={cdeOwnerOptions}
              selectedValues={selectedCdeOwners}
              onChange={setSelectedCdeOwners}
            />
            <CDEFilterDropdown
              dataTestId="cde-classification-filter"
              label={t('cde.data-classification')}
              options={cdeClassificationOptions}
              selectedValues={selectedCdeClassifications}
              onChange={setSelectedCdeClassifications}
            />
          </>
        )}

        {isDQGlossary && (
          <>
            <CDEFilterDropdown
              dataTestId="dq-dimension-filter"
              label={t('dq.dimension', 'Tiêu chí')}
              options={dqDimensionOptions}
              selectedValues={selectedDqDimensions}
              onChange={setSelectedDqDimensions}
            />
            <CDEFilterDropdown
              dataTestId="dq-datasource-filter"
              label={t('dq.data-source', 'Hệ thống nguồn')}
              options={dqDataSourceOptions}
              selectedValues={selectedDqDataSources}
              onChange={setSelectedDqDataSources}
            />
            <CDEFilterDropdown
              dataTestId="dq-owner-filter"
              label={t('dq.owners', 'Chủ sở hữu')}
              options={dqOwnerOptions}
              selectedValues={selectedDqOwners}
              onChange={setSelectedDqOwners}
            />
            <CDEFilterDropdown
              dataTestId="dq-method-filter"
              label={t('dq.method', 'Hình thức kiểm tra')}
              options={dqMethodOptions}
              selectedValues={selectedDqMethods}
              onChange={setSelectedDqMethods}
            />
            <CDEFilterDropdown
              dataTestId="dq-target-population-filter"
              label={t('dq.target-population', 'Tập dữ liệu kiểm tra')}
              options={dqTargetPopulationOptions}
              selectedValues={selectedDqTargetPopulations}
              onChange={setSelectedDqTargetPopulations}
            />
          </>
        )}

        {getBulkEditButton(permissions.EditAll, handleEditGlossary)}

        <Button
          className={classNames('text-primary remove-button-background-hover', {
            'cde-toolbar-collapse-action': isCDEGlossary,
            'dq-toolbar-collapse-action': isDQGlossary,
          })}
          data-testid="expand-collapse-all-button"
          disabled={isExpandingAll}
          size="small"
          type="text"
          onClick={toggleExpandAll}>
          <Space align="center" size={4}>
            {isExpandingAll ? (
              <Loader size="small" />
            ) : (
              <Icon
                className="text-primary"
                component={isAllExpanded ? DownUpArrowIcon : UpDownArrowIcon}
                height="14px"
              />
            )}
            {expandCollapseLabel}
          </Space>
        </Button>
      </>
    );
  }, [
    isAllExpanded,
    isExpandingAll,
    isStatusDropdownVisible,
    isCDEGlossary,
    isDQGlossary,
    statusDropdownMenu,
    searchInput,
    handleSearchChange,
    toggleExpandAll,
    cdeDomainOptions,
    cdeDataSourceOptions,
    cdeOwnerOptions,
    cdeClassificationOptions,
    selectedCdeDomains,
    selectedCdeDataSources,
    selectedCdeOwners,
    selectedCdeClassifications,
    dqDimensionOptions,
    dqDataSourceOptions,
    dqOwnerOptions,
    dqMethodOptions,
    dqTargetPopulationOptions,
    selectedDqDimensions,
    selectedDqDataSources,
    selectedDqOwners,
    selectedDqMethods,
    selectedDqTargetPopulations,
    filteredGlossaryTerms,
    allCdeTerms,
    allDqTerms,
    t,
    permissions.EditAll,
  ]);

  const fetchKey = useMemo(
    () =>
      [
        activeGlossary?.fullyQualifiedName,
        searchTerm,
        selectedStatus.join(','),
        pageSize,
        currentPage,
        pagingCursor.cursorType,
        pagingCursor.cursorValue,
      ].join('|'),
    [
      activeGlossary?.fullyQualifiedName,
      searchTerm,
      selectedStatus,
      pageSize,
      currentPage,
      pagingCursor.cursorType,
      pagingCursor.cursorValue,
    ]
  );

  // Fetch once per page/filter combination and ignore layout-only rerenders.
  useEffect(() => {
    if (!activeGlossary?.fullyQualifiedName || toggleExpandBtn) {
      return;
    }

    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }

    lastFetchKeyRef.current = fetchKey;
    fetchAllTerms();
  }, [fetchKey, toggleExpandBtn]);

  const paginationProps = useMemo(
    () => ({
      currentPage,
      isLoading: isTableLoading,
      isNumberBased: Boolean(searchTerm),
      pageSize,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
      paging,
      pagingHandler: handleTermsPaging,
      onShowSizeChange: handlePageSizeChange,
      showPagination: paging.total > 0,
    }),
    [
      currentPage,
      handlePageSizeChange,
      handleTermsPaging,
      isTableLoading,
      pageSize,
      paging,
      searchTerm,
    ]
  );

  // Check if this is due to search or filter returning no results
  const isSearchActive = Boolean(
    (searchTerm && searchTerm.trim().length > 0) ||
    (searchInput && searchInput.trim().length > 0)
  );
  const isStatusFilterActive = !selectedStatus.includes('all');
  const hasNoTerms = isEmpty(glossaryTerms);

  const isAnyFilterActive =
    isSearchActive ||
    isStatusFilterActive ||
    hasActiveCdeFilters ||
    hasActiveDqFilters;

  const totalGlossaryTermsCount =
    activeGlossary?.termCount ??
    activeGlossary?.childrenCount ??
    (isDQGlossary ? allDqTerms.length : allCdeTerms.length);

  const glossaryPlaceholderText = useMemo(() => {
    if (isSearchActive && (searchTerm || searchInput)) {
      return t('message.no-entity-found-for-name', {
        entity: t('label.glossary-term'),
        name: searchTerm || searchInput,
      });
    }
    if (isAnyFilterActive) {
      return t('label.no-data-found');
    }

    return t('message.no-entity-available', {
      entity: t('label.glossary-term-plural'),
    });
  }, [isSearchActive, isAnyFilterActive, searchTerm, searchInput, t]);

  if (isTechGlossary) {
    return <TechnicalDictionaryPage />;
  }

  if (
    hasNoTerms &&
    !isAnyFilterActive &&
    totalTermsCount === 0 &&
    !isTableLoading
  ) {
    return (
      <div className="h-full" ref={tableContainerRef}>
        <ErrorPlaceHolder
          className="p-md p-b-lg border-none"
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary-term')}
          permission={permissions.Create}
          permissionValue={t('label.create-entity', {
            entity: t('label.glossary-term'),
          })}
          placeholderText={t('message.no-glossary-term')}
          type={
            permissions.Create && glossaryTermStatus === EntityStatus.Approved
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.NO_DATA
          }
          onClick={handleAddGlossaryTermClick}
        />
      </div>
    );
  }

  return (
    <Row className={className} gutter={[0, 16]}>
      {/* Have use the col to set the width of the table, to only use the viewport width for the table columns */}
      <Col className="w-full" ref={tableContainerRef} span={24}>
        <div
          className="glossary-terms-scroll-container"
          style={{
            position: 'relative',
          }}>
          {canSelectRows && selectedRowKeys.length > 0 && (
            <GlossaryBulkActionBar
              canApproveOrReject={canApproveOrReject}
              canSubmitForReview={canSubmitForReview}
              selectedTerms={selectedTerms}
              onApprove={handleBulkApprove}
              onClearSelection={handleClearSelection}
              onReject={handleBulkReject}
              onRevokeApproval={handleBulkRevoke}
              onSubmitForReview={handleBulkSubmitForReview}
            />
          )}
          {glossaryTerms.length > 0 ? (
            <>
              <Table
                resizableColumns
                sticky={{ offsetScroll: 0 }}
                className={classNames('drop-over-background', {
                  'cde-glossary-terms-table': isCDEGlossary,
                  'dq-glossary-terms-table': isDQGlossary,
                  'drop-over-table': isTableHovered,
                })}
                columns={columns}
                components={TABLE_CONSTANTS}
                containerClassName={
                  isDQGlossary
                    ? 'dq-glossary-table-container'
                    : isCDEGlossary
                    ? 'cde-glossary-table-container'
                    : undefined
                }
                customPaginationProps={paginationProps}
                data-testid="glossary-terms-table"
                dataSource={filteredGlossaryTerms}
                defaultVisibleColumns={
                  isDQGlossary
                    ? DQ_DEFAULT_VISIBLE_COLUMNS
                    : isCDEGlossary
                    ? CDE_DEFAULT_VISIBLE_COLUMNS
                    : DEFAULT_VISIBLE_COLUMNS
                }
                entityType={
                  isDQGlossary
                    ? DQ_GLOSSARY_TABLE_PREFERENCE_KEY
                    : isCDEGlossary
                    ? CDE_GLOSSARY_TABLE_PREFERENCE_KEY
                    : undefined
                }
                expandable={expandableConfig}
                extraTableFilters={extraTableFilters}
                extraTableFiltersClassName={
                  isDQGlossary
                    ? 'dq-glossary-table-toolbar'
                    : isCDEGlossary
                    ? 'cde-glossary-table-toolbar'
                    : undefined
                }
                loading={isTableLoading || isExpandingAll}
                locale={{
                  emptyText: (
                    <ErrorPlaceHolder
                      className="p-md"
                      placeholderText={glossaryPlaceholderText}
                      type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
                    />
                  ),
                }}
                pagination={false}
                rowClassName={getRowClassName}
                rowKey="fullyQualifiedName"
                rowSelection={rowSelection}
                size="small"
                staticVisibleColumns={
                  isDQGlossary
                    ? DQ_STATIC_VISIBLE_COLUMNS
                    : isCDEGlossary
                    ? CDE_STATIC_VISIBLE_COLUMNS
                    : STATIC_VISIBLE_COLUMNS
                }
                onHeaderRow={onTableHeader}
                onRow={onTableRow}
              />
            </>
          ) : (
            // Show empty state within the table container when search returns no results
            // This keeps the search bar and filters visible
            <Table
              resizableColumns
              sticky={{ offsetScroll: 0 }}
              className={classNames('glossary-terms-table', {
                'cde-glossary-terms-table': isCDEGlossary,
                'dq-glossary-terms-table': isDQGlossary,
              })}
              columns={columns}
              components={TABLE_CONSTANTS}
              containerClassName={
                isDQGlossary
                  ? 'dq-glossary-table-container'
                  : isCDEGlossary
                  ? 'cde-glossary-table-container'
                  : undefined
              }
              customPaginationProps={paginationProps}
              data-testid="glossary-terms-table"
              dataSource={[]}
              defaultVisibleColumns={
                isDQGlossary
                  ? DQ_DEFAULT_VISIBLE_COLUMNS
                  : isCDEGlossary
                  ? CDE_DEFAULT_VISIBLE_COLUMNS
                  : DEFAULT_VISIBLE_COLUMNS
              }
              entityType={
                isDQGlossary
                  ? DQ_GLOSSARY_TABLE_PREFERENCE_KEY
                  : isCDEGlossary
                  ? CDE_GLOSSARY_TABLE_PREFERENCE_KEY
                  : undefined
              }
              expandable={expandableConfig}
              extraTableFilters={extraTableFilters}
              extraTableFiltersClassName={
                isDQGlossary
                  ? 'dq-glossary-table-toolbar'
                  : isCDEGlossary
                  ? 'cde-glossary-table-toolbar'
                  : undefined
              }
              loading={isTableLoading}
              locale={{
                emptyText: (
                  <ErrorPlaceHolder
                    className="p-md"
                    placeholderText={glossaryPlaceholderText}
                    type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
                  />
                ),
              }}
              pagination={false}
              rowClassName={getRowClassName}
              rowKey="fullyQualifiedName"
              rowSelection={rowSelection}
              size="small"
              staticVisibleColumns={
                isDQGlossary
                  ? DQ_STATIC_VISIBLE_COLUMNS
                  : isCDEGlossary
                  ? CDE_STATIC_VISIBLE_COLUMNS
                  : STATIC_VISIBLE_COLUMNS
              }
              onHeaderRow={onTableHeader}
              onRow={onTableRow}
            />
          )}
        </div>
        <Modal
          centered
          destroyOnClose
          closable={false}
          confirmLoading={isTableLoading}
          data-testid="confirmation-modal"
          maskClosable={false}
          okButtonProps={{ disabled: hasReviewers && !confirmCheckboxChecked }}
          okText={t('label.move')}
          open={isModalOpen}
          title={
            <>
              <WarningOutlined className="m-r-xs warning-icon" />
              {t('label.move-the-entity', {
                entity: t('label.glossary-term'),
              })}
            </>
          }
          onCancel={onDragConfirmationModalClose}
          onOk={handleChangeGlossaryTerm}>
          <Transi18next
            i18nKey="message.entity-transfer-message"
            renderElement={<strong />}
            values={{
              from: movedGlossaryTerm?.from.name,
              to:
                movedGlossaryTerm?.to?.name ??
                (activeGlossary && getEntityName(activeGlossary)),
              entity: isUndefined(movedGlossaryTerm?.to)
                ? ''
                : t('label.term-lowercase'),
            }}
          />
          {hasReviewers && (
            <div className="m-t-md">
              <Checkbox
                checked={confirmCheckboxChecked}
                className="text-grey-700"
                data-testid="confirm-status-checkbox"
                onChange={(e) => setConfirmCheckboxChecked(e.target.checked)}>
                <span>
                  <Transi18next
                    i18nKey="message.entity-transfer-confirmation-message"
                    renderElement={<strong />}
                    values={{
                      from: movedGlossaryTerm?.from.name,
                    }}
                  />
                  <span className="d-inline-block m-l-xss">
                    <StatusBadge
                      className="p-x-xs p-y-xss"
                      dataTestId=""
                      label={EntityStatus.InReview}
                      status={EntityStatusClass[EntityStatus.InReview]}
                    />
                  </span>
                </span>
              </Checkbox>
            </div>
          )}
        </Modal>

        {bulkModalConfig.open && (
          <GlossaryBulkActionModal
            actionType={bulkModalConfig.actionType}
            open={bulkModalConfig.open}
            terms={bulkModalConfig.terms}
            onCancel={handleCloseBulkModal}
            onSuccess={handleBulkActionSuccess}
          />
        )}
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;
