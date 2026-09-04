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
  ClockCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import { compare, Operation } from 'fast-json-patch';
import { debounce, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../constants/Glossary.contant';
import { Table } from '../../generated/entity/data/table';
import { LabelType, State, TagLabel, TagSource } from '../../generated/type/tagLabel';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getGlossariesByName, getGlossaryTerms } from '../../rest/glossaryAPI';
import { getTableDetailsByFQN, getTableList, patchTableDetails } from '../../rest/tableAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TechnicalDictionaryTable, {
  TechnicalFieldItem,
} from './TechnicalDictionaryTable.component';
import TechnicalDictionaryEditModal from './TechnicalDictionaryEditModal.component';
import './technicalDictionary.less';

const { Option } = Select;

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

export const TechnicalDictionaryPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, selectedPersona } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [technicalFields, setTechnicalFields] = useState<TechnicalFieldItem[]>([]);
  const [cdeOptions, setCdeOptions] = useState<
    Array<{ label: string; value: string; name: string }>
  >([]);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedElementType, setSelectedElementType] = useState<string>('ALL');
  const [selectedGenType, setSelectedGenType] = useState<string>('ALL');
  const [cdeFilter, setCdeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
      // 1. Fetch CDE Glossary terms to map CDE codes to business display names
      const cdeDisplayMap: Record<string, { name: string; fqn: string }> = {};
      try {
        const glossaryRes = await getGlossariesByName(DATA_DICTIONARY_GLOSSARY_NAME, {
          fields: 'id',
        });
        if (glossaryRes?.id) {
          const termsRes = await getGlossaryTerms({
            glossary: glossaryRes.id,
            limit: 1000,
          });
          (termsRes.data || []).forEach((term) => {
            if (term.name) {
              cdeDisplayMap[term.name.trim().toUpperCase()] = {
                name: term.displayName || term.name,
                fqn: term.fullyQualifiedName || '',
              };
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
        setTechnicalFields((prev) =>
          prev.map((f) =>
            f.id === updatedItem.id
              ? ({ ...f, ...updatedItem, status: 'In Review' } as TechnicalFieldItem)
              : f
          )
        );

        // Sync proposal to OpenMetadata backend so other users (Data Steward, Admin) can see In Review status immediately
        await syncColumnProposalToBackend({ ...updatedItem, status: 'In Review' });

        showSuccessToast(
          t('message.submit-approval-success', {
            defaultValue: 'Đã lưu và gửi yêu cầu phê duyệt thành công',
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

  // Search handler with debounce
  const handleSearchChange = useMemo(
    () =>
      debounce((val: string) => {
        setSearchText(val.trim().toLowerCase());
      }, 300),
    []
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

  // Filtered dataset
  const filteredData = useMemo(() => {
    return technicalFields.filter((item) => {
      // 1. Search text filter
      if (searchText) {
        const matchesDb = item.databaseName?.toLowerCase().includes(searchText);
        const matchesSchema = item.schemaName?.toLowerCase().includes(searchText);
        const matchesTable = item.tableName.toLowerCase().includes(searchText);
        const matchesCol = item.columnName.toLowerCase().includes(searchText);
        const matchesCde = item.cdeCode?.toLowerCase().includes(searchText);
        const matchesCdeName = item.cdeName?.toLowerCase().includes(searchText);
        const matchesType = item.dataTypeDisplay.toLowerCase().includes(searchText);
        const matchesDesc = item.description?.toLowerCase().includes(searchText);

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
      if (selectedSource !== 'ALL' && item.serviceName !== selectedSource) {
        return false;
      }

      // 3. Element Type filter
      if (selectedElementType !== 'ALL') {
        if (selectedElementType === 'AtomicDataElement') {
          if (!item.elementType?.includes('Atomic') && !item.elementType?.includes('Nguyên')) {
            return false;
          }
        } else if (selectedElementType === 'TransformedDataElement') {
          if (!item.elementType?.includes('Transformed') && !item.elementType?.includes('Chuyển')) {
            return false;
          }
        }
      }

      // 4. Generation Type filter
      if (selectedGenType !== 'ALL') {
        if (!item.generationType?.includes(selectedGenType)) {
          return false;
        }
      }

      // 5. CDE mapping filter
      if (cdeFilter === 'MAPPED' && !item.cdeCode) {
        return false;
      }
      if (cdeFilter === 'UNMAPPED' && item.cdeCode) {
        return false;
      }

      // 6. Status filter
      if (!userRoleInfo.canViewAllStatus) {
        // Data Consumer: only view Approved items
        const itemStatus = (item.status || 'Approved').trim();
        if (itemStatus !== 'Approved') {
          return false;
        }
      } else if (statusFilter !== 'ALL') {
        const itemStatus = (item.status || 'Approved').trim();
        if (statusFilter === 'In Review') {
          if (
            itemStatus !== 'In Review' &&
            itemStatus !== 'InReview' &&
            itemStatus !== 'Pending'
          ) {
            return false;
          }
        } else if (itemStatus !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    technicalFields,
    searchText,
    selectedSource,
    selectedElementType,
    selectedGenType,
    cdeFilter,
    statusFilter,
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
      'Tên Bảng',
      'Tên Trường',
      'Hệ thống nguồn',
      'Mã CDE quy chiếu',
      'Tên thành tố CDE',
      'Kiểu dữ liệu',
      'Độ dài',
      'Số thập phân',
      'Loại thành tố',
      'Loại trường dữ liệu',
      'Phương thức tạo',
      'Thời gian sẵn sàng',
      'Chủ sở hữu hệ thống',
      'Mô tả trường',
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
  }, [filteredData]);

  return (
    <div className="tech-dict-page-container">
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
              <div className="tech-stat-label">Tổng Cột kỹ thuật</div>
            </div>
          </div>

          <div className="tech-stat-card">
            <div className="tech-stat-icon blue">
              <TableOutlined />
            </div>
            <div className="tech-stat-info">
              <div className="tech-stat-value">{stats.totalTables.toLocaleString()}</div>
              <div className="tech-stat-label">Bảng dữ liệu</div>
            </div>
          </div>

          <div className="tech-stat-card">
            <div className="tech-stat-icon green">
              <CheckCircleOutlined />
            </div>
            <div className="tech-stat-info">
              <div className="tech-stat-value">{stats.totalMapped.toLocaleString()}</div>
              <div className="tech-stat-label">Đã quy chiếu CDE</div>
            </div>
          </div>

          <div className="tech-stat-card">
            <div className="tech-stat-icon purple">
              <DatabaseOutlined />
            </div>
            <div className="tech-stat-info">
              <div className="tech-stat-value">{stats.totalSources.toLocaleString()}</div>
              <div className="tech-stat-label">Hệ thống nguồn</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="tech-dict-content-card">
        {/* Toolbar */}
        <div className="tech-dict-toolbar">
          <div className="tech-dict-search-group">
            <Input.Search
              allowClear
              className="tech-search-input"
              placeholder={t('label.search-table-column-cde', {
                defaultValue: 'Tìm kiếm tên bảng, cột, mã CDE, kiểu DL...',
              })}
              onChange={(e) => handleSearchChange(e.target.value)}
            />

            <Select
              className="tech-filter-select"
              defaultValue="ALL"
              value={selectedSource}
              onChange={setSelectedSource}>
              <Option value="ALL">Nguồn: Tất cả ({sourceOptions.length})</Option>
              {sourceOptions.map((src) => (
                <Option key={src} value={src}>
                  {src}
                </Option>
              ))}
            </Select>

            <Select
              className="tech-filter-select"
              defaultValue="ALL"
              value={selectedElementType}
              onChange={setSelectedElementType}>
              <Option value="ALL">Loại thành tố: Tất cả</Option>
              <Option value="AtomicDataElement">Dữ liệu nguyên tố</Option>
              <Option value="TransformedDataElement">Dữ liệu chuyển đổi</Option>
            </Select>

            <Select
              className="tech-filter-select"
              defaultValue="ALL"
              value={selectedGenType}
              onChange={setSelectedGenType}>
              <Option value="ALL">Loại trường: Tất cả</Option>
              <Option value="SystemGenerated">Hệ thống tự sinh</Option>
              <Option value="SystemDerived">Hệ thống tính toán</Option>
              <Option value="ManualInput">Nhập thủ công</Option>
              <Option value="FileUpload">Tải lên</Option>
            </Select>

            <Select
              className="tech-filter-select"
              defaultValue="ALL"
              value={cdeFilter}
              onChange={setCdeFilter}>
              <Option value="ALL">Quy chiếu CDE: Tất cả</Option>
              <Option value="MAPPED">Đã map CDE</Option>
              <Option value="UNMAPPED">Chưa map CDE</Option>
            </Select>

            {userRoleInfo.canViewAllStatus && (
              <Select
                className="tech-filter-select"
                defaultValue="ALL"
                value={statusFilter}
                onChange={setStatusFilter}>
                <Option value="ALL">Trạng thái: Tất cả</Option>
                <Option value="Approved">🟢 Đã phê duyệt (Approved)</Option>
                <Option value="In Review">🟡 Chờ phê duyệt (In Review)</Option>
                <Option value="Draft">⚪ Bản nháp (Draft)</Option>
                <Option value="Rejected">🔴 Bị từ chối (Rejected)</Option>
              </Select>
            )}
          </div>

          <div className="tech-dict-actions-group">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}>
              {t('label.export-csv', { defaultValue: 'Xuất CSV' })}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTechnicalMetadata}
            />
          </div>
        </div>

        {/* Matrix Table */}
        <TechnicalDictionaryTable
          canApprove={userRoleInfo.canApprove}
          canEdit={userRoleInfo.canEdit}
          canReject={userRoleInfo.canReject}
          canRevoke={userRoleInfo.canRevoke}
          data={filteredData}
          isLoading={isLoading}
          onApprove={handleApproveField}
          onEdit={handleEditField}
          onRefresh={fetchTechnicalMetadata}
          onReject={handleRejectField}
          onRevoke={handleRevokeField}
        />
      </div>

      {/* Edit Technical Field Modal */}
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
    </div>
  );
};

export default TechnicalDictionaryPage;
