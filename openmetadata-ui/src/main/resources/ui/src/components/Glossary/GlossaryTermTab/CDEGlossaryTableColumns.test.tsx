/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import { ColumnType } from 'antd/lib/table';
import { TFunction } from 'i18next';
import { getCDEGlossaryTableColumns } from './CDEGlossaryTableColumns';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

const columns = getCDEGlossaryTableColumns({
  t: ((key: string) => key) as TFunction,
  handleLoadMoreChildren: jest.fn(),
  loadingChildren: {},
});
const renderCell = (key: string, extension = {}, isLoadMoreButton = false) => {
  const column = columns.find(
    (column) => column.key === key
  ) as ColumnType<ModifiedGlossaryTerm>;

  return column.render?.(
    undefined,
    { extension, isLoadMoreButton } as ModifiedGlossaryTerm,
    0
  );
};

describe('CDE version and date columns', () => {
  it('appends version, status, and date columns in order', () => {
    expect(columns.slice(-4).map((column) => column.key)).toEqual([
      'version',
      'entityStatus',
      'effectiveDate',
      'expirationDate',
    ]);
    expect(columns.slice(-4).map((column) => column.width)).toEqual([
      120, 150, 160, 160,
    ]);
  });

  it('matches the detail header business version fallback', () => {
    expect(
      renderCell('version', { version: '2.0', phien_ban: '1.0' })
    ).toBe('2.0');
    expect(renderCell('version', { phien_ban: '1.1' })).toBe('1.1');
    expect(renderCell('version', { version: '1.2' })).toBe('1.2');
    expect(
      columns.find((column) => column.key === 'version')?.render?.(
        undefined,
        { version: 0.3, extension: {} } as ModifiedGlossaryTerm,
        0
      )
    ).toBe('1.0');
    expect(renderCell('version')).toBe('1.0');
  });

  it('formats valid dates and hides missing/invalid ones', () => {
    expect(renderCell('effectiveDate', { effectiveDate: '2026-09-18' })).toBe(
      '18/09/2026'
    );
    expect(renderCell('expirationDate', { expirationDate: '2026-02-30' })).toBe(
      '--'
    );
    expect(renderCell('effectiveDate')).toBe('--');
  });

  it.each(['version', 'effectiveDate', 'expirationDate'])(
    'leaves load-more row empty in %s',
    (key) => {
      expect(renderCell(key, {}, true)).toBeNull();
    }
  );
});
