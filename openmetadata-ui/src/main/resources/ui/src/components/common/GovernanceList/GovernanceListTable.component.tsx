/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import classNames from 'classnames';
import { RefObject } from 'react';
import Table from '../Table/Table';
import { TableComponentProps } from '../Table/Table.interface';
import './governance-list.less';

export interface GovernanceListTableProps<T extends object>
  extends TableComponentProps<T> {
  scrollContainerClassName?: string;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

/** Shared table frame; modules keep their own columns, rows and business actions. */
const GovernanceListTable = <T extends object,>({
  scrollContainerClassName,
  scrollContainerRef,
  ...tableProps
}: GovernanceListTableProps<T>) => (
  <div
    className={classNames(
      'governance-list-scroll-container',
      'glossary-terms-scroll-container',
      scrollContainerClassName
    )}
    ref={scrollContainerRef}>
    <Table<T> {...tableProps} />
  </div>
);

export default GovernanceListTable;
