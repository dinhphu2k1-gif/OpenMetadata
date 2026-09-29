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
  AppstoreOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  MoreOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Alert, Button, Dropdown, Input } from 'antd';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import CDEFilterDropdown, {
  FilterOption,
} from '../../components/Glossary/GlossaryTermTab/CDEFilterDropdown.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import GovernedEntityHeaderBadges from '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../constants/Glossary.contant';
import {
  isTechnicalDictionaryFeatureEnabled,
  TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG,
  TECHNICAL_DICTIONARY_READ_PATH_FLAG,
} from '../../constants/TechnicalDictionary.constants';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { usePaging } from '../../hooks/paging/usePaging';
import { Table } from '../../generated/entity/data/table';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../generated/type/tagLabel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  getGlossaryTerms,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { parseSurvivorshipRules } from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/survivorship.interface';
import { getTableDetailsByFQN, patchTableDetails } from '../../rest/tableAPI';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import {
  exportTechnicalDictionary,
  createTechnicalDictionaryRecordVersion,
  getTechnicalCdeOptions,
  getTechnicalDictionaryRecords,
  getTechnicalDictionaryVersions,
  getTechnicalDictionaryStats,
  saveTechnicalDictionaryWorking,
  TechnicalDictionaryRecord,
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryCatalog,
  TechnicalDictionaryBootstrapStatus,
  transitionTechnicalDictionaryWorking,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { getCDEReleaseVersionType } from '../../utils/CDEReleaseVersionTypeUtils';
import { getTechnicalColumnMetadata } from './TechnicalDictionaryMetadata';
import TechnicalDictionaryTable, {
  TechnicalFieldItem,
} from './TechnicalDictionaryTable.component';
import TechnicalDictionaryEditModal from './TechnicalDictionaryEditModal.component';
import '../../components/Glossary/glossaryV1.less';
import './technicalDictionary.less';

export const getTechnicalDictionarySearchQuery = (search: string) => {
  const trimmed = search.trim();
  const isCdeCode = /^CDE\d+\w*$/i.test(trimmed);

  return {
    query: isCdeCode || !trimmed ? '*' : `*${trimmed}*`,
    cdeFilter: isCdeCode
      ? {
          term: {
            glossaryTags:
              `${DATA_DICTIONARY_GLOSSARY_NAME}.${trimmed}`.toLowerCase(),
          },
        }
      : undefined,
  };
};

export interface TechnicalDictionaryPageProps {
  isEmbedded?: boolean;
}

interface ColumnSearchSource {
  id?: string;
  name?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  dataType?: string;
  dataTypeDisplay?: string;
  dataLength?: number;
  precision?: number;
  scale?: number;
  extension?: {
    survivorshipRank?: number;
    survivorshipNote?: string;
    timeliness?: string;
    systemOwner?: string;
    creationMethod?: string;
    creationMethodName?: string;
    status?: EntityStatus;
    businessVersion?: string;
    releaseVersionType?: string;
  };
  description?: string;
  tags?: TagLabel[];
  glossaryTags?: string[];
  classificationTags?: string[];
  table?: {
    id?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  database?: {
    id?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  databaseSchema?: {
    id?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  service?: {
    id?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
}

const DATA_DICTIONARY_TAG_PREFIX = `${DATA_DICTIONARY_GLOSSARY_NAME.toLowerCase()}.`;

export const isTechnicalDictionaryManagedTag = (tag: TagLabel) => {
  const fqn = (tag.tagFQN || '').toLowerCase();
  const isDataDictionaryTag =
    (tag.source === TagSource.Glossary || tag.source === 'Glossary') &&
    fqn.startsWith(DATA_DICTIONARY_TAG_PREFIX);
  const isTechnicalClassification =
    tag.tagFQN?.startsWith('DataElementType.') ||
    tag.tagFQN?.startsWith('FieldGenerationType.') ||
    tag.tagFQN?.startsWith('DataCreationMethod.');

  return isDataDictionaryTag || isTechnicalClassification;
};

export const TECHNICAL_DICTIONARY_OVERRIDES_STORAGE_KEY =
  'om_technical_dictionary_overrides_v1';

export const getTechnicalFieldOverrides = (): Record<
  string,
  Partial<TechnicalFieldItem>
> => {
  try {
    const raw = localStorage.getItem(
      TECHNICAL_DICTIONARY_OVERRIDES_STORAGE_KEY
    );

    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveTechnicalFieldOverride = (
  id: string,
  override: Partial<TechnicalFieldItem>
) => {
  try {
    const current = getTechnicalFieldOverrides();
    current[id] = {
      ...current[id],
      ...override,
    };
    localStorage.setItem(
      TECHNICAL_DICTIONARY_OVERRIDES_STORAGE_KEY,
      JSON.stringify(current)
    );
  } catch {
    // Ignore localStorage errors
  }
};

export const syncColumnProposalToBackend = async (
  item: Partial<TechnicalFieldItem>
) => {
  if (!item.tableFqn || !item.columnName) {
    return;
  }

  try {
    const table = await getTableDetailsByFQN(item.tableFqn, {
      fields: 'columns,tags,extension',
    });

    if (!table || !table.columns) {
      return;
    }

    const updatedColumns = (table.columns || []).map((col) => {
      if (col.name?.toLowerCase() !== item.columnName?.toLowerCase()) {
        return col;
      }

      return {
        ...col,
        description: item.description ?? col.description,
        extension: {
          ...(col.extension || {}),
          cdeCode: item.cdeCode,
          cdeName: item.cdeName,
          cdeFqn: item.cdeFqn,
          survivorshipRank: item.survivorshipRank,
          survivorshipNote: item.survivorshipNote,
          elementType: item.elementType,
          elementTypeName: item.elementTypeName,
          generationType: item.generationType,
          generationTypeName: item.generationTypeName,
          creationMethod: item.creationMethod,
          creationMethodName: item.creationMethodName,
          timeliness: item.timeliness,
          systemOwner: item.systemOwner,
          status: EntityStatus.InReview,
        },
      };
    });

    const updatedTable: Table = {
      ...table,
      columns: updatedColumns,
    };

    const jsonPatch = compare(table, updatedTable);

    if (table.id && jsonPatch.length > 0) {
      await patchTableDetails(table.id, jsonPatch);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to sync column proposal to backend table:', error);

    throw error;
  }
};

export const syncColumnMetadataToBackend = async (
  item: Partial<TechnicalFieldItem>
) => {
  if (!item.tableFqn || !item.columnName) {
    return;
  }

  try {
    const table = await getTableDetailsByFQN(item.tableFqn, {
      fields: 'columns,tags,extension',
    });

    if (!table || !table.columns) {
      return;
    }

    const updatedColumns = (table.columns || []).map((col) => {
      if (col.name?.toLowerCase() !== item.columnName?.toLowerCase()) {
        return col;
      }

      // Only replace metadata owned by this feature. Other glossary tags belong
      // to independent governance workflows and must be preserved.
      const existingTags: TagLabel[] = (col.tags || []).filter(
        (tag) => !isTechnicalDictionaryManagedTag(tag)
      );

      // Add CDE Glossary Tag
      if (item.cdeCode && item.cdeFqn) {
        existingTags.push({
          tagFQN: item.cdeFqn,
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        });
      }

      return {
        ...col,
        tags: existingTags,
        description: item.description ?? col.description,
        extension: {
          ...(col.extension || {}),
          cdeCode: item.cdeCode,
          cdeName: item.cdeName,
          cdeFqn: item.cdeFqn,
          survivorshipRank: item.survivorshipRank,
          survivorshipNote: item.survivorshipNote,
          elementType: item.elementType,
          elementTypeName: item.elementTypeName,
          generationType: item.generationType,
          generationTypeName: item.generationTypeName,
          creationMethod: item.creationMethod,
          creationMethodName: item.creationMethodName,
          timeliness: item.timeliness,
          systemOwner: item.systemOwner,
          status: item.status || EntityStatus.Approved,
        },
      };
    });

    const updatedTable: Table = {
      ...table,
      columns: updatedColumns,
    };

    const jsonPatch = compare(table, updatedTable);

    if (table.id && jsonPatch.length > 0) {
      await patchTableDetails(table.id, jsonPatch);
    }

    // Sync survivorship rule to CDE Glossary Term if CDE is present
    const cdeFqnToSync = item.cdeFqn;
    const colFqnToSync =
      item.columnFqn || `${item.tableFqn}.${item.columnName}`;
    if (cdeFqnToSync && colFqnToSync) {
      try {
        const cdeTerm = await getGlossaryTermByFQN(cdeFqnToSync, {
          fields: 'extension',
        });
        if (cdeTerm?.id) {
          const currentRules = parseSurvivorshipRules(
            cdeTerm.extension?.survivorshipRules
          );
          const otherRules = currentRules.filter(
            (r) => r.assetFqn !== colFqnToSync
          );
          if (item.survivorshipRank) {
            otherRules.push({
              assetFqn: colFqnToSync,
              rank: item.survivorshipRank,
              note: item.survivorshipNote,
              updatedAt: new Date().toISOString(),
            });
          }
          const updatedCdeTerm = {
            ...cdeTerm,
            extension: {
              ...(cdeTerm.extension || {}),
              survivorshipRules: JSON.stringify(otherRules),
            },
          };
          const patch = compare(cdeTerm, updatedCdeTerm);
          if (patch.length > 0) {
            await patchGlossaryTerm(cdeTerm.id, patch);
          }
        }
      } catch {
        // Continue even if CDE sync fails
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to sync column metadata to backend table:', error);

    throw error;
  }
};

export const removeColumnMetadataFromBackend = async (
  item: Partial<TechnicalFieldItem>
) => {
  if (!item.tableFqn || !item.columnName) {
    return;
  }

  try {
    const table = await getTableDetailsByFQN(item.tableFqn, {
      fields: 'columns,tags,extension',
    });

    if (!table || !table.columns) {
      return;
    }

    const updatedColumns = (table.columns || []).map((col) => {
      if (col.name?.toLowerCase() !== item.columnName?.toLowerCase()) {
        return col;
      }

      const remainingTags: TagLabel[] = (col.tags || []).filter(
        (tag) => !isTechnicalDictionaryManagedTag(tag)
      );

      return {
        ...col,
        tags: remainingTags,
        extension: {
          ...(col.extension || {}),
          cdeCode: undefined,
          cdeName: undefined,
          cdeFqn: undefined,
          survivorshipRank: undefined,
          survivorshipNote: undefined,
          elementType: undefined,
          elementTypeName: undefined,
          generationType: undefined,
          generationTypeName: undefined,
          creationMethod: undefined,
          creationMethodName: undefined,
          status: EntityStatus.Draft,
        },
      };
    });

    const updatedTable: Table = {
      ...table,
      columns: updatedColumns,
    };

    const jsonPatch = compare(table, updatedTable);

    if (table.id && jsonPatch.length > 0) {
      await patchTableDetails(table.id, jsonPatch);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to remove column metadata from backend table:',
      error
    );

    throw error;
  }
};

export const rejectColumnMetadataOnBackend = async (
  item: Partial<TechnicalFieldItem>
) => {
  if (!item.tableFqn || !item.columnName) {
    return;
  }

  try {
    const table = await getTableDetailsByFQN(item.tableFqn, {
      fields: 'columns,tags,extension',
    });

    if (!table || !table.columns) {
      return;
    }

    const updatedColumns = (table.columns || []).map((col) => {
      if (col.name?.toLowerCase() !== item.columnName?.toLowerCase()) {
        return col;
      }

      return {
        ...col,
        extension: {
          ...(col.extension || {}),
          status: EntityStatus.Rejected,
        },
      };
    });

    const updatedTable: Table = {
      ...table,
      columns: updatedColumns,
    };

    const jsonPatch = compare(table, updatedTable);

    if (table.id && jsonPatch.length > 0) {
      await patchTableDetails(table.id, jsonPatch);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to reject column metadata on backend table:', error);

    throw error;
  }
};

export const TechnicalDictionaryPage: React.FC<
  TechnicalDictionaryPageProps
> = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, selectedPersona } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const requestGenerationRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const cdeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const cdeRequestGenerationRef = useRef(0);
  const [technicalFields, setTechnicalFields] = useState<TechnicalFieldItem[]>(
    []
  );
  const [cdeOptions, setCdeOptions] = useState<
    Array<{
      label: string;
      value: string;
      name: string;
      code?: string;
      termId?: string;
      fullyQualifiedName?: string;
      snapshotId?: string;
      businessVersion?: string;
      parentBusinessVersion?: string;
      dataDictionaryVersionId?: string;
    }>
  >([]);
  const [searchText, setSearchText] = useState<string>(
    searchParams.get('q') ?? ''
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    searchParams.get('sources')?.split(',').filter(Boolean) ?? ['all']
  );
  const [selectedElementTypes, setSelectedElementTypes] = useState<string[]>([
    ...(searchParams.get('elementTypes')?.split(',').filter(Boolean) ?? [
      'all',
    ]),
  ]);
  const [selectedGenTypes, setSelectedGenTypes] = useState<string[]>(
    searchParams.get('generationTypes')?.split(',').filter(Boolean) ?? ['all']
  );
  const [selectedCreationMethods, setSelectedCreationMethods] = useState<
    string[]
  >(searchParams.get('creationMethods')?.split(',').filter(Boolean) ?? ['all']);
  const [selectedCdeFilters, setSelectedCdeFilters] = useState<string[]>([
    ...(searchParams.get('cdeMapping')?.split(',').filter(Boolean) ?? ['all']),
  ]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([
    ...(searchParams.get('statuses')?.split(',').filter(Boolean) ?? ['all']),
  ]);
  const [stats, setStats] = useState({
    totalFields: 0,
    totalTables: 0,
    totalSources: 0,
    totalMapped: 0,
  });
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [governedCapabilities, setGovernedCapabilities] =
    useState<TechnicalDictionaryCapabilities>();
  const [catalogVersions, setCatalogVersions] = useState<
    TechnicalDictionaryCatalog[]
  >([]);
  const [selectedCatalog, setSelectedCatalog] =
    useState<TechnicalDictionaryCatalog>();
  const [bootstrapStatus, setBootstrapStatus] =
    useState<TechnicalDictionaryBootstrapStatus>();
  const requestedBusinessVersion =
    searchParams.get('businessVersion') ?? undefined;
  const versionView = 'LATEST' as const;
  const governedReadEnabled = isTechnicalDictionaryFeatureEnabled(
    TECHNICAL_DICTIONARY_READ_PATH_FLAG
  );
  const governedMutationEnabled = isTechnicalDictionaryFeatureEnabled(
    TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
  );
  const headerStatus = selectedCatalog?.status ?? EntityStatus.Draft;
  const headerVersion = selectedCatalog?.businessVersion ?? '1';

  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === '' ||
          (key === 'currentPage' && value === '1') ||
          (key === 'pageSize' && value === String(PAGE_SIZE_BASE))
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (!searchParams.has('scopeId') && !searchParams.has('scopeVersion')) {
      return;
    }
    const canonical = new URLSearchParams(searchParams);
    canonical.delete('scopeId');
    canonical.delete('scopeVersion');
    if (canonical.get('currentPage') === '1') {
      canonical.delete('currentPage');
    }
    setSearchParams(canonical, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!governedReadEnabled) {
      return;
    }
    let active = true;
    getTechnicalDictionaryVersions()
      .then((versions) => {
        if (!active) {
          return;
        }
        setCatalogVersions(Array.isArray(versions) ? versions : []);
      })
      .catch((error) => showErrorToast(error as Error));

    return () => {
      active = false;
    };
  }, [governedReadEnabled]);

  const {
    currentPage,
    pageSize,
    showPagination,
    paging,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging(Number(searchParams.get('pageSize')) || PAGE_SIZE_BASE);

  const handlePaginationChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page, { cursorType: null, cursorValue: undefined });
      updateSearchParams({ currentPage: String(page) });
    },
    [handlePageChange, updateSearchParams]
  );

  const handlePageSizeChangeWithUrl = useCallback(
    (size: number) => {
      handlePageSizeChange(size);
      updateSearchParams({ pageSize: String(size), currentPage: '1' });
    },
    [handlePageSizeChange, updateSearchParams]
  );

  const handleCatalogVersionChange = useCallback(
    (businessVersion: string) => {
      const target = catalogVersions.find(
        (catalog) => catalog.businessVersion === businessVersion
      );
      setSearchText('');
      setSelectedSources(['all']);
      setSelectedElementTypes(['all']);
      setSelectedGenTypes(['all']);
      setSelectedCreationMethods(['all']);
      setSelectedCdeFilters(['all']);
      setSelectedStatusFilters(['all']);
      setGovernedCapabilities(undefined);
      handlePageChange(1);
      setCdeOptions([]);
      updateSearchParams({
        businessVersion: target?.historical ? businessVersion : undefined,
        currentPage: undefined,
        versionView: undefined,
      });
    },
    [catalogVersions, handlePageChange, updateSearchParams]
  );

  const customPaginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isNumberBased: true,
      isLoading,
      pageSize,
      paging,
      pagingHandler: handlePaginationChange,
      onShowSizeChange: handlePageSizeChangeWithUrl,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
    }),
    [
      currentPage,
      showPagination,
      isLoading,
      pageSize,
      paging,
      handlePaginationChange,
      handlePageSizeChangeWithUrl,
    ]
  );

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => [
      {
        name: t('label.governance'),
        url: '',
        activeTitle: false,
      },
      {
        name: t('label.technical-dictionary'),
        url: '',
        activeTitle: true,
      },
    ],
    [t]
  );

  // Role permissions:
  // - Data Steward: canApprove/Reject = true, canEdit = false, canViewAllStatus = true
  // - Data Proposer: canApprove/Reject = false, canEdit = true, canViewAllStatus = true
  // - Data Consumer: canApprove/Reject = false, canEdit = false, canViewAllStatus = false (Only Approved)
  // - Admin / Default: canApprove/Reject = true, canEdit = true, canViewAllStatus = true
  const userRoleInfo = useMemo(() => {
    const isAdmin = Boolean(currentUser?.isAdmin);
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    const isSteward =
      !isAdmin &&
      (userRoles.some((r) => r.includes('steward')) ||
        personaName.includes('steward'));

    const isProposer =
      !isAdmin &&
      !isSteward &&
      (userRoles.some((r) => r.includes('proposer')) ||
        personaName.includes('proposer'));

    const isConsumer =
      !isAdmin &&
      !isSteward &&
      !isProposer &&
      (userRoles.some((r) => r.includes('consumer')) ||
        personaName.includes('consumer'));

    if (isSteward) {
      return {
        role: 'DataSteward',
        canEdit: false,
        canApprove: true,
        canReject: true,
        canRevoke: true,
        canViewAllStatus: true,
      };
    }

    if (isProposer) {
      return {
        role: 'DataProposer',
        canEdit: true,
        canApprove: false,
        canReject: false,
        canRevoke: false,
        canViewAllStatus: true,
      };
    }

    if (isConsumer) {
      return {
        role: 'DataConsumer',
        canEdit: false,
        canApprove: false,
        canReject: false,
        canRevoke: false,
        canViewAllStatus: false,
      };
    }

    return {
      role: 'Admin',
      canEdit: true,
      canApprove: true,
      canReject: true,
      canRevoke: true,
      canViewAllStatus: true,
    };
  }, [currentUser, selectedPersona]);

  // Edit Modal state
  const [editingField, setEditingField] = useState<TechnicalFieldItem | null>(
    null
  );
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const fetchTechnicalStats = useCallback(async () => {
    try {
      if (governedReadEnabled) {
        const governedStats = await getTechnicalDictionaryStats(
          requestedBusinessVersion
        );
        setStats({
          totalFields: governedStats.totalColumns ?? 0,
          totalTables: governedStats.totalTables ?? 0,
          totalMapped: governedStats.mappedCde ?? 0,
          totalSources: governedStats.totalSources ?? 0,
        });

        return;
      }

      const [colRes, tableRes, mappedRes, serviceRes] = await Promise.all([
        searchQuery({
          searchIndex: SearchIndex.COLUMN,
          query: '*',
          pageNumber: 1,
          pageSize: 0,
          trackTotalHits: true,
        }),
        searchQuery({
          searchIndex: SearchIndex.TABLE,
          query: '*',
          pageNumber: 1,
          pageSize: 0,
          trackTotalHits: true,
        }),
        searchQuery({
          searchIndex: SearchIndex.COLUMN,
          query: '*',
          pageNumber: 1,
          pageSize: 0,
          trackTotalHits: true,
          queryFilter: {
            query: {
              bool: {
                filter: [
                  {
                    prefix: {
                      glossaryTags: DATA_DICTIONARY_TAG_PREFIX,
                    },
                  },
                ],
              },
            },
          },
        }),
        searchQuery({
          searchIndex: SearchIndex.DATABASE_SERVICE,
          query: '*',
          pageNumber: 1,
          pageSize: 50,
          trackTotalHits: true,
        }),
      ]);

      const rawServices = (serviceRes.hits.hits || [])
        .map((h) => (h._source as unknown as { name?: string })?.name)
        .filter(Boolean) as string[];
      const services = Array.from(new Set(rawServices));

      setStats({
        totalFields: colRes.hits.total.value || 0,
        totalTables: tableRes.hits.total.value || 0,
        totalMapped: mappedRes.hits.total.value || 0,
        totalSources: services.length,
      });

      if (services.length > 0) {
        setAvailableSources(services);
      }
    } catch {
      // Ignore stats error
    }
  }, [governedReadEnabled, requestedBusinessVersion]);

  // Load metadata from OpenMetadata Columns index with server-side pagination
  const fetchTechnicalMetadata = useCallback(
    async (page = currentPage, size = pageSize, search = searchText) => {
      const requestGeneration = ++requestGenerationRef.current;
      setIsLoading(true);
      try {
        if (governedReadEnabled) {
          const response = await getTechnicalDictionaryRecords({
            businessVersion: requestedBusinessVersion,
            search: search || undefined,
            status: selectedStatusFilters.includes('all')
              ? undefined
              : selectedStatusFilters.join(','),
            sources: selectedSources.includes('all')
              ? undefined
              : selectedSources.join(','),
            cdeMapping: selectedCdeFilters.includes('all')
              ? undefined
              : selectedCdeFilters.join(','),
            elementTypes: selectedElementTypes.includes('all')
              ? undefined
              : selectedElementTypes.join(','),
            generationTypes: selectedGenTypes.includes('all')
              ? undefined
              : selectedGenTypes.join(','),
            creationMethods: selectedCreationMethods.includes('all')
              ? undefined
              : selectedCreationMethods.join(','),
            versionView,
            limit: size,
            offset: (page - 1) * size,
          });
          const governedFields = response.data.map(
            (record: TechnicalDictionaryRecord): TechnicalFieldItem => {
              const payload = record.payload;
              const extension = (payload.extension ?? {}) as Record<
                string,
                unknown
              >;
              const source = (extension.source ?? {}) as Record<
                string,
                unknown
              >;
              const relatedTerms = Array.isArray(payload.relatedTerms)
                ? (payload.relatedTerms as Array<Record<string, unknown>>)
                : [];
              const cdeRelation = relatedTerms[0] ?? {};
              const cdeTerm = (cdeRelation.term ?? {}) as Record<
                string,
                unknown
              >;
              const cdeVersion = (cdeRelation.versionContext ?? {}) as Record<
                string,
                unknown
              >;
              const refName = (value: unknown) => {
                const reference = (value ?? {}) as Record<string, unknown>;

                return String(reference.displayName ?? reference.name ?? '');
              };
              const refFqn = (value: unknown) => {
                const reference = (value ?? {}) as Record<string, unknown>;

                return String(reference.fullyQualifiedName ?? '');
              };

              return {
                id: record.recordId,
                parentBusinessVersion: response.catalog.businessVersion,
                catalogStatus: response.catalog.status,
                historical: response.catalog.historical,
                businessVersion: record.businessVersion,
                releaseVersionType:
                  (extension.releaseVersionType as string | undefined) ??
                  getCDEReleaseVersionType(undefined, record.businessVersion),
                workingRevision: record.workingRevision,
                databaseName: refName(source.database),
                databaseFqn: refFqn(source.database),
                schemaName: refName(source.schema),
                schemaFqn: refFqn(source.schema),
                tableId: String(source.tableId ?? ''),
                tableName: String(source.tableName ?? ''),
                tableFqn: String(source.tableFqn ?? ''),
                columnName: String(source.columnName ?? ''),
                columnFqn: record.columnFqn,
                serviceName: refName(source.service),
                dataType: String(source.dataType ?? ''),
                dataTypeDisplay: String(
                  source.displayType ?? source.dataType ?? ''
                ),
                dataLength: source.length as number | undefined,
                precision: source.precision as number | undefined,
                scale: source.scale as number | undefined,
                status: record.status,
                cdeCode: extension.cdeCode as string | undefined,
                cdeName: extension.cdeName as string | undefined,
                cdeFqn: extension.cdeFqn as string | undefined,
                cdeTermId: cdeTerm.id as string | undefined,
                cdeSnapshotId: record.cdeSnapshotId,
                cdeBusinessVersion: cdeVersion.businessVersion as
                  | string
                  | undefined,
                cdeParentBusinessVersion: cdeVersion.parentBusinessVersion as
                  | string
                  | undefined,
                dataDictionaryVersionId:
                  extension.cdeDataDictionaryVersionId as string | undefined,
                survivorshipRank: extension.survivorshipRank as
                  | number
                  | undefined,
                survivorshipNote: extension.survivorshipNote as
                  | string
                  | undefined,
                elementType: extension.elementType as string | undefined,
                elementTypeName: extension.elementTypeName as
                  | string
                  | undefined,
                generationType: extension.generationType as string | undefined,
                generationTypeName: extension.generationTypeName as
                  | string
                  | undefined,
                creationMethod: extension.creationMethod as string | undefined,
                creationMethodName: extension.creationMethodName as
                  | string
                  | undefined,
                timeliness: extension.timeliness as string | undefined,
                systemOwner: extension.systemOwner as string | undefined,
                description: payload.description as string | undefined,
              };
            }
          );
          if (requestGeneration !== requestGenerationRef.current) {
            return;
          }
          setSelectedCatalog(response.catalog);
          setBootstrapStatus(response.bootstrap);
          setTechnicalFields(governedFields);
          setGovernedCapabilities(response.capabilities);
          setAvailableSources(
            Array.from(
              new Set(
                governedFields.map((field) => field.serviceName).filter(Boolean)
              )
            )
          );
          handlePagingChange({ total: response.paging.total });
          const options = await getTechnicalCdeOptions({
            businessVersion: response.catalog.businessVersion,
            limit: 25,
          });
          setCdeOptions(
            options.map((option) => ({
              label: `${option.code} · ${option.name ?? option.code} · v${
                option.businessVersion
              }`,
              value: option.snapshotId,
              name: option.name ?? option.code,
              code: option.code,
              termId: option.termId,
              snapshotId: option.snapshotId,
              businessVersion: option.businessVersion,
              parentBusinessVersion: option.parentBusinessVersion,
              dataDictionaryVersionId: option.dataDictionaryVersionId,
            }))
          );

          return;
        }

        // 1. Fetch CDE Glossary terms to map CDE codes to business display names and survivorship rules
        const cdeDisplayMap: Record<
          string,
          { name: string; fqn: string; termId?: string }
        > = {};
        const cdeSurvivorshipMap = new Map<
          string,
          Map<string, { rank: number; note?: string }>
        >();
        try {
          const glossaryRes = await getGlossariesByName(
            DATA_DICTIONARY_GLOSSARY_NAME,
            {
              fields: 'id',
            }
          );
          if (glossaryRes?.id) {
            const termsRes = await getGlossaryTerms({
              glossary: glossaryRes.id,
              limit: 1000,
              fields: 'extension',
            });
            (termsRes.data || []).forEach((term) => {
              if (term.name) {
                cdeDisplayMap[term.name.trim().toUpperCase()] = {
                  name: term.displayName || term.name,
                  fqn: term.fullyQualifiedName || '',
                  termId: term.id,
                };
              }
              if (
                term.fullyQualifiedName &&
                term.extension?.survivorshipRules
              ) {
                const rules = parseSurvivorshipRules(
                  term.extension.survivorshipRules
                );
                const ruleMap = new Map<
                  string,
                  { rank: number; note?: string }
                >();
                rules.forEach((r) => {
                  if (r.assetFqn) {
                    ruleMap.set(r.assetFqn, { rank: r.rank, note: r.note });
                  }
                });
                cdeSurvivorshipMap.set(term.fullyQualifiedName, ruleMap);
              }
            });
          }
        } catch {
          // Continue if glossary terms fail
        }

        // 2. Build structured queryFilter for OpenSearch
        const filterClauses: Array<Record<string, unknown>> = [];
        const mustNotClauses: Array<Record<string, unknown>> = [];

        // Source filter
        if (selectedSources.length > 0 && !selectedSources.includes('all')) {
          filterClauses.push({
            terms: {
              'service.name': selectedSources,
            },
          });
        }

        // Element Type filter
        if (
          selectedElementTypes.length > 0 &&
          !selectedElementTypes.includes('all')
        ) {
          filterClauses.push({
            terms: {
              'extension.elementType.keyword': selectedElementTypes,
            },
          });
        }

        // Generation Type filter
        if (selectedGenTypes.length > 0 && !selectedGenTypes.includes('all')) {
          filterClauses.push({
            terms: {
              'extension.generationType.keyword': selectedGenTypes,
            },
          });
        }

        // Creation Method filter
        if (
          selectedCreationMethods.length > 0 &&
          !selectedCreationMethods.includes('all')
        ) {
          filterClauses.push({
            terms: {
              'extension.creationMethod.keyword': selectedCreationMethods,
            },
          });
        }

        // CDE mapping filter
        if (
          selectedCdeFilters.length > 0 &&
          !selectedCdeFilters.includes('all')
        ) {
          if (
            selectedCdeFilters.includes('MAPPED') &&
            !selectedCdeFilters.includes('UNMAPPED')
          ) {
            filterClauses.push({
              prefix: {
                glossaryTags: DATA_DICTIONARY_TAG_PREFIX,
              },
            });
          } else if (
            selectedCdeFilters.includes('UNMAPPED') &&
            !selectedCdeFilters.includes('MAPPED')
          ) {
            mustNotClauses.push({
              prefix: {
                glossaryTags: DATA_DICTIONARY_TAG_PREFIX,
              },
            });
          }
        }

        if (
          selectedStatusFilters.length > 0 &&
          !selectedStatusFilters.includes('all')
        ) {
          filterClauses.push({
            terms: {
              'extension.status.keyword': selectedStatusFilters,
            },
          });
        }

        const { query, cdeFilter } = getTechnicalDictionarySearchQuery(search);
        if (cdeFilter) {
          filterClauses.push(cdeFilter);
        }

        const boolQuery: Record<string, unknown> = {};
        if (filterClauses.length > 0) {
          boolQuery.filter = filterClauses;
        }
        if (mustNotClauses.length > 0) {
          boolQuery.must_not = mustNotClauses;
        }

        const queryFilter =
          filterClauses.length > 0 || mustNotClauses.length > 0
            ? { query: { bool: boolQuery } }
            : undefined;

        const searchRes = await searchQuery({
          searchIndex: SearchIndex.COLUMN,
          query,
          pageNumber: page,
          pageSize: size,
          trackTotalHits: true,
          fetchSource: true,
          queryFilter,
        });

        const hits = searchRes.hits.hits || [];
        const total = searchRes.hits.total.value ?? 0;
        handlePagingChange({ total });

        const fieldsList: TechnicalFieldItem[] = hits.map((hit) => {
          const col = hit._source as unknown as ColumnSearchSource;
          const columnName = col.name || '';
          const columnDisplayName = col.displayName;
          const columnFqn = col.fullyQualifiedName || '';
          const dataType = col.dataType || 'VARCHAR';
          const dataTypeDisplay = col.dataTypeDisplay || dataType;
          const description = col.description;
          const tags: TagLabel[] = col.tags || [];

          const table = col.table || {};
          const tableName = table.name || '';
          const tableDisplayName = table.displayName;
          const tableFqn = table.fullyQualifiedName || '';
          const tableId = table.id;

          const database = col.database || {};
          const databaseName = database.name || '';
          const databaseDisplayName = database.displayName || databaseName;
          const databaseFqn = database.fullyQualifiedName;

          const schema = col.databaseSchema || {};
          const schemaName = schema.name || '';
          const schemaDisplayName = schema.displayName || schemaName;
          const schemaFqn = schema.fullyQualifiedName;

          const service = col.service || {};
          const serviceName = service.name || databaseName || 'SRC30';

          // Find CDE tag from tags or glossaryTags
          let cdeCode: string | undefined;
          let cdeName: string | undefined;
          let cdeFqn: string | undefined;

          const glossaryTag = tags.find((tag) => {
            const fqn = (tag.tagFQN || '').toLowerCase();

            return (
              (tag.source === TagSource.Glossary ||
                tag.source === 'Glossary') &&
              fqn.startsWith(DATA_DICTIONARY_TAG_PREFIX)
            );
          });

          if (glossaryTag) {
            const rawCode = glossaryTag.tagFQN?.split('.').pop()?.trim() || '';
            if (rawCode) {
              cdeCode = rawCode;
              cdeFqn = glossaryTag.tagFQN;
              const mapped = cdeDisplayMap[rawCode.toUpperCase()];
              if (mapped) {
                cdeName = mapped.name;
                cdeFqn = mapped.fqn;
              }
            }
          } else if (col.glossaryTags && col.glossaryTags.length > 0) {
            const firstTag = col.glossaryTags.find((tag) =>
              tag.toLowerCase().startsWith(DATA_DICTIONARY_TAG_PREFIX)
            );
            if (firstTag) {
              const rawCode = firstTag.split('.').pop()?.trim() || '';
              if (rawCode) {
                cdeCode = rawCode;
                cdeFqn = firstTag;
                const mapped = cdeDisplayMap[rawCode.toUpperCase()];
                if (mapped) {
                  cdeName = mapped.name;
                  cdeFqn = mapped.fqn;
                }
              }
            }
          }

          let elementType: string | undefined;
          let elementTypeName: string | undefined;
          let generationType: string | undefined;
          let generationTypeName: string | undefined;
          let creationMethod: string | undefined;
          let creationMethodName: string | undefined;

          tags.forEach((tg) => {
            const fqn = tg.tagFQN || '';
            if (fqn.startsWith('DataElementType.')) {
              elementType = fqn.replace('DataElementType.', '');
              elementTypeName =
                elementType === 'AtomicDataElement'
                  ? 'Dữ liệu nguyên tố'
                  : 'Dữ liệu chuyển đổi';
            } else if (fqn.startsWith('FieldGenerationType.')) {
              generationType = fqn.replace('FieldGenerationType.', '');
              if (generationType === 'SystemGenerated') {
                generationTypeName = 'Hệ thống tự sinh';
              } else if (generationType === 'SystemDerived') {
                generationTypeName = 'Hệ thống tính toán';
              } else if (generationType === 'ManualInput') {
                generationTypeName = 'Nhập thủ công';
              } else if (generationType === 'FileUpload') {
                generationTypeName = 'Tải lên';
              }
            } else if (fqn.startsWith('DataCreationMethod.')) {
              creationMethod = fqn.replace('DataCreationMethod.', '');
              creationMethodName =
                creationMethod === 'Parameterised'
                  ? 'Tham số'
                  : creationMethod === 'Hardcoded'
                  ? 'Mã cứng'
                  : 'N/A';
            }
          });

          const finalStatus =
            (col.extension?.status as EntityStatus | undefined) ??
            EntityStatus.Draft;
          const columnMetadata = getTechnicalColumnMetadata(
            col,
            cdeFqn ? cdeSurvivorshipMap.get(cdeFqn) : undefined
          );

          return {
            id: col.id || columnFqn,
            databaseName,
            databaseDisplayName,
            databaseFqn,
            schemaName,
            schemaDisplayName,
            schemaFqn,
            tableId,
            tableName,
            tableDisplayName,
            tableFqn,
            columnName,
            columnDisplayName,
            columnFqn,
            status: finalStatus,
            businessVersion: col.extension?.businessVersion ?? '1.0',
            releaseVersionType:
              col.extension?.releaseVersionType ??
              getCDEReleaseVersionType(
                undefined,
                col.extension?.businessVersion ?? '1.0'
              ),
            serviceName,
            cdeCode,
            cdeName,
            cdeFqn,
            dataType,
            dataTypeDisplay,
            ...columnMetadata,
            timeliness: col.extension?.timeliness,
            systemOwner: col.extension?.systemOwner,
            elementType: col.extension?.elementType || elementType,
            elementTypeName:
              col.extension?.elementTypeName ||
              elementTypeName ||
              col.extension?.elementType ||
              elementType,
            generationType: col.extension?.generationType || generationType,
            generationTypeName:
              col.extension?.generationTypeName ||
              generationTypeName ||
              col.extension?.generationType ||
              generationType,
            creationMethod: col.extension?.creationMethod || creationMethod,
            creationMethodName:
              col.extension?.creationMethodName ||
              creationMethodName ||
              col.extension?.creationMethod ||
              creationMethod,
            description,
            tags,
          };
        });

        const cdeOpts: Array<{
          label: string;
          value: string;
          name: string;
          code: string;
          termId?: string;
          fullyQualifiedName: string;
        }> = [];
        Object.entries(cdeDisplayMap).forEach(([code, val]) => {
          cdeOpts.push({
            label: `${code} - ${val.name}`,
            value: code,
            name: val.name,
            code,
            termId: val.termId,
            fullyQualifiedName: val.fqn,
          });
        });
        if (requestGeneration === requestGenerationRef.current) {
          setCdeOptions(cdeOpts);
          setTechnicalFields(fieldsList);
        }
      } catch (err) {
        showErrorToast(err as Error);
      } finally {
        if (requestGeneration === requestGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      currentPage,
      pageSize,
      searchText,
      selectedSources,
      selectedElementTypes,
      selectedGenTypes,
      selectedCreationMethods,
      selectedCdeFilters,
      selectedStatusFilters,
      handlePagingChange,
      governedReadEnabled,
      requestedBusinessVersion,
      versionView,
    ]
  );

  useEffect(() => {
    // Clear any stale local overrides so Backend is the single source of truth across all users
    try {
      localStorage.removeItem(TECHNICAL_DICTIONARY_OVERRIDES_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    fetchTechnicalStats();
  }, [fetchTechnicalStats]);

  useEffect(() => {
    fetchTechnicalMetadata(currentPage, pageSize, searchText);
  }, [
    currentPage,
    pageSize,
    selectedSources,
    selectedElementTypes,
    selectedGenTypes,
    selectedCreationMethods,
    selectedCdeFilters,
    selectedStatusFilters,
    requestedBusinessVersion,
  ]);

  useEffect(() => {
    if (bootstrapStatus?.status !== 'Running') {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      fetchTechnicalStats();
      fetchTechnicalMetadata(currentPage, pageSize, searchText);
    }, 3000);

    return () => globalThis.clearTimeout(timer);
  }, [
    bootstrapStatus?.status,
    currentPage,
    fetchTechnicalMetadata,
    fetchTechnicalStats,
    pageSize,
    searchText,
  ]);

  // Action Handlers
  const handleEditField = useCallback((item: TechnicalFieldItem) => {
    setEditingField(item);
    setIsEditModalVisible(true);
  }, []);

  const handleSaveField = useCallback(
    async (updatedItem: Partial<TechnicalFieldItem>) => {
      setIsSubmittingEdit(true);
      try {
        const finalStatus = updatedItem.status || EntityStatus.Draft;
        const governedMutationEnabled = isTechnicalDictionaryFeatureEnabled(
          TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
        );
        if (
          !governedMutationEnabled ||
          !updatedItem.parentBusinessVersion ||
          !updatedItem.id ||
          updatedItem.workingRevision === undefined
        ) {
          throw new Error(
            'Không thể lưu bản ghi vì thiếu phiên bản Từ điển kỹ thuật.'
          );
        }
        await saveTechnicalDictionaryWorking(
          updatedItem.id,
          updatedItem.parentBusinessVersion,
          updatedItem.workingRevision,
          {
            description: updatedItem.description,
            extension: {
              cdeCode: updatedItem.cdeCode,
              cdeName: updatedItem.cdeName,
              cdeDataDictionaryVersionId: updatedItem.dataDictionaryVersionId,
              survivorshipRank: updatedItem.survivorshipRank,
              survivorshipNote: updatedItem.survivorshipNote,
              elementType: updatedItem.elementType,
              elementTypeName: updatedItem.elementTypeName,
              generationType: updatedItem.generationType,
              generationTypeName: updatedItem.generationTypeName,
              creationMethod: updatedItem.creationMethod,
              creationMethodName: updatedItem.creationMethodName,
              timeliness: updatedItem.timeliness,
              systemOwner: updatedItem.systemOwner,
            },
            relatedTerms:
              updatedItem.cdeTermId && updatedItem.cdeSnapshotId
                ? [
                    {
                      term: {
                        id: updatedItem.cdeTermId,
                        type: 'glossaryTerm',
                      },
                      relationType: 'relatedTo',
                      versionContext: {
                        snapshotId: updatedItem.cdeSnapshotId,
                        businessVersion: updatedItem.cdeBusinessVersion,
                        parentBusinessVersion:
                          updatedItem.cdeParentBusinessVersion,
                      },
                    },
                  ]
                : [],
          }
        );

        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === updatedItem.id
              ? ({
                  ...f,
                  ...updatedItem,
                  status: finalStatus,
                } as TechnicalFieldItem)
              : f
          )
        );

        showSuccessToast(
          t('message.update-field-success', {
            defaultValue: 'Cập nhật trường kỹ thuật thành công!',
          })
        );
        setIsEditModalVisible(false);
        setEditingField(null);
      } catch (err) {
        showErrorToast(err as Error);
      } finally {
        setIsSubmittingEdit(false);
      }
    },
    [t]
  );

  const handleApproveField = useCallback(
    async (item: TechnicalFieldItem) => {
      try {
        const governedMutationEnabled = isTechnicalDictionaryFeatureEnabled(
          TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
        );
        if (
          !governedMutationEnabled ||
          !item.parentBusinessVersion ||
          item.workingRevision === undefined
        ) {
          throw new Error(
            'Không thể phê duyệt vì thiếu phiên bản Từ điển kỹ thuật.'
          );
        }

        let revision = item.workingRevision;
        if (item.status === EntityStatus.Draft) {
          const submitted = await transitionTechnicalDictionaryWorking(
            item.id,
            item.parentBusinessVersion,
            'submit',
            revision
          );
          revision = submitted.revision;
        }
        await transitionTechnicalDictionaryWorking(
          item.id,
          item.parentBusinessVersion,
          'approve',
          revision
        );

        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: EntityStatus.Approved } : f
          )
        );

        showSuccessToast(
          t('message.approve-field-success', {
            defaultValue: 'Phê duyệt trường kỹ thuật thành công',
          })
        );
      } catch (err) {
        showErrorToast(err as Error);
      }
    },
    [t]
  );

  const handleRejectField = useCallback(
    async (item: TechnicalFieldItem) => {
      try {
        if (
          !isTechnicalDictionaryFeatureEnabled(
            TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
          ) ||
          !item.parentBusinessVersion ||
          item.workingRevision === undefined
        ) {
          throw new Error(
            'Không thể từ chối vì thiếu phiên bản Từ điển kỹ thuật.'
          );
        }
        await transitionTechnicalDictionaryWorking(
          item.id,
          item.parentBusinessVersion,
          'reject',
          item.workingRevision
        );

        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: EntityStatus.Rejected } : f
          )
        );

        showSuccessToast(
          t('message.reject-field-success', {
            defaultValue: 'Từ chối trường kỹ thuật thành công',
          })
        );
      } catch (err) {
        showErrorToast(err as Error);
      }
    },
    [t]
  );

  const handleRevokeField = useCallback(
    async (item: TechnicalFieldItem) => {
      try {
        if (
          !isTechnicalDictionaryFeatureEnabled(
            TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
          ) ||
          !item.parentBusinessVersion ||
          item.workingRevision === undefined
        ) {
          throw new Error(
            'Không thể thu hồi vì thiếu phiên bản Từ điển kỹ thuật.'
          );
        }
        await transitionTechnicalDictionaryWorking(
          item.id,
          item.parentBusinessVersion,
          'revoke',
          item.workingRevision
        );

        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === item.id ||
            (f.tableFqn === item.tableFqn &&
              f.columnName?.toLowerCase() === item.columnName?.toLowerCase())
              ? {
                  ...f,
                  status: EntityStatus.Draft,
                  cdeCode: undefined,
                  cdeName: undefined,
                  cdeFqn: undefined,
                  elementType: undefined,
                  elementTypeName: undefined,
                  generationType: undefined,
                  generationTypeName: undefined,
                  creationMethod: undefined,
                  creationMethodName: undefined,
                  tags: (f.tags || []).filter(
                    (tag) => !isTechnicalDictionaryManagedTag(tag)
                  ),
                }
              : f
          )
        );

        showSuccessToast(
          t('message.revoke-field-success', {
            defaultValue: 'Hủy phê duyệt trường kỹ thuật thành công',
          })
        );
      } catch (err) {
        showErrorToast(err as Error);
      }
    },
    [t]
  );

  const handleWorkflowAction = useCallback(
    async (
      item: TechnicalFieldItem,
      action: 'submit' | 'reopen',
      nextStatus: EntityStatus
    ) => {
      try {
        let nextRevision = item.workingRevision;
        if (!item.parentBusinessVersion || item.workingRevision === undefined) {
          throw new Error(
            'Không thể chuyển trạng thái vì thiếu phiên bản Từ điển kỹ thuật.'
          );
        }
        const result = await transitionTechnicalDictionaryWorking(
          item.id,
          item.parentBusinessVersion,
          action,
          item.workingRevision
        );
        nextRevision = result.revision;
        setTechnicalFields((current) =>
          current.map((field) =>
            field.id === item.id
              ? {
                  ...field,
                  status: nextStatus,
                  workingRevision: nextRevision,
                }
              : field
          )
        );
        showSuccessToast(
          action === 'submit'
            ? t('message.submit-for-review-success', {
                defaultValue: 'Đã gửi trường kỹ thuật để phê duyệt',
              })
            : t('message.reopen-success', {
                defaultValue: 'Đã mở lại trường kỹ thuật',
              })
        );
      } catch (error) {
        showErrorToast(error as Error);
      }
    },
    [t]
  );

  const handleCreateRecordVersion = useCallback(
    async (item: TechnicalFieldItem) => {
      if (!item.parentBusinessVersion) {
        return;
      }
      try {
        await createTechnicalDictionaryRecordVersion(
          item.id,
          item.parentBusinessVersion
        );
        await fetchTechnicalMetadata(currentPage, pageSize, searchText);
        showSuccessToast(
          t('message.create-version-success', {
            defaultValue: 'Đã tạo phiên bản bản ghi mới',
          })
        );
      } catch (error) {
        showErrorToast(error as Error);
      }
    },
    [currentPage, fetchTechnicalMetadata, pageSize, searchText, t]
  );

  const handleSearchCde = useCallback(
    (search: string) => {
      if (!selectedCatalog?.businessVersion) {
        return;
      }
      globalThis.clearTimeout(cdeSearchTimerRef.current);
      const requestGeneration = ++cdeRequestGenerationRef.current;
      cdeSearchTimerRef.current = globalThis.setTimeout(async () => {
        try {
          const options = await getTechnicalCdeOptions({
            businessVersion: selectedCatalog.businessVersion,
            search,
            limit: 25,
          });
          if (requestGeneration === cdeRequestGenerationRef.current) {
            setCdeOptions(
              options.map((option) => ({
                label: `${option.code} · ${option.name ?? option.code} · v${
                  option.businessVersion
                }`,
                value: option.snapshotId,
                name: option.name ?? option.code,
                code: option.code,
                termId: option.termId,
                snapshotId: option.snapshotId,
                businessVersion: option.businessVersion,
                parentBusinessVersion: option.parentBusinessVersion,
                dataDictionaryVersionId: option.dataDictionaryVersionId,
              }))
            );
          }
        } catch (error) {
          if (requestGeneration === cdeRequestGenerationRef.current) {
            showErrorToast(error as Error);
          }
        }
      }, 400);
    },
    [selectedCatalog?.businessVersion]
  );

  const handleSearchTextChange = useCallback(
    (value: string) => {
      setSearchText(value);
      globalThis.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = globalThis.setTimeout(() => {
        handlePageChange(1);
        updateSearchParams({ q: value || undefined, currentPage: '1' });
        fetchTechnicalMetadata(1, pageSize, value);
      }, 400);
    },
    [fetchTechnicalMetadata, handlePageChange, pageSize, updateSearchParams]
  );

  useEffect(
    () => () => {
      globalThis.clearTimeout(searchTimerRef.current);
      globalThis.clearTimeout(cdeSearchTimerRef.current);
    },
    []
  );

  // Available data sources
  const sourceFilterOptions: FilterOption[] = useMemo(
    () =>
      (availableSources.length > 0 ? availableSources : ['MIS']).map((src) => ({
        label: src,
        value: src,
      })),
    [availableSources]
  );

  const elementTypeOptions: FilterOption[] = useMemo(
    () => [
      {
        label: t('label.atomic-data-element', {
          defaultValue: 'Dữ liệu nguyên tố',
        }),
        value: 'AtomicDataElement',
      },
      {
        label: t('label.transformed-data-element', {
          defaultValue: 'Dữ liệu chuyển đổi',
        }),
        value: 'TransformedDataElement',
      },
    ],
    [t]
  );

  const genTypeOptions: FilterOption[] = useMemo(
    () => [
      {
        label: t('label.system-generated', {
          defaultValue: 'Hệ thống tự sinh',
        }),
        value: 'SystemGenerated',
      },
      {
        label: t('label.system-derived', {
          defaultValue: 'Hệ thống tính toán',
        }),
        value: 'SystemDerived',
      },
      {
        label: t('label.manual-input', {
          defaultValue: 'Nhập thủ công',
        }),
        value: 'ManualInput',
      },
      {
        label: t('label.file-upload', {
          defaultValue: 'Tải lên',
        }),
        value: 'FileUpload',
      },
    ],
    [t]
  );

  const creationMethodOptions: FilterOption[] = useMemo(
    () => [
      {
        label: t('label.parameterised', { defaultValue: 'Tham số' }),
        value: 'Parameterised',
      },
      {
        label: t('label.hardcoded', { defaultValue: 'Mã cứng' }),
        value: 'Hardcoded',
      },
      {
        label: t('label.not-applicable', { defaultValue: 'N/A' }),
        value: 'NotApplicable',
      },
    ],
    [t]
  );

  const cdeFilterOptions: FilterOption[] = useMemo(
    () => [
      {
        label: t('label.cde-mapped-only', { defaultValue: 'Đã map CDE' }),
        value: 'MAPPED',
      },
      {
        label: t('label.cde-unmapped-only', { defaultValue: 'Chưa map CDE' }),
        value: 'UNMAPPED',
      },
    ],
    [t]
  );

  const statusFilterOptions: FilterOption[] = useMemo(
    () => [
      {
        label: t('label.status-approved-opt', {
          defaultValue: 'Đã phê duyệt',
        }),
        value: EntityStatus.Approved,
      },
      {
        label: t('label.status-in-review-opt', {
          defaultValue: 'Đang xem xét',
        }),
        value: EntityStatus.InReview,
      },
      {
        label: t('label.status-draft-opt', {
          defaultValue: 'Bản nháp',
        }),
        value: EntityStatus.Draft,
      },
      {
        label: t('label.status-rejected-opt', {
          defaultValue: 'Bị từ chối',
        }),
        value: EntityStatus.Rejected,
      },
    ],
    [t]
  );

  // Filtered dataset for Consumer or direct view
  const filteredData = useMemo(() => {
    if (governedReadEnabled) {
      return technicalFields;
    }

    if (!userRoleInfo.canViewAllStatus) {
      return technicalFields.filter(
        (item) => item.status === EntityStatus.Approved
      );
    }

    return technicalFields;
  }, [governedReadEnabled, technicalFields, userRoleInfo.canViewAllStatus]);

  // Export the current technical dictionary result set as an Excel workbook.
  const handleExportExcel = useCallback(async () => {
    const governedReadEnabled = isTechnicalDictionaryFeatureEnabled(
      TECHNICAL_DICTIONARY_READ_PATH_FLAG
    );
    if (governedReadEnabled) {
      try {
        const { blob, fileName } = await exportTechnicalDictionary({
          businessVersion: requestedBusinessVersion,
          search: searchText || undefined,
          status: selectedStatusFilters.includes('all')
            ? undefined
            : selectedStatusFilters.join(','),
          sources: selectedSources.includes('all')
            ? undefined
            : selectedSources.join(','),
          cdeMapping: selectedCdeFilters.includes('all')
            ? undefined
            : selectedCdeFilters.join(','),
          elementTypes: selectedElementTypes.includes('all')
            ? undefined
            : selectedElementTypes.join(','),
          generationTypes: selectedGenTypes.includes('all')
            ? undefined
            : selectedGenTypes.join(','),
          creationMethods: selectedCreationMethods.includes('all')
            ? undefined
            : selectedCreationMethods.join(','),
          versionView,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        return;
      } catch (error) {
        showErrorToast(error as Error);

        return;
      }
    }

    if (isEmpty(filteredData)) {
      return;
    }

    const headers = [
      'Database Name',
      'Schema Name',
      t('label.table-name', { defaultValue: 'Tên Bảng' }),
      t('label.column-name', { defaultValue: 'Tên Trường' }),
      t('label.source', { defaultValue: 'Hệ thống nguồn' }),
      t('label.cde-code-ref', { defaultValue: 'Mã CDE quy chiếu' }),
      t('label.cde-name', { defaultValue: 'Tên thành tố CDE' }),
      t('label.data-type', { defaultValue: 'Kiểu dữ liệu' }),
      t('label.scale', { defaultValue: 'Số thập phân' }),
      t('label.data-element-type', { defaultValue: 'Loại thành tố' }),
      t('label.field-generation-type', { defaultValue: 'Loại trường dữ liệu' }),
      t('label.data-creation-method', { defaultValue: 'Phương thức tạo' }),
      t('label.timeliness', { defaultValue: 'Thời gian sẵn sàng' }),
      t('label.system-owner', { defaultValue: 'Chủ sở hữu hệ thống' }),
      t('label.description', { defaultValue: 'Mô tả trường' }),
      t('label.version', { defaultValue: 'Phiên bản' }),
      t('label.release-version-type', {
        defaultValue: 'Loại phiên bản phát hành',
      }),
      t('label.status', { defaultValue: 'Trạng thái' }),
    ];

    const rows = filteredData.map((item) => [
      item.databaseName || '',
      item.schemaName || '',
      item.tableName,
      item.columnName,
      item.serviceName,
      item.cdeCode || '',
      item.cdeName || '',
      item.dataTypeDisplay || item.dataType,
      item.scale !== undefined ? item.scale : '',
      item.elementTypeName || item.elementType || '',
      item.generationTypeName || item.generationType || '',
      item.creationMethodName || item.creationMethod || '',
      item.timeliness || '',
      item.systemOwner || '',
      item.description || '',
      item.businessVersion || '',
      item.releaseVersionType || '',
      item.status || '',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 26 },
      { wch: 24 },
      { wch: 18 },
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 14 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 42 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Từ điển kỹ thuật');
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `TuDienKyThuat_Agribank_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    filteredData,
    searchText,
    selectedStatusFilters,
    selectedSources,
    selectedCdeFilters,
    selectedElementTypes,
    selectedGenTypes,
    selectedCreationMethods,
    requestedBusinessVersion,
    versionView,
    t,
  ]);

  const extraTableFilters = useMemo(
    () => (
      <>
        <Input
          allowClear
          className="tech-dict-search-input"
          data-testid="search-tech-dict-input"
          placeholder={t('label.search-table-column-cde', {
            defaultValue: 'Tìm kiếm tên bảng, cột, mã CDE...',
          })}
          prefix={<SearchOutlined className="text-grey-muted" />}
          style={{ width: 280 }}
          value={searchText}
          onChange={(e) => handleSearchTextChange(e.target.value)}
          onPressEnter={() => {
            handlePageChange(1);
            updateSearchParams({
              q: searchText || undefined,
              currentPage: '1',
            });
            fetchTechnicalMetadata(1, pageSize, searchText);
          }}
        />

        <CDEFilterDropdown
          dataTestId="status-filter-dropdown"
          label={t('label.status', { defaultValue: 'Trạng thái' })}
          options={statusFilterOptions}
          selectedValues={selectedStatusFilters}
          onChange={(vals) => {
            setSelectedStatusFilters(vals);
            handlePageChange(1);
            updateSearchParams({
              statuses: vals.includes('all') ? undefined : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <CDEFilterDropdown
          dataTestId="source-filter-dropdown"
          label={t('label.source', { defaultValue: 'Hệ thống nguồn' })}
          options={sourceFilterOptions}
          selectedValues={selectedSources}
          onChange={(vals) => {
            setSelectedSources(vals);
            handlePageChange(1);
            updateSearchParams({
              sources: vals.includes('all') ? undefined : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <CDEFilterDropdown
          dataTestId="cde-filter-dropdown"
          label={t('label.cde-code-ref', { defaultValue: 'Mã CDE quy chiếu' })}
          options={cdeFilterOptions}
          selectedValues={selectedCdeFilters}
          onChange={(vals) => {
            setSelectedCdeFilters(vals);
            handlePageChange(1);
            updateSearchParams({
              cdeMapping: vals.includes('all') ? undefined : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <CDEFilterDropdown
          dataTestId="element-type-filter-dropdown"
          label={t('label.data-element-type', {
            defaultValue: 'Loại thành tố',
          })}
          options={elementTypeOptions}
          selectedValues={selectedElementTypes}
          onChange={(vals) => {
            setSelectedElementTypes(vals);
            handlePageChange(1);
            updateSearchParams({
              elementTypes: vals.includes('all') ? undefined : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <CDEFilterDropdown
          dataTestId="gen-type-filter-dropdown"
          label={t('label.field-generation-type', {
            defaultValue: 'Loại trường dữ liệu',
          })}
          options={genTypeOptions}
          selectedValues={selectedGenTypes}
          onChange={(vals) => {
            setSelectedGenTypes(vals);
            handlePageChange(1);
            updateSearchParams({
              generationTypes: vals.includes('all')
                ? undefined
                : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <CDEFilterDropdown
          dataTestId="creation-method-filter-dropdown"
          label={t('label.creation-method', {
            defaultValue: 'Phương thức tạo',
          })}
          options={creationMethodOptions}
          selectedValues={selectedCreationMethods}
          onChange={(vals) => {
            setSelectedCreationMethods(vals);
            handlePageChange(1);
            updateSearchParams({
              creationMethods: vals.includes('all')
                ? undefined
                : vals.join(','),
              currentPage: '1',
            });
          }}
        />

        <div className="tech-dict-toolbar-actions">
          <Dropdown
            menu={{
              items: [
                {
                  disabled:
                    governedReadEnabled &&
                    !(governedCapabilities?.canExport ?? false),
                  icon: <FileExcelOutlined />,
                  key: 'export-excel',
                  label: t('label.export-excel', {
                    defaultValue: 'Xuất Excel',
                  }),
                  onClick: handleExportExcel,
                },
              ],
            }}
            placement="bottomRight"
            trigger={['click']}>
            <Button
              aria-label={t('label.more-actions', {
                defaultValue: 'Thao tác khác',
              })}
              className="tech-dict-more-actions-button"
              data-testid="technical-dictionary-more-actions"
              icon={<MoreOutlined />}
              title={t('label.more-actions', {
                defaultValue: 'Thao tác khác',
              })}
            />
          </Dropdown>
        </div>
      </>
    ),
    [
      searchText,
      sourceFilterOptions,
      selectedSources,
      elementTypeOptions,
      selectedElementTypes,
      genTypeOptions,
      selectedGenTypes,
      creationMethodOptions,
      selectedCreationMethods,
      cdeFilterOptions,
      selectedCdeFilters,
      statusFilterOptions,
      selectedStatusFilters,
      governedReadEnabled,
      governedCapabilities?.canExport,
      updateSearchParams,
      userRoleInfo.canViewAllStatus,
      handleExportExcel,
      handleSearchTextChange,
      fetchTechnicalMetadata,
      handlePageChange,
      pageSize,
      t,
    ]
  );

  const mainTableContent = (
    <div
      className={classNames('tech-dict-content-card', {
        'tech-dict-content-card-embedded': isEmbedded,
      })}>
      {bootstrapStatus?.status === 'Running' && (
        <Alert
          showIcon
          className="m-b-md"
          message={t('message.technical-dictionary-bootstrap-running', {
            defaultValue:
              'Đang đồng bộ dữ liệu kỹ thuật ({{processed}}/{{total}})',
            processed: bootstrapStatus.processed,
            total: bootstrapStatus.total,
          })}
          type="info"
        />
      )}
      {bootstrapStatus?.status === 'Failed' && (
        <Alert
          showIcon
          className="m-b-md"
          message={t('message.technical-dictionary-bootstrap-failed', {
            defaultValue:
              'Đồng bộ dữ liệu kỹ thuật thất bại với {{failed}} bản ghi. Vui lòng kiểm tra log bootstrap.',
            failed: bootstrapStatus.failed,
          })}
          type="error"
        />
      )}
      {/* Matrix Table */}
      <TechnicalDictionaryTable
        canApprove={
          governedMutationEnabled && (governedCapabilities?.canApprove ?? false)
        }
        canCreateVersion={
          governedMutationEnabled &&
          (governedCapabilities?.canCreateVersion ?? false)
        }
        canEdit={
          governedMutationEnabled &&
          (governedCapabilities?.canEditWorking ?? false)
        }
        canReject={
          governedMutationEnabled && (governedCapabilities?.canReject ?? false)
        }
        canReopen={
          governedMutationEnabled &&
          (governedCapabilities?.canEditWorking ?? false)
        }
        canRevoke={
          governedMutationEnabled && (governedCapabilities?.canRevoke ?? false)
        }
        canSubmit={
          governedMutationEnabled && (governedCapabilities?.canSubmit ?? false)
        }
        customPaginationProps={customPaginationProps}
        data={filteredData}
        extraTableFilters={extraTableFilters}
        extraTableFiltersClassName="cde-glossary-table-toolbar tech-dict-table-toolbar"
        isLoading={isLoading}
        onApprove={handleApproveField}
        onCreateVersion={handleCreateRecordVersion}
        onEdit={handleEditField}
        onRefresh={() =>
          fetchTechnicalMetadata(currentPage, pageSize, searchText)
        }
        onReject={handleRejectField}
        onReopen={(item) =>
          handleWorkflowAction(item, 'reopen', EntityStatus.Draft)
        }
        onRevoke={handleRevokeField}
        onSubmit={(item) =>
          handleWorkflowAction(item, 'submit', EntityStatus.InReview)
        }
      />
    </div>
  );

  const editModalContent = (
    <TechnicalDictionaryEditModal
      cdeOptions={cdeOptions}
      fieldItem={editingField}
      isSubmitting={isSubmittingEdit}
      visible={isEditModalVisible}
      onCancel={() => {
        setIsEditModalVisible(false);
        setEditingField(null);
      }}
      onSave={handleSaveField}
      onSearchCde={handleSearchCde}
    />
  );

  if (isEmbedded) {
    return (
      <div className="tech-dict-embedded-container">
        {mainTableContent}
        {editModalContent}
      </div>
    );
  }

  return (
    <PageLayoutV1
      mainContainerClassName="technical-dictionary-page-scroll"
      pageTitle={t('label.technical-dictionary')}>
      <div className="tech-dict-page-container">
        <div className="m-b-md">
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </div>

        {/* Technical dictionary entity header */}
        <div className="tech-dict-page-header">
          <div className="tech-dict-title-row">
            <div className="tech-dict-title-left">
              <div className="tech-dict-icon-wrapper">
                <ColumnBulkIcon height={22} width={22} />
              </div>
              <div className="tech-dict-title-copy">
                <div className="tech-dict-title-heading">
                  <h1 className="tech-dict-title">
                    {t('label.technical-dictionary', {
                      defaultValue: 'Từ điển kỹ thuật',
                    })}
                  </h1>
                  <GovernedEntityHeaderBadges
                    businessVersion={headerVersion}
                    status={headerStatus as EntityStatus}
                    statusTestId="technical-dictionary-header-status"
                    versionButtonTestId="technical-dictionary-version-button"
                    versionItems={
                      catalogVersions.length > 0
                        ? catalogVersions.map((catalog) => ({
                            key: catalog.businessVersion,
                            label: `${t('label.version')}: ${
                              catalog.businessVersion
                            }`,
                          }))
                        : [
                            {
                              key: headerVersion,
                              label: `${t('label.version')}: ${headerVersion}`,
                            },
                          ]
                    }
                    versionLabel={t('label.version')}
                    onVersionSelect={(key) => {
                      if (
                        catalogVersions.some(
                          (catalog) => catalog.businessVersion === key
                        )
                      ) {
                        handleCatalogVersionChange(key);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Technical dictionary summary cards */}
          <div className="tech-dict-stats-strip">
            <div className="tech-dict-stat-item">
              <span className="stat-icon primary">
                <AppstoreOutlined />
              </span>
              <span className="stat-label">
                {t('label.total-technical-columns', {
                  defaultValue: 'Tổng Cột kỹ thuật',
                })}
                :
              </span>
              <span className="stat-value">
                {stats.totalFields.toLocaleString()}
              </span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon blue">
                <TableOutlined />
              </span>
              <span className="stat-label">
                {t('label.data-tables', { defaultValue: 'Bảng dữ liệu' })}:
              </span>
              <span className="stat-value">
                {stats.totalTables.toLocaleString()}
              </span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon green">
                <CheckCircleOutlined />
              </span>
              <span className="stat-label">
                {t('label.cde-mapped', { defaultValue: 'Đã quy chiếu CDE' })}:
              </span>
              <span className="stat-value">
                {stats.totalMapped.toLocaleString()}
              </span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon purple">
                <DatabaseOutlined />
              </span>
              <span className="stat-label">
                {t('label.source-systems', { defaultValue: 'Hệ thống nguồn' })}:
              </span>
              <span className="stat-value">
                {stats.totalSources.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        {mainTableContent}

        {/* Edit Technical Field Modal */}
        {editModalContent}
      </div>
    </PageLayoutV1>
  );
};

export default TechnicalDictionaryPage;
