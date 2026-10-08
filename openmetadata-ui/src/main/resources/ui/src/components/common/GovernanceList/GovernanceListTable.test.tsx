/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { render, screen } from '@testing-library/react';
import { ComponentProps, ReactNode } from 'react';
import GovernanceListTable from './GovernanceListTable.component';

jest.mock('../Table/Table', () => ({
  __esModule: true,
  default: ({ dataSource, extraTableFilters }: ComponentProps<'div'> & {
    dataSource?: object[];
    extraTableFilters?: ReactNode;
  }) => (
    <div data-count={dataSource?.length} data-testid="shared-table">
      {extraTableFilters}
    </div>
  ),
}));

describe('GovernanceListTable', () => {
  it('keeps the shared frame while forwarding rows and toolbar', () => {
    const { container } = render(
      <GovernanceListTable
        columns={[]}
        dataSource={[{ id: 'one' }]}
        extraTableFilters={<span>Filters</span>}
        rowKey="id"
      />
    );

    expect(screen.getByTestId('shared-table')).toHaveAttribute(
      'data-count',
      '1'
    );
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(
      container.querySelector('.governance-list-scroll-container')
    ).toBeInTheDocument();
  });
});
