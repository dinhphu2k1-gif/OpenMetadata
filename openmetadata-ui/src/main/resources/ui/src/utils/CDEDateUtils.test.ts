/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import {
  formatCDEDate,
  normalizeCDEDate,
  validateCDEDates,
  mergeCDEDates,
} from './CDEDateUtils';

describe('CDE dates', () => {
  it.each([
    ['29/02/2024', '2024-02-29'],
    ['2026-09-18', '2026-09-18'],
    ['31/02/2026', undefined],
    ['2026-02-29', undefined],
    ['09/18/2026', undefined],
    ['', ''],
    [null, ''],
    ['invalid', undefined],
  ])('normalizes %s strictly', (input, expected) =>
    expect(normalizeCDEDate(input)).toBe(expected)
  );

  it('formats dates without time zone conversion', () => {
    expect(formatCDEDate('2026-09-18')).toBe('18/09/2026');
    expect(formatCDEDate('2026-02-30')).toBe('--');
    expect(formatCDEDate(undefined)).toBe('--');
  });

  it('allows missing/equal dates and rejects reversed intervals', () => {
    expect(validateCDEDates({})).toBeUndefined();
    expect(validateCDEDates({ expirationDate: '2026-01-01' })).toBeUndefined();
    expect(
      validateCDEDates({
        effectiveDate: '2026-01-01',
        expirationDate: '2026-01-01',
      })
    ).toBeUndefined();
    expect(
      validateCDEDates({
        effectiveDate: '2026-01-02',
        expirationDate: '2026-01-01',
      })
    ).toBe('cde.invalid-date-range');
  });

  it('preserves missing dates and unrelated properties, but removes explicit blanks', () => {
    const old = {
      custom: 'keep',
      effectiveDate: '2026-01-01',
      expirationDate: '2026-12-31',
    };

    expect(mergeCDEDates(old, {})).toEqual(old);
    expect(mergeCDEDates(old, { expirationDate: '' })).toEqual({
      custom: 'keep',
      effectiveDate: '2026-01-01',
    });
    expect(old.expirationDate).toBe('2026-12-31');
    expect(() => mergeCDEDates(old, { effectiveDate: '2027-01-01' })).toThrow(
      'cde.invalid-date-range'
    );
  });
});
