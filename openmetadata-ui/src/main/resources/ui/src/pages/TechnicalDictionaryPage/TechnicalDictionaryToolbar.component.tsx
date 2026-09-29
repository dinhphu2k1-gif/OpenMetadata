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
import { BulbOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Input, Select, Space, Switch } from 'antd';
import { MenuProps } from 'antd/lib/menu';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../generated/entity/classification/tag';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import {
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryFilters,
} from './technicalDictionary.interface';

const WORKFLOW_STATUSES = ['Draft', 'In Review', 'Rejected', 'Approved'];
const SOURCE_STATUSES = ['Available', 'Unavailable', 'Changed'];
const FILTER_WIDTH = 170;

interface TechnicalDictionaryToolbarProps {
  filters: TechnicalDictionaryFilters;
  options: TechnicalDictionaryOptions;
  capabilities: TechnicalDictionaryCapabilities;
  searchText: string;
  canImport: boolean;
  canBulk: boolean;
  onSearchText: (value: string) => void;
  onFilters: (patch: Partial<TechnicalDictionaryFilters>) => void;
  onExport: () => void;
  onImport: () => void;
  onBulk: () => void;
}

const tagOptions = (tags: Tag[]) =>
  tags.map((tag) => ({
    value: tag.fullyQualifiedName as string,
    label: tag.displayName || tag.name,
  }));

const TechnicalDictionaryToolbar = ({
  filters,
  options,
  capabilities,
  searchText,
  canImport,
  canBulk,
  onSearchText,
  onFilters,
  onExport,
  onImport,
  onBulk,
}: TechnicalDictionaryToolbarProps) => {
  const { t } = useTranslation();

  const statusOptions = useMemo(
    () =>
      (capabilities.canViewWorking ? WORKFLOW_STATUSES : ['Approved']).map(
        (status) => ({ value: status, label: status })
      ),
    [capabilities.canViewWorking]
  );

  const multi = (
    testId: string,
    placeholder: string,
    value: string[],
    selectOptions: Array<{ value: string; label: React.ReactNode }>,
    onChange: (values: string[]) => void
  ) => (
    <Select
      allowClear
      showSearch
      data-testid={testId}
      maxTagCount="responsive"
      mode="multiple"
      optionFilterProp="label"
      options={selectOptions}
      placeholder={placeholder}
      style={{ width: FILTER_WIDTH }}
      value={value}
      onChange={onChange}
    />
  );

  const menuItems: MenuProps['items'] = [
    { key: 'export', label: t('label.export'), onClick: onExport },
    ...(canImport
      ? [
          {
            key: 'import',
            label: t('label.import-cde-mapping'),
            onClick: onImport,
          },
        ]
      : []),
  ];

  return (
    <Space wrap className="tech-dict-toolbar" size={8}>
      <Input.Search
        allowClear
        data-testid="technical-dictionary-search"
        placeholder={t('label.search-technical-dictionary')}
        style={{ width: 280 }}
        value={searchText}
        onChange={(event) => onSearchText(event.target.value)}
      />
      {multi(
        'technical-dictionary-filter-status',
        t('label.status'),
        filters.statuses,
        statusOptions,
        (statuses) => onFilters({ statuses })
      )}
      {multi(
        'technical-dictionary-filter-source',
        t('label.source'),
        filters.sourceServices,
        options.services.map((service) => ({ value: service, label: service })),
        (sourceServices) => onFilters({ sourceServices })
      )}
      {multi(
        'technical-dictionary-filter-cde',
        t('label.cde-code-ref'),
        filters.cdeMapping,
        [
          { value: 'MAPPED', label: t('label.cde-mapped') },
          { value: 'UNMAPPED', label: t('label.cde-unmapped') },
        ],
        (cdeMapping) => onFilters({ cdeMapping })
      )}
      {multi(
        'technical-dictionary-filter-element-type',
        t('label.data-element-type'),
        filters.elementType,
        tagOptions(options.elementTypes),
        (elementType) => onFilters({ elementType })
      )}
      {multi(
        'technical-dictionary-filter-generation-type',
        t('label.generation-type'),
        filters.generationType,
        tagOptions(options.generationTypes),
        (generationType) => onFilters({ generationType })
      )}
      {multi(
        'technical-dictionary-filter-creation-method',
        t('label.creation-method'),
        filters.creationMethod,
        tagOptions(options.creationMethods),
        (creationMethod) => onFilters({ creationMethod })
      )}
      {multi(
        'technical-dictionary-filter-timeliness',
        t('label.timeliness'),
        filters.timeliness,
        tagOptions(options.timeliness),
        (timeliness) => onFilters({ timeliness })
      )}
      {multi(
        'technical-dictionary-filter-system-owner',
        t('label.system-owner'),
        filters.systemOwnerIds,
        options.teams.map((team) => ({
          value: team.id,
          label: team.displayName || team.name,
        })),
        (systemOwnerIds) => onFilters({ systemOwnerIds })
      )}
      {multi(
        'technical-dictionary-filter-source-status',
        t('label.source-status'),
        filters.sourceStatuses,
        SOURCE_STATUSES.map((status) => ({
          value: status,
          label: t(`label.source-status-${status.toLowerCase()}`),
        })),
        (sourceStatuses) => onFilters({ sourceStatuses })
      )}
      {capabilities.canViewWorking && (
        <Space size={4}>
          <Switch
            checked={filters.versionView === 'ALL'}
            data-testid="technical-dictionary-all-versions"
            size="small"
            onChange={(checked) =>
              onFilters({ versionView: checked ? 'ALL' : 'LATEST' })
            }
          />
          <span>{t('label.all-versions')}</span>
        </Space>
      )}
      {canBulk && (
        <Button
          data-testid="technical-dictionary-bulk"
          icon={<BulbOutlined />}
          onClick={onBulk}>
          {t('label.bulk-actions')}
        </Button>
      )}
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomRight"
        trigger={['click']}>
        <Button
          aria-label={t('label.more-actions')}
          data-testid="technical-dictionary-more-actions"
          icon={<MoreOutlined />}
        />
      </Dropdown>
    </Space>
  );
};

export default TechnicalDictionaryToolbar;
