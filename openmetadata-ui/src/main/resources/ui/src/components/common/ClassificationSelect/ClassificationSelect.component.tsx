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
import { Button, Popover, Space, Tag } from 'antd';
import classNames from 'classnames';
import { KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { CDEFormSelectTrigger } from '../../Glossary/AddGlossaryTermForm/CDEFormSelectTrigger.component';
import Searchbar from '../SearchBarComponent/SearchBar.component';
import './classification-select.less';
import {
  ClassificationOption,
  ClassificationSelectProps,
} from './ClassificationSelect.interface';

const MAX_VISIBLE_PILLS = 2;

const fallbackLabel = (value: string) =>
  value.split('.').at(-1)?.replaceAll('_', ' ') ?? value;

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
 * Dropdown for picking classification tags, shared by every form that needs
 * one. Single and multiple selection render identically and both stage the
 * pick until Update; they differ only in that a single pick replaces the
 * staged value while a multiple pick toggles it.
 */
const ClassificationSelect = ({
  mode = 'single',
  options,
  value = [],
  onChange,
  placeholder,
  searchPlaceholder,
  variant = 'neutral',
  loading = false,
  disabled = false,
  dataTestId,
}: ClassificationSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [draft, setDraft] = useState<string[]>([]);
  const isMultiple = mode === 'multiple';

  const visibleOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, search]);

  const selectedPills = useMemo(
    () =>
      value.map((selected) => {
        const option = options.find((item) => item.value === selected);

        return {
          value: selected,
          label: option?.label ?? fallbackLabel(selected),
          variant: option?.variant ?? variant,
        };
      }),
    [options, value, variant]
  );

  const handleOpenChange = (open: boolean) => {
    if (disabled) {
      return;
    }
    setIsOpen(open);
    if (open) {
      setSearch('');
      setDraft(value);
      setActiveIndex(
        Math.max(
          options.findIndex((option) => value.includes(option.value)),
          0
        )
      );
    }
  };

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

  const handleUpdate = () => {
    onChange?.(draft);
    setIsOpen(false);
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

  const triggerContent = value.length ? (
    <span className="classification-select-pills">
      {selectedPills.slice(0, MAX_VISIBLE_PILLS).map((pill) => (
        <Tag
          className={classNames(
            'cde-value-pill',
            `cde-value-pill-${pill.variant}`
          )}
          key={pill.value}>
          {pill.label}
        </Tag>
      ))}
      {value.length > MAX_VISIBLE_PILLS && (
        <Tag className="cde-value-pill cde-value-pill-neutral">
          +{value.length - MAX_VISIBLE_PILLS}
        </Tag>
      )}
    </span>
  ) : undefined;

  const content = (
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
            onClick={() => setIsOpen(false)}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid={dataTestId && `${dataTestId}-update`}
            size="small"
            type="primary"
            onClick={handleUpdate}>
            {t('label.update')}
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <Popover
      destroyTooltipOnHide
      content={content}
      open={isOpen && !disabled}
      overlayClassName="classification-select-popover"
      placement="bottomLeft"
      showArrow={false}
      trigger="click"
      onOpenChange={handleOpenChange}>
      <CDEFormSelectTrigger
        aria-busy={loading}
        aria-disabled={disabled}
        aria-expanded={isOpen}
        className={classNames({
          'classification-select-trigger--disabled': disabled,
        })}
        content={triggerContent}
        placeholder={placeholder}
      />
    </Popover>
  );
};

export default ClassificationSelect;
