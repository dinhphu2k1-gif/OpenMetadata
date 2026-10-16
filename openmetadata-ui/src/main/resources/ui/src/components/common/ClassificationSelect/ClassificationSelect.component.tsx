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
import { Popover, Tag } from 'antd';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { CDEFormSelectTrigger } from '../../Glossary/AddGlossaryTermForm/CDEFormSelectTrigger.component';
import './classification-select.less';
import { ClassificationSelectProps } from './ClassificationSelect.interface';
import ClassificationSelectPanel from './ClassificationSelectPanel.component';

const MAX_VISIBLE_PILLS = 2;

const fallbackLabel = (value: string) =>
  value.split('.').at(-1)?.replaceAll('_', ' ') ?? value;

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
  const [isOpen, setIsOpen] = useState(false);

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
    if (!disabled) {
      setIsOpen(open);
    }
  };

  const handleUpdate = (selected: string[]) => {
    onChange?.(selected);
    setIsOpen(false);
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
    <ClassificationSelectPanel
      dataTestId={dataTestId}
      mode={mode}
      options={options}
      searchPlaceholder={searchPlaceholder}
      value={value}
      onCancel={() => setIsOpen(false)}
      onUpdate={handleUpdate}
    />
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
