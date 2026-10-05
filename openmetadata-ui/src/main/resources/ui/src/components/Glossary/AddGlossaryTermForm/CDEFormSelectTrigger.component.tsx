/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export type CDEFormSelectTriggerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'content'
> & {
  content?: ReactNode;
  placeholder: string;
  values?: string[];
};

export const CDEFormSelectTrigger = forwardRef<
  HTMLDivElement,
  CDEFormSelectTriggerProps
>(
  (
    { className, content, onKeyDown, placeholder, values = [], ...props },
    ref
  ) => {
    const displayValue = values.filter(Boolean).join(', ');
    const hasValue = Boolean(content || displayValue);

    return (
      <div
        {...props}
        className={`cde-form-select-trigger ${
          hasValue ? 'cde-form-select-trigger--populated' : ''
        } ${className ?? ''}`}
        ref={ref}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}>
        <span className="cde-form-select-trigger-value">
          {content || displayValue || placeholder}
        </span>
        <DownOutlined />
      </div>
    );
  }
);

CDEFormSelectTrigger.displayName = 'CDEFormSelectTrigger';
