/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import { ColumnType } from 'antd/lib/table';
import { TFunction } from 'i18next';
import { isValidElement } from 'react';
import { Link } from 'react-router-dom';
import { getCDEGlossaryTableColumns } from './CDEGlossaryTableColumns';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

const columns = getCDEGlossaryTableColumns({
  t: ((key: string) => key) as TFunction,
  handleLoadMoreChildren: jest.fn(),
  loadingChildren: {},
  parentBusinessVersion: '1.0',
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
  it('includes the stable term id in a working-revision detail link', () => {
    const nameColumn = columns.find((column) => column.key === 'name');
    const rendered = nameColumn?.render?.(
      'CDE1',
      {
        id: 'cde-identity-id',
        termId: 'cde-term-id',
        fullyQualifiedName: 'Data Dictionary.CDE1',
        businessVersion: '1.1',
        parentBusinessVersion: '1',
        entityStatus: 'Draft',
      } as ModifiedGlossaryTerm,
      0
    );

    expect(isValidElement(rendered)).toBe(true);
    expect((rendered as React.ReactElement<React.ComponentProps<typeof Link>>).props.to)
      .toBe(
        '/glossary/Data%20Dictionary.CDE1?businessVersion=1.1&parentBusinessVersion=1&termId=cde-term-id&view=working'
      );
  });

  it('appends version, status, dates, and release level in order', () => {
    expect(columns.slice(-5).map((column) => column.key)).toEqual([
      'version',
      'entityStatus',
      'releaseLevel',
      'effectiveDate',
      'expirationDate',
    ]);
    expect(columns.slice(-5).map((column) => column.width)).toEqual([
      120, 150, 170, 160, 160,
    ]);
  });

  it('uses only the canonical business version field', () => {
    const versionColumn = columns.find((column) => column.key === 'version');

    expect(
      versionColumn?.render?.(
        undefined,
        { businessVersion: '2.0' } as ModifiedGlossaryTerm,
        0
      )
    ).toBe('2.0');
    expect(
      versionColumn?.render?.(
        undefined,
        { businessVersion: '1.2' } as ModifiedGlossaryTerm,
        0
      )
    ).toBe('1.2');
    expect(
      versionColumn?.render?.(
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

  it('renders the release-level label before the effective date', () => {
    expect(
      (renderCell('releaseLevel', { releaseLevel: ['CEO'] }) as React.ReactElement)
        .props.children
    ).toBe('cde.release-level-ceo');
    expect(
      (
        renderCell('releaseLevel', {
          releaseLevel: ['TTQLDL'],
        }) as React.ReactElement
      ).props.children
    ).toBe('cde.release-level-ttqldl');
    expect(renderCell('releaseLevel')).toBe('--');
  });

  it.each(['version', 'effectiveDate', 'expirationDate', 'releaseLevel'])(
    'leaves load-more row empty in %s',
    (key) => {
      expect(renderCell(key, {}, true)).toBeNull();
    }
  );
});
