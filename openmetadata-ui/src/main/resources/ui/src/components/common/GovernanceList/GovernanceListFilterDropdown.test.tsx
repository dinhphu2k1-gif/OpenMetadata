/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GovernanceListFilterDropdown from './GovernanceListFilterDropdown.component';

const OPTIONS = [
  { label: 'Domain One', value: 'domain-one' },
  { label: 'Domain Two', value: 'domain-two' },
];

describe('GovernanceListFilterDropdown', () => {
  it('applies selected values only after save', async () => {
    const onChange = jest.fn();

    render(
      <GovernanceListFilterDropdown
        dataTestId="domain-filter"
        label="Domain"
        options={OPTIONS}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('domain-filter'));
    fireEvent.click(await screen.findByText('Domain One'));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(['domain-one'])
    );
  });

  it('selects every option from the all checkbox', async () => {
    const onChange = jest.fn();

    render(
      <GovernanceListFilterDropdown
        dataTestId="domain-filter"
        label="Domain"
        options={OPTIONS}
        selectedValues={[]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('domain-filter'));
    fireEvent.click(await screen.findByText('label.all'));
    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        'all',
        'domain-one',
        'domain-two',
      ])
    );
  });
});
