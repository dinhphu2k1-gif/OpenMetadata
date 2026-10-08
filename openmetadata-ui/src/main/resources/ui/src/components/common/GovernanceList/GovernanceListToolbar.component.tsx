/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import classNames from 'classnames';
import { FC, ReactNode } from 'react';

export interface GovernanceListToolbarProps {
  search: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  children?: ReactNode;
}

/** Shared ordering for search, module filters and right-aligned list actions. */
const GovernanceListToolbar: FC<GovernanceListToolbarProps> = ({
  search,
  actions,
  actionsClassName,
  children,
}) => (
  <>
    {search}
    {children}
    {actions && (
      <div
        className={classNames(
          'governance-list-toolbar-actions',
          actionsClassName
        )}>
        {actions}
      </div>
    )}
  </>
);

export default GovernanceListToolbar;
