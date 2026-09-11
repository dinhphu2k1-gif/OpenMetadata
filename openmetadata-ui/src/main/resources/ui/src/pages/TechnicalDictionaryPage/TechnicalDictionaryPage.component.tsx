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
import { Button, Input } from 'antd';
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
import { getTableDetailsByFQN, getTableList, patchTableDetails } from '../../rest/tableAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TechnicalDictionaryTable, {
  TechnicalFieldItem,
} from './TechnicalDictionaryTable.component';
import TechnicalDictionaryEditModal from './TechnicalDictionaryEditModal.component';
import './technicalDictionary.less';

export interface TechnicalDictionaryPageProps {
  isEmbedded?: boolean;
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

  // Load metadata from OpenMetadata Tables & Columns
  const fetchTechnicalMetadata = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch CDE Glossary terms to map CDE codes to business display names and survivorship rules
      const cdeDisplayMap: Record<string, { name: string; fqn: string }> = {};
      const cdeSurvivorshipMap = new Map<
        string,
        Map<string, { rank: number; note?: string }>
      >();
      try {
        const glossaryRes = await getGlossariesByName(DATA_DICTIONARY_GLOSSARY_NAME, {
          fields: 'id',
        });
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
              const ruleMap = new Map<string, { rank: number; note?: string }>();
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

      // 2. Fetch all tables with columns, tags, owners, extension
      const tablesRes = await getTableList({
        fields: 'columns,owners,tags,extension,database,databaseSchema,service',
        limit: 1000,
      });

      const tables: Table[] = tablesRes.data || [];
      const fieldsList: TechnicalFieldItem[] = [];

      tables.forEach((tbl) => {
        const tableName = tbl.name || '';
        const tableDisplayName = tbl.displayName;
        const tableFqn = tbl.fullyQualifiedName || '';
        const serviceName =
          tbl.service?.name || tbl.database?.name || 'SRC30';
        const systemOwner =
          tbl.extension?.systemOwner || tbl.service?.name || '';

        const fqnParts = (tbl.fullyQualifiedName || '').split('.');
        const fallbackDbName =
          fqnParts.length >= 4
            ? fqnParts[1]
            : fqnParts.length === 3
            ? fqnParts[1]
            : '';
        const fallbackSchemaName = fqnParts.length >= 4 ? fqnParts[2] : '';

        const databaseName =
          tbl.database?.name || tbl.database?.displayName || fallbackDbName;
        const databaseDisplayName = tbl.database?.displayName || databaseName;
        const databaseFqn =
          tbl.database?.fullyQualifiedName ||
          (fallbackDbName ? `${tbl.service?.name || fqnParts[0]}.${fallbackDbName}` : '');

        const schemaName =
          tbl.databaseSchema?.name ||
          tbl.databaseSchema?.displayName ||
          fallbackSchemaName;
        const schemaDisplayName = tbl.databaseSchema?.displayName || schemaName;
        const schemaFqn =
          tbl.databaseSchema?.fullyQualifiedName ||
          (databaseFqn && fallbackSchemaName
            ? `${databaseFqn}.${fallbackSchemaName}`
            : '');

        (tbl.columns || []).forEach((col) => {
          const columnName = col.name || '';
          const columnDisplayName = col.displayName;
          const columnFqn = col.fullyQualifiedName || `${tableFqn}.${columnName}`;
          const dataType = col.dataType || 'VARCHAR';
          const dataTypeDisplay = col.dataTypeDisplay || dataType;
          const dataLength = col.dataLength;
          const scale = col.scale;
          const precision = col.precision;
          const description = col.description;
          const tags = col.tags || [];

          // Find CDE tag from tags or extension
          let cdeCode: string | undefined = col.extension?.cdeCode;
          let cdeName: string | undefined = col.extension?.cdeName;
          let cdeFqn: string | undefined;

          // Check Glossary Tags
          const glossaryTag = tags.find(
            (tg) =>
              tg.source === 'Glossary' ||
              tg.tagFQN?.startsWith(`${DATA_DICTIONARY_GLOSSARY_NAME}.`)
          );

          if (glossaryTag) {
            const rawCode = glossaryTag.tagFQN.split('.').pop()?.trim() || '';
            if (rawCode) {
              cdeCode = rawCode;
              cdeFqn = glossaryTag.tagFQN;
              const mapped = cdeDisplayMap[rawCode.toUpperCase()];
              if (mapped) {
                cdeName = mapped.name;
                cdeFqn = mapped.fqn;
              }
            }
          } else if (cdeCode) {
            const mapped = cdeDisplayMap[cdeCode.trim().toUpperCase()];
            if (mapped) {
              cdeName = mapped.name;
              cdeFqn = mapped.fqn;
            }
          }

          // Classifications tags
          let elementType = col.extension?.elementType;
          let elementTypeName = col.extension?.elementTypeName;
          let generationType = col.extension?.generationType;
          let generationTypeName = col.extension?.generationTypeName;
          let creationMethod = col.extension?.creationMethod;
          let creationMethodName = col.extension?.creationMethodName;
          const timeliness = col.extension?.timeliness || tbl.extension?.timeliness;

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

          const colSystemOwner =
            col.extension?.systemOwner ||
            tbl.extension?.systemOwner ||
            systemOwner;

          const fieldId = `${tableFqn}.${columnName}`;

          const finalStatus =
            col.extension?.status || (cdeCode ? 'Approved' : 'Draft');
          const finalCdeCode = cdeCode;
          const finalCdeName = cdeName;
          const finalCdeFqn = cdeFqn;
          const finalElementType = elementType;
          const finalElementTypeName = elementTypeName || elementType;
          const finalGenerationType = generationType;
          const finalGenerationTypeName = generationTypeName || generationType;
          const finalCreationMethod = creationMethod;
          const finalCreationMethodName = creationMethodName || creationMethod;
          const finalTimeliness = timeliness;
          const finalSystemOwner = colSystemOwner;
          const finalDescription = description;
          const finalSurvivorshipRank =
            col.extension?.survivorshipRank ??
            (finalCdeFqn
              ? cdeSurvivorshipMap.get(finalCdeFqn)?.get(columnFqn)?.rank
              : undefined);
          const finalSurvivorshipNote =
            col.extension?.survivorshipNote ??
            (finalCdeFqn
              ? cdeSurvivorshipMap.get(finalCdeFqn)?.get(columnFqn)?.note
              : undefined);

          fieldsList.push({
            id: fieldId,
            databaseName,
            databaseDisplayName,
            databaseFqn,
            schemaName,
            schemaDisplayName,
            schemaFqn,
            tableId: tbl.id,
            tableName,
            tableDisplayName,
            tableFqn,
            columnName,
            columnDisplayName,
            columnFqn,
            status: finalStatus,
            serviceName,
            cdeCode: finalCdeCode,
            cdeName: finalCdeName,
            cdeFqn: finalCdeFqn,
            dataType,
            dataTypeDisplay,
            dataLength,
            scale,
            precision,
            elementType: finalElementType,
            elementTypeName: finalElementTypeName,
            generationType: finalGenerationType,
            generationTypeName: finalGenerationTypeName,
            creationMethod: finalCreationMethod,
            creationMethodName: finalCreationMethodName,
            timeliness: finalTimeliness,
            systemOwner: finalSystemOwner,
            survivorshipRank: finalSurvivorshipRank,
            survivorshipNote: finalSurvivorshipNote,
            description: finalDescription,
            tags,
          });
        });
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
  }, []);

  useEffect(() => {
    // Clear any stale local overrides so Backend is the single source of truth across all users
    try {
      localStorage.removeItem(TECHNICAL_DICTIONARY_OVERRIDES_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    fetchTechnicalMetadata();
  }, [fetchTechnicalMetadata]);

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
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    technicalFields.forEach((f) => {
      if (f.serviceName) {
        set.add(f.serviceName);
      }
    });

    return Array.from(set).sort();
  }, [technicalFields]);

  const sourceFilterOptions: FilterOption[] = useMemo(
    () => sourceOptions.map((src) => ({ label: src, value: src })),
    [sourceOptions]
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

  // Filtered dataset
  const filteredData = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return technicalFields.filter((item) => {
      // 1. Search text filter
      if (search) {
        const matchesDb = item.databaseName?.toLowerCase().includes(search);
        const matchesSchema = item.schemaName?.toLowerCase().includes(search);
        const matchesTable = item.tableName.toLowerCase().includes(search);
        const matchesCol = item.columnName.toLowerCase().includes(search);
        const matchesCde = item.cdeCode?.toLowerCase().includes(search);
        const matchesCdeName = item.cdeName?.toLowerCase().includes(search);
        const matchesType = item.dataTypeDisplay.toLowerCase().includes(search);
        const matchesDesc = item.description?.toLowerCase().includes(search);

        if (
          !matchesDb &&
          !matchesSchema &&
          !matchesTable &&
          !matchesCol &&
          !matchesCde &&
          !matchesCdeName &&
          !matchesType &&
          !matchesDesc
        ) {
          return false;
        }
      }

      // 2. Source filter
      const isAllSources =
        selectedSources.length === 0 || selectedSources.includes('all');
      if (!isAllSources && !selectedSources.includes(item.serviceName)) {
        return false;
      }

      // 3. Element Type filter
      const isAllElementTypes =
        selectedElementTypes.length === 0 ||
        selectedElementTypes.includes('all');
      if (!isAllElementTypes) {
        const itemType = item.elementType || '';
        const matchAtomic =
          selectedElementTypes.includes('AtomicDataElement') &&
          (itemType.includes('Atomic') || itemType.includes('Nguyên'));
        const matchTransformed =
          selectedElementTypes.includes('TransformedDataElement') &&
          (itemType.includes('Transformed') || itemType.includes('Chuyển'));

        if (!matchAtomic && !matchTransformed) {
          return false;
        }
      }

      // 4. Generation Type filter
      const isAllGenTypes =
        selectedGenTypes.length === 0 || selectedGenTypes.includes('all');
      if (!isAllGenTypes) {
        const itemGen = item.generationType || '';
        const hasMatch = selectedGenTypes.some((gen) => itemGen.includes(gen));
        if (!hasMatch) {
          return false;
        }
      }

      // 5. CDE mapping filter
      const isAllCde =
        selectedCdeFilters.length === 0 || selectedCdeFilters.includes('all');
      if (!isAllCde) {
        if (
          selectedCdeFilters.includes('MAPPED') &&
          !selectedCdeFilters.includes('UNMAPPED') &&
          !item.cdeCode
        ) {
          return false;
        }
        if (
          selectedCdeFilters.includes('UNMAPPED') &&
          !selectedCdeFilters.includes('MAPPED') &&
          item.cdeCode
        ) {
          return false;
        }
      }

      // 6. Status filter
      if (!userRoleInfo.canViewAllStatus) {
        // Data Consumer: only view Approved items
        const itemStatus = (item.status || 'Approved').trim();
        if (itemStatus !== 'Approved') {
          return false;
        }
      } else {
        const isAllStatus =
          selectedStatusFilters.length === 0 ||
          selectedStatusFilters.includes('all');
        if (!isAllStatus) {
          const itemStatus = (item.status || 'Approved').trim();
          const matches = selectedStatusFilters.some((s) => {
            if (s === 'In Review') {
              return (
                itemStatus === 'In Review' ||
                itemStatus === 'InReview' ||
                itemStatus === 'Pending'
              );
            }

            return itemStatus === s;
          });
          if (!matches) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    technicalFields,
    searchText,
    selectedSources,
    selectedElementTypes,
    selectedGenTypes,
    selectedCdeFilters,
    selectedStatusFilters,
    userRoleInfo.canViewAllStatus,
  ]);

  // Statistics
  const stats = useMemo(() => {
    const totalFields = technicalFields.length;
    const totalTables = new Set(technicalFields.map((f) => f.tableFqn)).size;
    const totalSources = new Set(technicalFields.map((f) => f.serviceName)).size;
    const totalMapped = technicalFields.filter((f) => Boolean(f.cdeCode)).length;

    return {
      totalFields,
      totalTables,
      totalSources,
      totalMapped,
    };
  }, [technicalFields]);

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
      t('label.field-length-decimal', { defaultValue: 'Độ dài' }),
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
      `"${item.dataLength !== undefined ? item.dataLength : ''}"`,
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
            defaultValue: 'Tìm kiếm tên bảng, cột, mã CDE, kiểu DL...',
          })}
          prefix={<SearchOutlined className="text-grey-muted" />}
          style={{ width: 280 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <CDEFilterDropdown
          dataTestId="source-filter-dropdown"
          label={t('label.source', { defaultValue: 'Hệ thống nguồn' })}
          options={sourceFilterOptions}
          selectedValues={selectedSources}
          onChange={setSelectedSources}
        />

        <CDEFilterDropdown
          dataTestId="element-type-filter-dropdown"
          label={t('label.data-element-type', { defaultValue: 'Loại thành tố' })}
          options={elementTypeOptions}
          selectedValues={selectedElementTypes}
          onChange={setSelectedElementTypes}
        />

        <CDEFilterDropdown
          dataTestId="gen-type-filter-dropdown"
          label={t('label.field-generation-type', { defaultValue: 'Loại trường' })}
          options={genTypeOptions}
          selectedValues={selectedGenTypes}
          onChange={setSelectedGenTypes}
        />

        <CDEFilterDropdown
          dataTestId="cde-filter-dropdown"
          label={t('label.cde-code-ref', { defaultValue: 'Quy chiếu CDE' })}
          options={cdeFilterOptions}
          selectedValues={selectedCdeFilters}
          onChange={setSelectedCdeFilters}
        />

        {userRoleInfo.canViewAllStatus && (
          <CDEFilterDropdown
            dataTestId="status-filter-dropdown"
            label={t('label.status', { defaultValue: 'Trạng thái' })}
            options={statusFilterOptions}
            selectedValues={selectedStatusFilters}
            onChange={setSelectedStatusFilters}
          />
        )}

        <div className="tech-dict-toolbar-actions">
          <Button
            className="d-flex items-center gap-1"
            data-testid="export-csv-btn"
            icon={<DownloadOutlined />}
            size="small"
            onClick={handleExportCSV}>
            {t('label.export-csv', { defaultValue: 'Xuất CSV' })}
          </Button>
          <Button
            className="d-flex items-center justify-center"
            data-testid="reload-btn"
            icon={<ReloadOutlined />}
            size="small"
            title={t('label.reload', { defaultValue: 'Tải lại' })}
            onClick={fetchTechnicalMetadata}
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
        data={filteredData}
        extraTableFilters={extraTableFilters}
        extraTableFiltersClassName="tech-dict-table-toolbar"
        isLoading={isLoading}
        onApprove={handleApproveField}
        onEdit={handleEditField}
        onRefresh={fetchTechnicalMetadata}
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

        {/* Header Card */}
        <div className="tech-dict-header-card">
          <div className="tech-dict-title">
            <div className="tech-dict-icon-wrapper">
              <ColumnBulkIcon height={22} width={22} />
            </div>
            <span>{t('label.technical-dictionary', { defaultValue: 'Từ điển kỹ thuật' })}</span>
          </div>
          <div className="tech-dict-subheading">
            {t('message.technical-dictionary-description', {
              defaultValue:
                'Danh mục ma trận đặc tả kỹ thuật từ Bảng, Cột, Hệ thống nguồn và ánh xạ quy chiếu về Thành tố dữ liệu dùng chung (CDE).',
            })}
          </div>

          {/* Stats Row */}
          <div className="tech-dict-stats-row">
            <div className="tech-stat-card">
              <div className="tech-stat-icon primary">
                <AppstoreOutlined />
              </div>
              <div className="tech-stat-info">
                <div className="tech-stat-value">{stats.totalFields.toLocaleString()}</div>
                <div className="tech-stat-label">
                  {t('label.total-technical-columns', { defaultValue: 'Tổng Cột kỹ thuật' })}
                </div>
              </div>
            </div>

            <div className="tech-stat-card">
              <div className="tech-stat-icon blue">
                <TableOutlined />
              </div>
              <div className="tech-stat-info">
                <div className="tech-stat-value">{stats.totalTables.toLocaleString()}</div>
                <div className="tech-stat-label">
                  {t('label.data-tables', { defaultValue: 'Bảng dữ liệu' })}
                </div>
              </div>
            </div>

            <div className="tech-stat-card">
              <div className="tech-stat-icon green">
                <CheckCircleOutlined />
              </div>
              <div className="tech-stat-info">
                <div className="tech-stat-value">{stats.totalMapped.toLocaleString()}</div>
                <div className="tech-stat-label">
                  {t('label.cde-mapped', { defaultValue: 'Đã quy chiếu CDE' })}
                </div>
              </div>
            </div>

            <div className="tech-stat-card">
              <div className="tech-stat-icon purple">
                <DatabaseOutlined />
              </div>
              <div className="tech-stat-info">
                <div className="tech-stat-value">{stats.totalSources.toLocaleString()}</div>
                <div className="tech-stat-label">
                  {t('label.source-systems', { defaultValue: 'Hệ thống nguồn' })}
                </div>
              </div>
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
