/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Popover, PopoverProps, Tag, Typography } from 'antd';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClassificationSelectPanel from '../../common/ClassificationSelect/ClassificationSelectPanel.component';
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
  /** Shown under the value, for a note that belongs to this field only. */
  footer?: ReactNode;
  label: string;
  options: CDEEnumOption[];
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
  footer,
  label,
  onChange,
  options,
  placement = 'bottomLeft',
  value,
  valueClassName = 'cde-value-pill-neutral',
  valueTestId,
}: CDEEnumFieldProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  const handleChange = async (selectedValue: string) => {
    await onChange(selectedValue);
    setIsEditing(false);
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
              <ClassificationSelectPanel
                dataTestId={editorTestId}
                mode="single"
                options={options}
                searchPlaceholder={t('label.search-for-type', { type: label })}
                value={value ? [value] : []}
                onCancel={() => setIsEditing(false)}
                onUpdate={([selected]) => selected && handleChange(selected)}
              />
            }
            open={isEditing}
            overlayClassName="classification-select-popover cde-enum-field-popover"
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
      {footer}
    </div>
  );
};

export default CDEEnumField;
