/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { fireEvent, render, screen } from '@testing-library/react';
import GovernanceListSearchInput from './GovernanceListSearchInput.component';

describe('GovernanceListSearchInput', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => jest.useRealTimers());

  it('debounces text and submits immediately on Enter', () => {
    const onSearch = jest.fn();
    render(
      <GovernanceListSearchInput
        dataTestId="governance-search"
        placeholder="Search"
        onSearch={onSearch}
      />
    );
    const input = screen.getByTestId('governance-search');

    fireEvent.change(input, { target: { value: 'customer' } });
    jest.advanceTimersByTime(399);

    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onSearch).toHaveBeenCalledWith('customer');
  });

  it('waits for Vietnamese composition to finish', () => {
    const onSearch = jest.fn();
    render(
      <GovernanceListSearchInput
        dataTestId="governance-search"
        placeholder="Search"
        onSearch={onSearch}
      />
    );
    const input = screen.getByTestId('governance-search');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'dữ liệu' } });
    jest.advanceTimersByTime(400);

    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: 'dữ liệu' });
    jest.advanceTimersByTime(400);

    expect(onSearch).toHaveBeenCalledWith('dữ liệu');
  });
});
