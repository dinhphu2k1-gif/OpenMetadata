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
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button } from '@openmetadata/ui-core-components';
import { Input } from 'antd';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import CDEFilterDropdown, {
  FilterOption,
} from '../../components/Glossary/GlossaryTermTab/CDEFilterDropdown.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../constants/Glossary.contant';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { usePaging } from '../../hooks/paging/usePaging';
import { Table } from '../../generated/entity/data/table';
import { LabelType, State, TagLabel, TagSource } from '../../generated/type/tagLabel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  getGlossaryTerms,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import {
  parseSurvivorshipRules,
} from '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/survivorship.interface';
import { getTableDetailsByFQN, patchTableDetails } from '../../rest/tableAPI';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
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
            glossaryTags: `${DATA_DICTIONARY_GLOSSARY_NAME}.${trimmed}`.toLowerCase(),
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
          status: 'In Review',
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

      // Filter out existing CDE Glossary tags and Classification tags that we manage
      const existingTags: TagLabel[] = (col.tags || []).filter((t) => {
        const fqn = (t.tagFQN || '').toLowerCase();
        const isGlossary =
          t.source === TagSource.Glossary ||
          t.source === 'Glossary' ||
          fqn.startsWith(`${DATA_DICTIONARY_GLOSSARY_NAME.toLowerCase()}.`) ||
          fqn.includes('cde');
        const isClassification =
          t.tagFQN?.startsWith('DataElementType.') ||
          t.tagFQN?.startsWith('FieldGenerationType.') ||
          t.tagFQN?.startsWith('DataCreationMethod.');

        return !isGlossary && !isClassification;
      });

      // Add CDE Glossary Tag
      if (item.cdeCode) {
        const cdeFqn =
          item.cdeFqn || `${DATA_DICTIONARY_GLOSSARY_NAME}.${item.cdeCode}`;
        existingTags.push({
          tagFQN: cdeFqn,
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        });
      }

      // Add Element Type Tag
      if (item.elementType) {
        existingTags.push({
          tagFQN: `DataElementType.${item.elementType}`,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        });
      }

      // Add Generation Type Tag
      if (item.generationType) {
        existingTags.push({
          tagFQN: `FieldGenerationType.${item.generationType}`,
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        });
      }

      // Add Creation Method Tag
      if (item.creationMethod) {
        existingTags.push({
          tagFQN: `DataCreationMethod.${item.creationMethod}`,
          source: TagSource.Classification,
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
          status: 'Approved',
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
    const cdeFqnToSync =
      item.cdeFqn ||
      (item.cdeCode ? `${DATA_DICTIONARY_GLOSSARY_NAME}.${item.cdeCode}` : undefined);
    const colFqnToSync = item.columnFqn || `${item.tableFqn}.${item.columnName}`;
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

      // Filter out all CDE Glossary tags and Classification tags that we manage
      const remainingTags: TagLabel[] = (col.tags || []).filter((t) => {
        const fqn = (t.tagFQN || '').toLowerCase();
        const isGlossary =
          t.source === TagSource.Glossary ||
          t.source === 'Glossary' ||
          fqn.startsWith(`${DATA_DICTIONARY_GLOSSARY_NAME.toLowerCase()}.`) ||
          fqn.includes('cde');
        const isClassification =
          t.tagFQN?.startsWith('DataElementType.') ||
          t.tagFQN?.startsWith('FieldGenerationType.') ||
          t.tagFQN?.startsWith('DataCreationMethod.');

        return !isGlossary && !isClassification;
      });

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
          status: 'Draft',
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
    console.error('Failed to remove column metadata from backend table:', error);

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
          status: 'Rejected',
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

export const TechnicalDictionaryPage: React.FC<TechnicalDictionaryPageProps> = ({
  isEmbedded = false,
}) => {
  const { t } = useTranslation();
  const { currentUser, selectedPersona } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [technicalFields, setTechnicalFields] = useState<TechnicalFieldItem[]>([]);
  const [cdeOptions, setCdeOptions] = useState<
    Array<{ label: string; value: string; name: string }>
  >([]);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>(['all']);
  const [selectedElementTypes, setSelectedElementTypes] = useState<string[]>([
    'all',
  ]);
  const [selectedGenTypes, setSelectedGenTypes] = useState<string[]>(['all']);
  const [selectedCdeFilters, setSelectedCdeFilters] = useState<string[]>([
    'all',
  ]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([
    'all',
  ]);
  const [stats, setStats] = useState({
    totalFields: 0,
    totalTables: 0,
    totalSources: 0,
    totalMapped: 0,
  });
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  const {
    currentPage,
    pageSize,
    showPagination,
    paging,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging(PAGE_SIZE_BASE);

  const handlePaginationChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page, { cursorType: null, cursorValue: undefined });
    },
    [handlePageChange]
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
      onShowSizeChange: handlePageSizeChange,
      pageSizeOptions: [
        PAGE_SIZE_BASE,
        PAGE_SIZE_MEDIUM,
        PAGE_SIZE_LARGE,
      ],
    }),
    [
      currentPage,
      showPagination,
      isLoading,
      pageSize,
      paging,
      handlePaginationChange,
      handlePageSizeChange,
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
  const [editingField, setEditingField] = useState<TechnicalFieldItem | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const fetchTechnicalStats = useCallback(async () => {
    try {
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
                filter: [{ exists: { field: 'glossaryTags' } }],
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
        .map((h) => ((h._source as unknown) as { name?: string })?.name)
        .filter(Boolean) as string[];
      const services = Array.from(new Set(rawServices));

      setStats({
        totalFields: colRes.hits.total.value || 0,
        totalTables: tableRes.hits.total.value || 0,
        totalMapped: mappedRes.hits.total.value || 0,
        totalSources: Math.max(1, services.length),
      });

      if (services.length > 0) {
        setAvailableSources(services);
      }
    } catch {
      // Ignore stats error
    }
  }, []);

  // Load metadata from OpenMetadata Columns index with server-side pagination
  const fetchTechnicalMetadata = useCallback(
    async (
      page = currentPage,
      size = pageSize,
      search = searchText
    ) => {
      setIsLoading(true);
      try {
        // 1. Fetch CDE Glossary terms to map CDE codes to business display names and survivorship rules
        const cdeDisplayMap: Record<string, { name: string; fqn: string }> = {};
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
                };
              }
              if (term.fullyQualifiedName && term.extension?.survivorshipRules) {
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
          const elTags = selectedElementTypes.map(
            (type) => `dataelementtype.${type.toLowerCase()}`
          );
          filterClauses.push({
            terms: {
              classificationTags: elTags,
            },
          });
        }

        // Generation Type filter
        if (selectedGenTypes.length > 0 && !selectedGenTypes.includes('all')) {
          const genTags = selectedGenTypes.map(
            (gen) => `fieldgenerationtype.${gen.toLowerCase()}`
          );
          filterClauses.push({
            terms: {
              classificationTags: genTags,
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
              exists: {
                field: 'glossaryTags',
              },
            });
          } else if (
            selectedCdeFilters.includes('UNMAPPED') &&
            !selectedCdeFilters.includes('MAPPED')
          ) {
            mustNotClauses.push({
              exists: {
                field: 'glossaryTags',
              },
            });
          }
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
          const col = (hit._source as unknown) as ColumnSearchSource;
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
          const databaseDisplayName =
            database.displayName || databaseName;
          const databaseFqn = database.fullyQualifiedName;

          const schema = col.databaseSchema || {};
          const schemaName = schema.name || '';
          const schemaDisplayName =
            schema.displayName || schemaName;
          const schemaFqn = schema.fullyQualifiedName;

          const service = col.service || {};
          const serviceName = service.name || databaseName || 'SRC30';

          // Find CDE tag from tags or glossaryTags
          let cdeCode: string | undefined;
          let cdeName: string | undefined;
          let cdeFqn: string | undefined;

          const glossaryTag = tags.find(
            (tg) =>
              tg.source === 'Glossary' ||
              tg.tagFQN?.startsWith(`${DATA_DICTIONARY_GLOSSARY_NAME}.`)
          );

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
            const firstTag = col.glossaryTags[0];
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

          const finalStatus = cdeCode ? 'Approved' : 'Draft';
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
            serviceName,
            cdeCode,
            cdeName,
            cdeFqn,
            dataType,
            dataTypeDisplay,
            ...columnMetadata,
            timeliness: col.extension?.timeliness,
            systemOwner: col.extension?.systemOwner,
            elementType,
            elementTypeName: elementTypeName || elementType,
            generationType,
            generationTypeName: generationTypeName || generationType,
            creationMethod: col.extension?.creationMethod || creationMethod,
            creationMethodName:
              col.extension?.creationMethodName || creationMethodName ||
              col.extension?.creationMethod || creationMethod,
            description,
            tags,
          };
        });

        const cdeOpts: Array<{ label: string; value: string; name: string }> = [];
        Object.entries(cdeDisplayMap).forEach(([code, val]) => {
          cdeOpts.push({
            label: `${code} - ${val.name}`,
            value: code,
            name: val.name,
          });
        });
        setCdeOptions(cdeOpts);
        setTechnicalFields(fieldsList);
      } catch (err) {
        showErrorToast(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentPage,
      pageSize,
      searchText,
      selectedSources,
      selectedElementTypes,
      selectedGenTypes,
      selectedCdeFilters,
      handlePagingChange,
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
    selectedCdeFilters,
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
        const finalStatus = updatedItem.status || 'Approved';
        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === updatedItem.id
              ? ({ ...f, ...updatedItem, status: finalStatus } as TechnicalFieldItem)
              : f
          )
        );

        // Directly sync metadata to backend (aligning with CDE and Data Quality direct save workflow)
        await syncColumnMetadataToBackend({ ...updatedItem, status: finalStatus });

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
        setTechnicalFields((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'Approved' } : f))
        );

        // Sync metadata to OpenMetadata backend upon approval
        await syncColumnMetadataToBackend({ ...item, status: 'Approved' });

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
        setTechnicalFields((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'Rejected' } : f))
        );

        // Persist rejection to OpenMetadata backend
        await rejectColumnMetadataOnBackend(item);

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
        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === item.id ||
            (f.tableFqn === item.tableFqn &&
              f.columnName?.toLowerCase() === item.columnName?.toLowerCase())
              ? {
                  ...f,
                  status: 'Draft',
                  cdeCode: undefined,
                  cdeName: undefined,
                  cdeFqn: undefined,
                  elementType: undefined,
                  elementTypeName: undefined,
                  generationType: undefined,
                  generationTypeName: undefined,
                  creationMethod: undefined,
                  creationMethodName: undefined,
                  tags: (f.tags || []).filter((t) => {
                    const fqn = (t.tagFQN || '').toLowerCase();
                    const isGlossary =
                      t.source === TagSource.Glossary ||
                      t.source === 'Glossary' ||
                      fqn.startsWith(
                        `${DATA_DICTIONARY_GLOSSARY_NAME.toLowerCase()}.`
                      ) ||
                      fqn.includes('cde');
                    const isClassification =
                      t.tagFQN?.startsWith('DataElementType.') ||
                      t.tagFQN?.startsWith('FieldGenerationType.') ||
                      t.tagFQN?.startsWith('DataCreationMethod.');

                    return !isGlossary && !isClassification;
                  }),
                }
              : f
          )
        );

        // Remove CDE tags from backend table column so it is unlinked from CDE assets
        await removeColumnMetadataFromBackend(item);

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
        value: 'Approved',
      },
      {
        label: t('label.status-in-review-opt', {
          defaultValue: 'Chờ phê duyệt',
        }),
        value: 'In Review',
      },
      {
        label: t('label.status-draft-opt', {
          defaultValue: 'Bản nháp',
        }),
        value: 'Draft',
      },
      {
        label: t('label.status-rejected-opt', {
          defaultValue: 'Bị từ chối',
        }),
        value: 'Rejected',
      },
    ],
    [t]
  );

  // Filtered dataset for Consumer or direct view
  const filteredData = useMemo(() => {
    if (!userRoleInfo.canViewAllStatus) {
      return technicalFields.filter(
        (item) => item.status === 'Approved' || !item.cdeCode
      );
    }

    return technicalFields;
  }, [technicalFields, userRoleInfo.canViewAllStatus]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
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
    ];

    const rows = filteredData.map((item) => [
      `"${item.databaseName || ''}"`,
      `"${item.schemaName || ''}"`,
      `"${item.tableName}"`,
      `"${item.columnName}"`,
      `"${item.serviceName}"`,
      `"${item.cdeCode || ''}"`,
      `"${(item.cdeName || '').replace(/"/g, '""')}"`,
      `"${item.dataTypeDisplay || item.dataType}"`,
      `"${item.scale !== undefined ? item.scale : ''}"`,
      `"${item.elementTypeName || item.elementType || ''}"`,
      `"${item.generationTypeName || item.generationType || ''}"`,
      `"${item.creationMethodName || item.creationMethod || ''}"`,
      `"${item.timeliness || ''}"`,
      `"${item.systemOwner || ''}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `TuDienKyThuat_Agribank_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData, t]);

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
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={() => {
            handlePageChange(1);
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
          }}
        />

        <CDEFilterDropdown
          dataTestId="element-type-filter-dropdown"
          label={t('label.data-element-type', { defaultValue: 'Loại thành tố' })}
          options={elementTypeOptions}
          selectedValues={selectedElementTypes}
          onChange={(vals) => {
            setSelectedElementTypes(vals);
            handlePageChange(1);
          }}
        />

        <CDEFilterDropdown
          dataTestId="gen-type-filter-dropdown"
          label={t('label.field-generation-type', { defaultValue: 'Loại trường dữ liệu' })}
          options={genTypeOptions}
          selectedValues={selectedGenTypes}
          onChange={(vals) => {
            setSelectedGenTypes(vals);
            handlePageChange(1);
          }}
        />

        <div className="tech-dict-toolbar-actions">
          <Button
            className="d-flex items-center gap-1"
            color="secondary"
            data-testid="export-csv-btn"
            iconLeading={<DownloadOutlined />}
            size="sm"
            onPress={handleExportCSV}>
            {t('label.export-csv', { defaultValue: 'Xuất CSV' })}
          </Button>
          <Button
            className="d-flex items-center justify-center"
            color="secondary"
            data-testid="reload-btn"
            iconLeading={<ReloadOutlined />}
            size="sm"
            title={t('label.reload', { defaultValue: 'Tải lại' })}
            onPress={() => {
              setSearchText('');
              handlePageChange(1);
              fetchTechnicalMetadata(1, pageSize, '');
              fetchTechnicalStats();
            }}
          />
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
      cdeFilterOptions,
      selectedCdeFilters,
      statusFilterOptions,
      selectedStatusFilters,
      userRoleInfo.canViewAllStatus,
      handleExportCSV,
      fetchTechnicalMetadata,
      fetchTechnicalStats,
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
      {/* Matrix Table */}
      <TechnicalDictionaryTable
        canApprove={userRoleInfo.canApprove}
        canEdit={userRoleInfo.canEdit}
        canReject={userRoleInfo.canReject}
        canRevoke={userRoleInfo.canRevoke}
        customPaginationProps={customPaginationProps}
        data={filteredData}
        extraTableFilters={extraTableFilters}
        extraTableFiltersClassName="cde-glossary-table-toolbar tech-dict-table-toolbar"
        isLoading={isLoading}
        onApprove={handleApproveField}
        onEdit={handleEditField}
        onRefresh={() => fetchTechnicalMetadata(currentPage, pageSize, searchText)}
        onReject={handleRejectField}
        onRevoke={handleRevokeField}
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
    <PageLayoutV1 pageTitle={t('label.technical-dictionary')}>
      <div className="tech-dict-page-container">
        <div className="m-b-md">
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </div>

        {/* Sleek OpenMetadata Header */}
        <div className="tech-dict-page-header">
          <div className="tech-dict-title-row">
            <div className="tech-dict-title-left">
              <div className="tech-dict-icon-wrapper">
                <ColumnBulkIcon height={22} width={22} />
              </div>
              <h1 className="tech-dict-title">
                {t('label.technical-dictionary', { defaultValue: 'Từ điển kỹ thuật' })}
              </h1>
            </div>
          </div>
          <div className="tech-dict-subheading">
            {t('message.technical-dictionary-description', {
              defaultValue:
                'Danh mục ma trận đặc tả kỹ thuật từ Bảng, Cột, Hệ thống nguồn và ánh xạ quy chiếu về Thành tố dữ liệu dùng chung (CDE).',
            })}
          </div>

          {/* Flat, Elegant Stats Strip */}
          <div className="tech-dict-stats-strip">
            <div className="tech-dict-stat-item">
              <span className="stat-icon primary">
                <AppstoreOutlined />
              </span>
              <span className="stat-label">
                {t('label.total-technical-columns', { defaultValue: 'Tổng Cột kỹ thuật' })}:
              </span>
              <span className="stat-value">{stats.totalFields.toLocaleString()}</span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon blue">
                <TableOutlined />
              </span>
              <span className="stat-label">
                {t('label.data-tables', { defaultValue: 'Bảng dữ liệu' })}:
              </span>
              <span className="stat-value">{stats.totalTables.toLocaleString()}</span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon green">
                <CheckCircleOutlined />
              </span>
              <span className="stat-label">
                {t('label.cde-mapped', { defaultValue: 'Đã quy chiếu CDE' })}:
              </span>
              <span className="stat-value">{stats.totalMapped.toLocaleString()}</span>
            </div>

            <div className="tech-dict-stat-item">
              <span className="stat-icon purple">
                <DatabaseOutlined />
              </span>
              <span className="stat-label">
                {t('label.source-systems', { defaultValue: 'Hệ thống nguồn' })}:
              </span>
              <span className="stat-value">{stats.totalSources.toLocaleString()}</span>
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
