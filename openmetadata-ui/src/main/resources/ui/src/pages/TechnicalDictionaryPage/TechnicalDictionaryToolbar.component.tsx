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
  BulbOutlined,
  DownOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Popover, Select, Space } from 'antd';
import { MenuProps } from 'antd/lib/menu';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CDEFilterDropdown, {
  FilterOption,
} from '../../components/Glossary/GlossaryTermTab/CDEFilterDropdown.component';
import { Tag } from '../../generated/entity/classification/tag';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import {
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryFilters,
} from './technicalDictionary.interface';

const WORKFLOW_STATUSES = ['Draft', 'In Review', 'Rejected', 'Approved'];
const SOURCE_STATUSES = ['Available', 'Unavailable', 'Changed'];

type SecondaryFilterKey =
  | 'elementType'
  | 'generationType'
  | 'creationMethod'
  | 'timeliness'
  | 'systemOwnerIds';

interface TechnicalDictionaryToolbarProps {
  filters: TechnicalDictionaryFilters;
  options: TechnicalDictionaryOptions;
  capabilities: TechnicalDictionaryCapabilities;
  searchText: string;
  canImport: boolean;
  canBulk: boolean;
  canAddColumn: boolean;
  onAddColumn: () => void;
  onSearchText: (value: string) => void;
  onFilters: (patch: Partial<TechnicalDictionaryFilters>) => void;
  onExport: () => void;
  onImport: () => void;
  onBulk: () => void;
}

const tagOptions = (tags: Tag[]): FilterOption[] =>
  tags.map((tag) => ({
    value: tag.fullyQualifiedName as string,
    label: tag.displayName || tag.name,
  }));

// CDEFilterDropdown reports "all" when every option is checked; that is the
// same as not filtering.
const withoutAll = (values: string[]) => (values.includes('all') ? [] : values);

const TechnicalDictionaryToolbar = ({
  filters,
  options,
  capabilities,
  searchText,
  canImport,
  canBulk,
  canAddColumn,
  onAddColumn,
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

  const secondaryFilters: Array<{
    key: SecondaryFilterKey;
    testId: string;
    label: string;
    options: FilterOption[];
  }> = [
    {
      key: 'elementType',
      testId: 'technical-dictionary-filter-element-type',
      label: t('label.data-element-type'),
      options: tagOptions(options.elementTypes),
    },
    {
      key: 'generationType',
      testId: 'technical-dictionary-filter-generation-type',
      label: t('label.generation-type'),
      options: tagOptions(options.generationTypes),
    },
    {
      key: 'creationMethod',
      testId: 'technical-dictionary-filter-creation-method',
      label: t('label.creation-method'),
      options: tagOptions(options.creationMethods),
    },
    {
      key: 'timeliness',
      testId: 'technical-dictionary-filter-timeliness',
      label: t('label.timeliness'),
      options: tagOptions(options.timeliness),
    },
    {
      key: 'systemOwnerIds',
      testId: 'technical-dictionary-filter-system-owner',
      label: t('label.system-owner'),
      options: options.teams.map((team) => ({
        value: team.id,
        label: team.displayName || team.name,
      })),
    },
  ];

  const secondaryCount = secondaryFilters.filter(
    ({ key }) => filters[key].length > 0
  ).length;

  const secondaryContent = (
    <div className="tech-dict-more-filters">
      {secondaryFilters.map((filter) => (
        <div className="tech-dict-more-filters-item" key={filter.key}>
          <span className="tech-dict-more-filters-label">{filter.label}</span>
          <Select
            allowClear
            showSearch
            data-testid={filter.testId}
            getPopupContainer={(trigger) =>
              trigger.parentElement ?? document.body
            }
            maxTagCount="responsive"
            mode="multiple"
            optionFilterProp="label"
            options={filter.options}
            placeholder={t('label.all')}
            value={filters[filter.key]}
            onChange={(values: string[]) =>
              onFilters({
                [filter.key]: values,
              } as Partial<TechnicalDictionaryFilters>)
            }
          />
        </div>
      ))}
      <div className="tech-dict-more-filters-footer">
        <Button
          disabled={secondaryCount === 0}
          size="small"
          type="link"
          onClick={() =>
            onFilters({
              elementType: [],
              generationType: [],
              creationMethod: [],
              timeliness: [],
              systemOwnerIds: [],
            })
          }>
          {t('label.clear')}
        </Button>
      </div>
    </div>
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

  // Rendered as direct children of the table toolbar so the filters share one
  // row with the table's column customisation control.
  return (
    <>
      <Input
        allowClear
        data-testid="technical-dictionary-search"
        placeholder={t('label.search-technical-dictionary')}
        prefix={<SearchOutlined className="text-grey-muted" />}
        style={{ width: 280 }}
        value={searchText}
        onChange={(event) => onSearchText(event.target.value)}
      />
      <CDEFilterDropdown
        dataTestId="technical-dictionary-filter-status"
        label={t('label.status')}
        options={statusOptions}
        selectedValues={filters.statuses}
        onChange={(values) => onFilters({ statuses: withoutAll(values) })}
      />
      <CDEFilterDropdown
        dataTestId="technical-dictionary-filter-source"
        label={t('label.source')}
        options={options.services.map((service) => ({
          value: service,
          label: service,
        }))}
        selectedValues={filters.sourceServices}
        onChange={(values) => onFilters({ sourceServices: withoutAll(values) })}
      />
      <CDEFilterDropdown
        dataTestId="technical-dictionary-filter-cde"
        label={t('label.cde-code-ref')}
        options={[
          { value: 'MAPPED', label: t('label.cde-mapped') },
          { value: 'UNMAPPED', label: t('label.cde-unmapped') },
        ]}
        selectedValues={filters.cdeMapping}
        onChange={(values) => onFilters({ cdeMapping: withoutAll(values) })}
      />
      <CDEFilterDropdown
        dataTestId="technical-dictionary-filter-source-status"
        label={t('label.source-status')}
        options={SOURCE_STATUSES.map((status) => ({
          value: status,
          label: t(`label.source-status-${status.toLowerCase()}`),
        }))}
        selectedValues={filters.sourceStatuses}
        onChange={(values) => onFilters({ sourceStatuses: withoutAll(values) })}
      />
      <Popover
        content={secondaryContent}
        overlayClassName="tech-dict-more-filters-overlay"
        placement="bottomLeft"
        trigger="click">
        <Button
          className={classNames(
            'tech-dict-more-filters-button text-primary remove-button-background-hover',
            { active: secondaryCount > 0 }
          )}
          data-testid="technical-dictionary-more-filters"
          size="small"
          type="text">
          <Space size={4}>
            <span>{t('label.more-technical-filters')}</span>
            {secondaryCount > 0 && (
              <span className="font-semibold">({secondaryCount})</span>
            )}
            <DownOutlined />
          </Space>
        </Button>
      </Popover>
      <div className="tech-dict-toolbar-actions">
        {canAddColumn && (
          <Button
            data-testid="technical-dictionary-add-column"
            icon={<PlusOutlined />}
            type="primary"
            onClick={onAddColumn}>
            {t('label.add-column')}
          </Button>
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
            className="tech-dict-more-actions-button"
            data-testid="technical-dictionary-more-actions"
            icon={<MoreOutlined />}
          />
        </Dropdown>
      </div>
    </>
  );
};

export default TechnicalDictionaryToolbar;
