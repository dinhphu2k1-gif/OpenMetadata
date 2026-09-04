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

import { DownOutlined, WarningOutlined } from '@ant-design/icons';
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
import { ColumnsType, ExpandableConfig } from 'antd/lib/table/interface';
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
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
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
import { getCDEGlossaryTableColumns } from './CDEGlossaryTableColumns';
import { getDQGlossaryTableColumns } from './DQGlossaryTableColumns';
import TechnicalDictionaryPage from '../../../pages/TechnicalDictionaryPage/TechnicalDictionaryPage.component';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({ isGlossary, className }: GlossaryTermTabProps) => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
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
      : [EntityStatus.Approved, EntityStatus.Draft, EntityStatus.InReview]
  );
  const [selectedStatus, setSelectedStatus] = useState<string[]>(() =>
    isConsumer
      ? [EntityStatus.Approved]
      : [EntityStatus.Approved, EntityStatus.Draft, EntityStatus.InReview]
  );

  useEffect(() => {
    if (isConsumer) {
      setStatusDropdownSelection([EntityStatus.Approved]);
      setSelectedStatus([EntityStatus.Approved]);
    }
  }, [isConsumer]);
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const [totalTermsCount, setTotalTermsCount] = useState<number>(0);

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

      const entityStatusParam = isConsumer
        ? [EntityStatus.Approved]
        : selectedStatus.length === 0
        ? [EntityStatus.Approved, EntityStatus.Draft, EntityStatus.InReview]
        : selectedStatus.includes('all')
        ? undefined
        : (selectedStatus as EntityStatus[]);

      // Use search API if search term is present
      if (searchTerm.trim()) {
        const response = await searchGlossaryTermsPaginated({
          q: searchTerm,
          glossaryFqn: activeGlossary.fullyQualifiedName,
          limit: pageSize,
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
              width: 120,
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
              width: 120,
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
      const optionsToUse = GLOSSARY_TERM_STATUS_OPTIONS;

      if (key === 'all') {
        if (checked) {
          setStatusDropdownSelection([
            'all',
            ...optionsToUse.map((option) => option.value),
          ]);
        } else {
          setStatusDropdownSelection([]);
        }
      } else {
        setStatusDropdownSelection((prev: string[]) => {
          const newCheckedList = checked
            ? [...prev, key]
            : prev.filter((item) => item !== key);

          const allChecked = (optionsToUse as { value: string }[]).every(
            (opt) => newCheckedList.includes(opt.value ?? '')
          );

          if (allChecked) {
            return ['all', ...newCheckedList];
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
          text: EntityStatus.Approved,
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
              ? 'Tìm kiếm mã hoặc tên thuật ngữ'
              : t('label.search-entity', {
                  entity: t('label.term-plural'),
                })
          }
          style={{ width: isDQGlossary ? 330 : isCDEGlossary ? 280 : 250 }}
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
    toggleExpandAll,
  ]);

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

    return processTermsWithLoadMore(glossaryTerms);
  }, [glossaryTerms, processTermsWithLoadMore]);

  useEffect(() => {
    if (!tableContainerRef.current) {
      return;
    }
    setContainerWidth(tableContainerRef.current.offsetWidth);
  }, []);

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
  const isSearchActive = Boolean(searchTerm && searchTerm.trim().length > 0);
  const isStatusFilterActive = !selectedStatus.includes('all');
  const hasNoTerms = isEmpty(glossaryTerms);

  const glossaryPlaceholderText = useMemo(() => {
    if (isSearchActive && searchTerm) {
      return `No Glossary Term found for "${searchTerm}"`;
    }
    if (isSearchActive || isStatusFilterActive) {
      return 'No Glossary Term found';
    }

    return 'No Glossary Terms';
  }, [isSearchActive, isStatusFilterActive, searchTerm]);

  if (isTechGlossary) {
    return <TechnicalDictionaryPage />;
  }

  if (
    hasNoTerms &&
    !isSearchActive &&
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
          {glossaryTerms.length > 0 ? (
            <>
              <Table
                resizableColumns
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
                pagination={false}
                rowClassName={getRowClassName}
                rowKey="fullyQualifiedName"
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
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;
