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
import { CheckOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import './classification-select.less';
import {
  ClassificationOption,
  ClassificationSelectPanelProps,
} from './ClassificationSelect.interface';

const OptionLabel = ({ label }: { label: string }) => (
  <span className="classification-select-option">
    <ClassificationIcon
      className="classification-select-option-icon"
      height={16}
      width={16}
    />
    <span className="classification-select-option-name">{label}</span>
  </span>
);

/**
 * Search + option list + Clear/Cancel/Update footer shown inside the
 * classification popover. It stages the pick locally and only reports it
 * through `onUpdate`; mount it fresh each time the popover opens.
 */
const ClassificationSelectPanel = ({
  mode = 'single',
  options,
  value = [],
  searchPlaceholder,
  dataTestId,
  onCancel,
  onUpdate,
}: ClassificationSelectPanelProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      options.findIndex((option) => value.includes(option.value)),
      0
    )
  );
  const [draft, setDraft] = useState<string[]>(value);
  const isMultiple = mode === 'multiple';

  const visibleOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, search]);

  const handlePick = (option: ClassificationOption) => {
    if (isMultiple) {
      setDraft((current) =>
        current.includes(option.value)
          ? current.filter((selected) => selected !== option.value)
          : [...current, option.value]
      );
    } else {
      setDraft([option.value]);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const lastIndex = visibleOptions.length - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, lastIndex));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && visibleOptions[activeIndex]) {
      event.preventDefault();
      handlePick(visibleOptions[activeIndex]);
    }
  };

  return (
    <div className="classification-select-panel" data-testid={dataTestId}>
      <Searchbar
        removeMargin
        containerClassName="classification-select-search"
        inputProps={{ autoFocus: true, onKeyDown: handleKeyDown }}
        placeholder={searchPlaceholder}
        searchBarDataTestId={dataTestId && `${dataTestId}-search`}
        searchValue={search}
        typingInterval={0}
        onSearch={(text) => {
          setSearch(text);
          setActiveIndex(0);
        }}
      />
      <div
        aria-multiselectable={isMultiple}
        className="classification-select-list"
        role="listbox">
        {visibleOptions.length ? (
          visibleOptions.map((option, index) => {
            const isSelected = draft.includes(option.value);

            return (
              <div
                aria-selected={isSelected}
                className={classNames('classification-select-item', {
                  active: index === activeIndex,
                  selected: isSelected,
                })}
                data-testid={`classification-option-${option.value}`}
                key={option.value}
                role="option"
                title={option.label}
                onClick={() => handlePick(option)}
                onMouseEnter={() => setActiveIndex(index)}>
                <OptionLabel label={option.label} />
                <CheckOutlined className="classification-select-check" />
              </div>
            );
          })
        ) : (
          <div className="classification-select-empty">
            {t('message.no-match-found')}
          </div>
        )}
      </div>
      <div className="classification-select-footer">
        <Button
          className="p-0"
          color="primary"
          data-testid={dataTestId && `${dataTestId}-clear`}
          size="small"
          type="text"
          onClick={() => setDraft([])}>
          {t('label.clear-entity', { entity: t('label.all-lowercase') })}
        </Button>
        <Space className="m-l-auto text-right">
          <Button
            color="primary"
            data-testid={dataTestId && `${dataTestId}-cancel`}
            size="small"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid={dataTestId && `${dataTestId}-update`}
            size="small"
            type="primary"
            onClick={() => onUpdate(draft)}>
            {t('label.update')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ClassificationSelectPanel;
