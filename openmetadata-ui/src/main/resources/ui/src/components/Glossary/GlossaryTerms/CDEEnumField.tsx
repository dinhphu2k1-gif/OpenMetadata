/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Popover, PopoverProps, Select, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';

interface CDEEnumOption {
  label: string;
  value: string;
}

interface CDEEnumFieldProps {
  canEdit: boolean;
  className?: string;
  editorTestId?: string;
  fieldTestId?: string;
  label: string;
  options: CDEEnumOption[];
  placeholder: string;
  placement?: PopoverProps['placement'];
  value?: string;
  valueClassName?: string;
  valueTestId?: string;
  onChange: (value: string) => Promise<void> | void;
}

const CDEEnumField = ({
  canEdit,
  className,
  editorTestId,
  fieldTestId,
  label,
  onChange,
  options,
  placeholder,
  placement = 'bottomLeft',
  value,
  valueClassName = 'cde-value-pill-neutral',
  valueTestId,
}: CDEEnumFieldProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const selectPlacement = placement?.startsWith('top')
    ? 'topRight'
    : 'bottomLeft';

  const handleChange = async (selectedValue: string) => {
    setIsSaving(true);
    try {
      await onChange(selectedValue);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      aria-label={label}
      className={`cde-detail-field ${className ?? ''}`}
      data-testid={fieldTestId}
      role="group">
      <div className="cde-detail-field-label d-flex items-center gap-2">
        <Typography.Text className="text-sm font-medium">
          {label}
        </Typography.Text>
        {canEdit && (
          <Popover
            autoAdjustOverflow
            destroyTooltipOnHide
            content={
              <Select
                className="cde-enum-field-editor"
                data-testid={editorTestId}
                dropdownClassName="cde-enum-field-dropdown"
                getPopupContainer={() => document.body}
                loading={isSaving}
                options={options}
                placement={selectPlacement}
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
              />
            }
            getPopupContainer={() => document.body}
            open={isEditing}
            overlayClassName="cde-enum-field-popover"
            placement={placement}
            trigger="click"
            onOpenChange={setIsEditing}>
            <EditIconButton
              size="small"
              title={t('label.edit-entity', { entity: label })}
            />
          </Popover>
        )}
      </div>
      <div className="cde-detail-field-value">
        {selectedLabel ? (
          <Tag
            className={`cde-value-pill ${valueClassName}`}
            data-testid={valueTestId}>
            {selectedLabel}
          </Tag>
        ) : (
          <Typography.Text
            className="text-grey-muted"
            data-testid={valueTestId}>
            {t('cde.not-set')}
          </Typography.Text>
        )}
      </div>
    </div>
  );
};

export default CDEEnumField;
