/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { Button, Checkbox, Dropdown, MenuProps, Space } from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ALL_FILTER_VALUE = 'all';

export interface GovernanceListFilterOption {
  label: string;
  value: string;
}

export interface GovernanceListFilterDropdownProps {
  label: string;
  options: GovernanceListFilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  dataTestId?: string;
  className?: string;
}

const GovernanceListFilterDropdown: FC<
  GovernanceListFilterDropdownProps
> = ({ label, options, selectedValues, onChange, dataTestId, className }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const allOptionValues = useMemo(
    () => options.map((option) => option.value),
    [options]
  );
  const selectedWithAll = useCallback(
    (values: string[]) =>
      values.includes(ALL_FILTER_VALUE)
        ? [ALL_FILTER_VALUE, ...allOptionValues]
        : values,
    [allOptionValues]
  );
  const [tempSelected, setTempSelected] = useState<string[]>(() =>
    selectedWithAll(selectedValues)
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setTempSelected(selectedWithAll(selectedValues));
      }
      setIsOpen(open);
    },
    [selectedValues, selectedWithAll]
  );

  useEffect(() => {
    if (!isOpen) {
      setTempSelected(selectedWithAll(selectedValues));
    }
  }, [isOpen, selectedValues, selectedWithAll]);

  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      if (key === ALL_FILTER_VALUE) {
        setTempSelected(
          checked ? [ALL_FILTER_VALUE, ...allOptionValues] : []
        );

        return;
      }
      setTempSelected((previous) => {
        const next = checked
          ? [...previous, key]
          : previous.filter(
              (item) => item !== key && item !== ALL_FILTER_VALUE
            );
        const allChecked =
          allOptionValues.length > 0 &&
          allOptionValues.every((value) => next.includes(value));

        return allChecked
          ? [ALL_FILTER_VALUE, ...allOptionValues]
          : next.filter((item) => item !== ALL_FILTER_VALUE);
      });
    },
    [allOptionValues]
  );

  const handleSave = useCallback(() => {
    onChange(tempSelected);
    setIsOpen(false);
  }, [onChange, tempSelected]);

  const handleCancel = useCallback(() => {
    setTempSelected(selectedWithAll(selectedValues));
    setIsOpen(false);
  }, [selectedValues, selectedWithAll]);

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
                overflowX: options.length > 6 ? 'hidden' : undefined,
                overflowY: options.length > 6 ? 'auto' : undefined,
              }}
              onClick={(event) => event.stopPropagation()}>
              <Checkbox.Group
                className="glossary-col-sel-checkbox-group"
                value={tempSelected}>
                <div>
                  <Checkbox
                    className="custom-glossary-col-sel-checkbox"
                    value={ALL_FILTER_VALUE}
                    onChange={(event) =>
                      handleCheckboxChange(
                        ALL_FILTER_VALUE,
                        event.target.checked
                      )
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
                      onChange={(event) =>
                        handleCheckboxChange(
                          option.value,
                          event.target.checked
                        )
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
        { className: 'm-b-xs', key: 'divider', type: 'divider' as const },
        {
          key: 'actions',
          label: (
            <div
              className="flex-center"
              onClick={(event) => event.stopPropagation()}>
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
      handleCancel,
      handleCheckboxChange,
      handleSave,
      options,
      t,
      tempSelected,
    ]
  );
  const isFiltered =
    selectedValues.length > 0 &&
    !selectedValues.includes(ALL_FILTER_VALUE);
  const selectedDisplayLabel = useMemo(() => {
    if (!isFiltered) {
      return null;
    }
    if (selectedValues.length === 1) {
      const match = options.find(
        (option) => option.value === selectedValues[0]
      );

      return match?.label ?? selectedValues[0];
    }

    return `(${selectedValues.length})`;
  }, [isFiltered, options, selectedValues]);

  return (
    <Dropdown
      destroyPopupOnHide
      className={classNames(
        'custom-glossary-dropdown-menu status-dropdown cde-filter-dropdown',
        className,
        { active: isFiltered }
      )}
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

export default GovernanceListFilterDropdown;
