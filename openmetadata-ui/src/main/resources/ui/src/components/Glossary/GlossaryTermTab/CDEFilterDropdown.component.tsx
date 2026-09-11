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

import { DownOutlined } from '@ant-design/icons';
import { Button, Checkbox, Dropdown, MenuProps, Space } from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterOption {
  label: string;
  value: string;
}

interface CDEFilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  dataTestId?: string;
  className?: string;
}

export const CDEFilterDropdown: FC<CDEFilterDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  dataTestId,
  className,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const allOptionValues = useMemo(
    () => options.map((opt) => opt.value),
    [options]
  );

  const [tempSelected, setTempSelected] = useState<string[]>(() =>
    selectedValues.includes('all')
      ? ['all', ...allOptionValues]
      : selectedValues
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        if (selectedValues.includes('all')) {
          setTempSelected(['all', ...allOptionValues]);
        } else {
          setTempSelected(selectedValues);
        }
      }
      setIsOpen(open);
    },
    [selectedValues, allOptionValues]
  );

  // Sync temp selection when external selectedValues change while closed
  useEffect(() => {
    if (!isOpen) {
      if (selectedValues.includes('all')) {
        setTempSelected(['all', ...allOptionValues]);
      } else {
        setTempSelected(selectedValues);
      }
    }
  }, [isOpen, selectedValues, allOptionValues]);

  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      if (key === 'all') {
        if (checked) {
          setTempSelected(['all', ...allOptionValues]);
        } else {
          setTempSelected([]);
        }
      } else {
        setTempSelected((prev) => {
          const next = checked
            ? [...prev, key]
            : prev.filter((item) => item !== key && item !== 'all');

          const allChecked =
            allOptionValues.length > 0 &&
            allOptionValues.every((val) => next.includes(val));

          if (allChecked) {
            return ['all', ...allOptionValues];
          }

          return next.filter((item) => item !== 'all');
        });
      }
    },
    [allOptionValues]
  );

  const handleSave = () => {
    onChange(tempSelected);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (selectedValues.includes('all')) {
      setTempSelected(['all', ...allOptionValues]);
    } else {
      setTempSelected(selectedValues);
    }
    setIsOpen(false);
  };

  const menu: MenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'selection',
          label: (
            <div
              className="status-selection-dropdown cde-filter-options-scroll"
              style={{
                maxHeight: options.length > 6 ? 200 : undefined,
                overflowY: options.length > 6 ? 'auto' : undefined,
                overflowX: options.length > 6 ? 'hidden' : undefined,
              }}
              onClick={(e) => e.stopPropagation()}>
              <Checkbox.Group
                className="glossary-col-sel-checkbox-group"
                value={tempSelected}>
                <div>
                  <Checkbox
                    className="custom-glossary-col-sel-checkbox"
                    value="all"
                    onChange={(e) =>
                      handleCheckboxChange('all', e.target.checked)
                    }>
                    <p className="glossary-dropdown-label font-medium">
                      {t('label.all')}
                    </p>
                  </Checkbox>
                </div>
                {options.map((option) => (
                  <div key={option.value}>
                    <Checkbox
                      className="custom-glossary-col-sel-checkbox"
                      value={option.value}
                      onChange={(e) =>
                        handleCheckboxChange(option.value, e.target.checked)
                      }>
                      <p
                        className="glossary-dropdown-label"
                        title={option.label}>
                        {option.label}
                      </p>
                    </Checkbox>
                  </div>
                ))}
              </Checkbox.Group>
            </div>
          ),
        },
        {
          key: 'divider',
          type: 'divider' as const,
          className: 'm-b-xs',
        },
        {
          key: 'actions',
          label: (
            <div
              className="flex-center"
              onClick={(e) => e.stopPropagation()}>
              <Space size={8}>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  size="small"
                  type="primary"
                  onClick={handleSave}>
                  {t('label.save')}
                </Button>
                <Button
                  className="custom-glossary-dropdown-action-btn"
                  size="small"
                  type="default"
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>
              </Space>
            </div>
          ),
        },
      ],
    }),
    [
      options,
      tempSelected,
      t,
      handleCheckboxChange,
      handleSave,
      handleCancel,
    ]
  );

  const isFiltered = useMemo(
    () => selectedValues.length > 0 && !selectedValues.includes('all'),
    [selectedValues]
  );

  const selectedDisplayLabel = useMemo(() => {
    if (!isFiltered) {
      return null;
    }
    if (selectedValues.length === 1) {
      const match = options.find((opt) => opt.value === selectedValues[0]);

      return match?.label ?? selectedValues[0];
    }

    return `(${selectedValues.length})`;
  }, [isFiltered, selectedValues, options]);

  return (
    <Dropdown
      className={classNames(
        'custom-glossary-dropdown-menu status-dropdown cde-filter-dropdown',
        className,
        { active: isFiltered }
      )}
      destroyPopupOnHide
      menu={menu}
      open={isOpen}
      overlayClassName="custom-glossary-dropdown-menu status-dropdown cde-filter-dropdown-overlay"
      transitionName=""
      trigger={['click']}
      onOpenChange={handleOpenChange}>
      <Button
        className={classNames('text-primary remove-button-background-hover', {
          active: isFiltered,
        })}
        data-testid={dataTestId}
        size="small"
        type="text">
        <Space size={4}>
          <span>{label}</span>
          {isFiltered && (
            <span>
              {': '}
              <span className="font-semibold">{selectedDisplayLabel}</span>
            </span>
          )}
          <DownOutlined />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default CDEFilterDropdown;
