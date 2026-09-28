/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Alert, Select, Space, Tag, Typography } from 'antd';
import { debounce } from 'lodash';
import {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import {
  EntityStatus as GlossaryStatus,
  Glossary,
} from '../../../generated/entity/data/glossary';
import {
  EntityStatus as TermStatus,
  EntityVersionContext,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import {
  getGlossariesByName,
  getGlossaryVersion,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { compareBusinessVersions } from '../../../utils/BusinessVersionUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';

const NO_ACTIVE_DICTIONARY_MESSAGE =
  'Chưa có phiên bản Data Dictionary được phê duyệt trong cùng scope.';

interface CDESelectorProps {
  disabled?: boolean;
  parentBusinessVersion?: string;
  selectedCde?: GlossaryTerm;
  selectedVersionContext?: EntityVersionContext;
  value?: string;
  width?: number | string;
  onChange: (value?: string, cde?: GlossaryTerm) => void;
}

const isApprovedDictionaryVersionForScope = (
  snapshot: Glossary | undefined,
  parentBusinessVersion?: string
) =>
  snapshot?.businessVersion === parentBusinessVersion &&
  (snapshot.entityStatus === GlossaryStatus.Approved ||
    snapshot.entityStatus === GlossaryStatus.Archived);

const getCdeVersionKey = (
  cde: Pick<
    GlossaryTerm,
    'id' | 'snapshotId' | 'parentBusinessVersion' | 'businessVersion'
  >
) =>
  cde.snapshotId ??
  `${cde.id}:${cde.parentBusinessVersion ?? ''}:${cde.businessVersion ?? ''}`;

const getSelectableCdeVersions = (
  terms: GlossaryTerm[],
  includeArchived = false
) => {
  const identities = new Set<string>();

  return [...terms]
    .filter(
      (term) =>
        term.id &&
        (term.entityStatus === TermStatus.Approved ||
          (includeArchived && term.entityStatus === TermStatus.Archived)) &&
        (includeArchived || !term.archivedAt) &&
        !term.deleted
    )
    .sort((left, right) => {
      const codeComparison = left.name.localeCompare(right.name);

      return codeComparison !== 0
        ? codeComparison
        : compareBusinessVersions(
            right.businessVersion ?? '0',
            left.businessVersion ?? '0'
          );
    })
    .filter((term) => {
      const key = term.id ?? getCdeVersionKey(term);
      if (identities.has(key)) {
        return false;
      }
      identities.add(key);

      return true;
    });
};

const CDEOptionLabel = ({
  cde,
  archived = false,
}: {
  cde: GlossaryTerm;
  archived?: boolean;
}) => (
  <Space size={6}>
    <Typography.Text strong>{cde.name}</Typography.Text>
    <Typography.Text type="secondary">· {getEntityName(cde)}</Typography.Text>
    {(cde.businessVersion || cde.parentBusinessVersion) && (
      <Typography.Text type="secondary">
        v{cde.businessVersion ?? cde.parentBusinessVersion}
      </Typography.Text>
    )}
    {archived && <Tag>Archived</Tag>}
  </Space>
);

const CDESelector: FC<CDESelectorProps> = ({
  disabled,
  onChange,
  parentBusinessVersion,
  selectedCde,
  selectedVersionContext,
  value,
  width = '100%',
}) => {
  const [activeDictionary, setActiveDictionary] = useState<Glossary>();
  const [options, setOptions] = useState<GlossaryTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDictionaryResolved, setIsDictionaryResolved] = useState(false);
  const [error, setError] = useState(false);
  const requestSequence = useRef(0);
  const isArchivedScope = Boolean(
    activeDictionary?.entityStatus === GlossaryStatus.Archived ||
      activeDictionary?.archivedAt
  );

  const fetchOptions = useCallback(
    async (query = '') => {
      if (!activeDictionary?.id || !activeDictionary.businessVersion) {
        return;
      }
      const requestId = ++requestSequence.current;
      setIsLoading(true);
      setError(false);
      try {
        const response = await searchGlossaryTermsPaginated({
          glossary: activeDictionary.id,
          parentBusinessVersion: activeDictionary.businessVersion,
          statuses: isArchivedScope ? TermStatus.Archived : TermStatus.Approved,
          q: query.trim() || undefined,
          limit: 50,
        });
        if (requestId === requestSequence.current) {
          setOptions(
            getSelectableCdeVersions(response.data ?? [], isArchivedScope)
          );
        }
      } catch {
        if (requestId === requestSequence.current) {
          setOptions([]);
          setError(true);
        }
      } finally {
        if (requestId === requestSequence.current) {
          setIsLoading(false);
        }
      }
    },
    [activeDictionary?.businessVersion, activeDictionary?.id, isArchivedScope]
  );

  const debouncedSearch = useCallback(debounce(fetchOptions, 350), [
    fetchOptions,
  ]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    let mounted = true;
    const loadDictionary = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const dictionary = await getGlossariesByName(
          DATA_DICTIONARY_GLOSSARY_NAME
        );
        const snapshot = parentBusinessVersion
          ? await getGlossaryVersion(dictionary.id, parentBusinessVersion)
          : undefined;
        if (mounted) {
          setActiveDictionary(
            isApprovedDictionaryVersionForScope(snapshot, parentBusinessVersion)
              ? snapshot
              : undefined
          );
          setIsDictionaryResolved(true);
        }
      } catch {
        if (mounted) {
          setActiveDictionary(undefined);
          setIsDictionaryResolved(true);
          setError(true);
          setIsLoading(false);
        }
      }
    };
    loadDictionary();

    return () => {
      mounted = false;
      requestSequence.current += 1;
    };
  }, [parentBusinessVersion]);

  useEffect(() => {
    if (activeDictionary) {
      fetchOptions();
    } else if (isDictionaryResolved && !error) {
      setIsLoading(false);
    }
  }, [activeDictionary, error, fetchOptions, isDictionaryResolved]);

  const selectedIsHistorical = Boolean(
    selectedCde?.id &&
      ((selectedCde.entityStatus &&
        selectedCde.entityStatus !== TermStatus.Approved &&
        !isArchivedScope) ||
        (Boolean(selectedCde.archivedAt) && !isArchivedScope) ||
        (selectedVersionContext?.parentBusinessVersion &&
          selectedVersionContext.parentBusinessVersion !==
            activeDictionary?.businessVersion))
  );
  const selectedKey = selectedCde
    ? selectedVersionContext?.snapshotId ??
      getCdeVersionKey({
        ...selectedCde,
        businessVersion:
          selectedVersionContext?.businessVersion ??
          selectedCde.businessVersion,
        parentBusinessVersion:
          selectedVersionContext?.parentBusinessVersion ??
          selectedCde.parentBusinessVersion,
      })
    : undefined;
  const selectedIsMissing = Boolean(
    selectedKey &&
      !options.some((item) => getCdeVersionKey(item) === selectedKey)
  );
  const selectedOption = selectedCde
    ? {
        ...selectedCde,
        snapshotId:
          selectedVersionContext?.snapshotId ?? selectedCde.snapshotId,
        businessVersion:
          selectedVersionContext?.businessVersion ??
          selectedCde.businessVersion,
        parentBusinessVersion:
          selectedVersionContext?.parentBusinessVersion ??
          selectedCde.parentBusinessVersion,
      }
    : undefined;

  const availableOptions =
    selectedIsMissing && selectedOption
      ? [selectedOption, ...options]
      : options;
  const dropdownRender = (menu: ReactElement) => (
    <div className="cde-selector-dropdown">
      {activeDictionary && (
        <div className="p-x-sm p-y-xs text-grey-muted">
          Data Dictionary:{' '}
          {activeDictionary.displayName ?? activeDictionary.name}
          {' · '}v{activeDictionary.businessVersion} ·{' '}
          {isArchivedScope ? 'Approved (Archived scope)' : 'Approved'}
        </div>
      )}
      {menu}
      {error && (
        <Alert showIcon message="Không thể tải danh sách CDE." type="error" />
      )}
    </div>
  );

  return (
    <Space direction="vertical" size={4} style={{ width }}>
      <Select
        allowClear
        showSearch
        data-testid="dq-cde-select"
        disabled={disabled || (isDictionaryResolved && !activeDictionary)}
        dropdownRender={dropdownRender}
        filterOption={false}
        loading={isLoading}
        notFoundContent={
          error
            ? 'Không thể tải danh sách CDE.'
            : activeDictionary
            ? 'Không tìm thấy CDE phù hợp.'
            : NO_ACTIVE_DICTIONARY_MESSAGE
        }
        options={availableOptions.map((cde) => {
          const key = getCdeVersionKey(cde);
          const archived = key === selectedKey && selectedIsHistorical;

          return {
            disabled: archived,
            label: <CDEOptionLabel archived={archived} cde={cde} />,
            value: key,
          };
        })}
        placeholder="Tìm theo mã hoặc tên CDE"
        style={{ width: '100%' }}
        value={value ?? selectedKey}
        onChange={(key?: string) =>
          onChange(
            key,
            availableOptions.find((cde) => getCdeVersionKey(cde) === key)
          )
        }
        onSearch={debouncedSearch}
      />
      {isDictionaryResolved && !activeDictionary && !error && (
        <Alert showIcon message={NO_ACTIVE_DICTIONARY_MESSAGE} type="warning" />
      )}
    </Space>
  );
};

export default CDESelector;
export {
  NO_ACTIVE_DICTIONARY_MESSAGE,
  getCdeVersionKey,
  getSelectableCdeVersions,
  isApprovedDictionaryVersionForScope,
};
