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
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import CDEFilterDropdown, {
  FilterOption,
} from '../../components/Glossary/GlossaryTermTab/CDEFilterDropdown.component';
import { Tag } from '../../generated/entity/classification/tag';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { TechnicalDictionaryFilters } from './technicalDictionary.interface';

type ColumnFilterKey =
  | 'elementType'
  | 'generationType'
  | 'creationMethod'
  | 'timeliness';

interface TechnicalDictionaryToolbarProps {
  filters: TechnicalDictionaryFilters;
  options: TechnicalDictionaryOptions;
  searchText: string;
  canAddColumn: boolean;
  onAddColumn: () => void;
  onSearchText: (value: string) => void;
  onFilters: (patch: Partial<TechnicalDictionaryFilters>) => void;
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
  searchText,
  canAddColumn,
  onAddColumn,
  onSearchText,
  onFilters,
}: TechnicalDictionaryToolbarProps) => {
  const { t } = useTranslation();

  const columnFilters: Array<{
    key: ColumnFilterKey;
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
        dataTestId="technical-dictionary-filter-source"
        label={t('label.source')}
        options={options.services.map((service) => ({
          value: service,
          label: service,
        }))}
        selectedValues={filters.sourceServices}
        onChange={(values) => onFilters({ sourceServices: withoutAll(values) })}
      />
      {columnFilters.map((filter) => (
        <CDEFilterDropdown
          dataTestId={filter.testId}
          key={filter.key}
          label={filter.label}
          options={filter.options}
          selectedValues={filters[filter.key]}
          onChange={(values) =>
            onFilters({
              [filter.key]: withoutAll(values),
            } as Partial<TechnicalDictionaryFilters>)
          }
        />
      ))}
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
      </div>
    </>
  );
};

export default TechnicalDictionaryToolbar;
