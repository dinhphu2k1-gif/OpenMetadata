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
  getCdeVersionKey,
  getSelectableCdeVersions,
  isApprovedDictionaryVersionForScope,
} from './CDESelector.component';

describe('CDESelector version selection', () => {
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

  it('keeps only the latest Approved snapshot for each CDE identity', () => {
    const versions = getSelectableCdeVersions([
      {
        id: 'cde-id',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        description: '',
        entityStatus: TermStatus.Approved,
        parentBusinessVersion: '2',
        businessVersion: '2.0',
        snapshotId: 'snapshot-20',
      },
      {
        id: 'cde-id',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        description: '',
        entityStatus: TermStatus.Approved,
        parentBusinessVersion: '2',
        businessVersion: '2.1',
        snapshotId: 'snapshot-21',
      },
      {
        id: 'cde-id',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        description: '',
        entityStatus: TermStatus.Archived,
        archivedAt: 1,
        parentBusinessVersion: '2',
        businessVersion: '2.2',
        snapshotId: 'snapshot-22',
      },
    ] as GlossaryTerm[]);

    expect(versions).toHaveLength(1);
    expect(versions.map(getCdeVersionKey)).toEqual(['snapshot-21']);
  });

  it('keeps the latest archived CDE selectable inside an archived scope', () => {
    const versions = getSelectableCdeVersions(
      [
        {
          id: 'cde-id',
          name: 'CDE1',
          description: '',
          entityStatus: TermStatus.Archived,
          archivedAt: 1,
          parentBusinessVersion: '1',
          businessVersion: '1.2',
          snapshotId: 'snapshot-12',
        },
      ] as GlossaryTerm[],
      true
    );

    expect(versions.map(getCdeVersionKey)).toEqual(['snapshot-12']);
  });
});
