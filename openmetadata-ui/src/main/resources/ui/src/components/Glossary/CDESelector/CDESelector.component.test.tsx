/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { EntityStatus as GlossaryStatus } from '../../../generated/entity/data/glossary';
import {
  EntityStatus as TermStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import {
  getSelectableCdes,
  isApprovedDictionaryVersionForScope,
} from './CDESelector.component';

describe('CDESelector identity selection', () => {
  it('selects the Approved Data Dictionary version in the requested scope', () => {
    expect(
      isApprovedDictionaryVersionForScope(
        {
          id: 'dictionary-id',
          name: 'Data Dictionary',
          description: '',
          businessVersion: '2',
          entityStatus: GlossaryStatus.Approved,
        },
        '2'
      )
    ).toBe(true);
  });

  it('accepts an archived Data Dictionary when it is the requested scope', () => {
    expect(
      isApprovedDictionaryVersionForScope(
        {
          id: 'dictionary-id',
          name: 'Data Dictionary',
          description: '',
          businessVersion: '1',
          entityStatus: GlossaryStatus.Archived,
          archivedAt: 1,
        },
        '1'
      )
    ).toBe(true);
  });

  it('keeps only one option per CDE identity and excludes non-Approved duplicates', () => {
    const cdes = getSelectableCdes([
      {
        id: 'cde-id',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        description: '',
        entityStatus: TermStatus.Approved,
        parentBusinessVersion: '2',
      },
      {
        id: 'cde-id',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        description: '',
        entityStatus: TermStatus.Approved,
        parentBusinessVersion: '2',
      },
      {
        id: 'other-cde-id',
        name: 'CDE2',
        displayName: 'Số điện thoại',
        description: '',
        entityStatus: TermStatus.Archived,
        archivedAt: 1,
        parentBusinessVersion: '2',
      },
    ] as GlossaryTerm[]);

    expect(cdes.map((cde) => cde.id)).toEqual(['cde-id']);
  });

  it('keeps an archived CDE selectable inside an archived scope', () => {
    const cdes = getSelectableCdes(
      [
        {
          id: 'cde-id',
          name: 'CDE1',
          description: '',
          entityStatus: TermStatus.Archived,
          archivedAt: 1,
          parentBusinessVersion: '1',
        },
      ] as GlossaryTerm[],
      true
    );

    expect(cdes.map((cde) => cde.id)).toEqual(['cde-id']);
  });
});
