/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  TechnicalCatalogState,
  TechnicalDictionaryCapabilities,
} from './technicalDictionary.interface';
import {
  getCatalogActions,
  STAT_ITEMS,
} from './TechnicalDictionaryHeader.component';

const all: TechnicalDictionaryCapabilities = {
  canViewWorking: true,
  canEditWorking: true,
  canSubmit: true,
  canApprove: true,
  canReject: true,
  canCreateVersion: true,
  canArchive: false,
};
const none: TechnicalDictionaryCapabilities = {
  canViewWorking: false,
  canEditWorking: false,
  canSubmit: false,
  canApprove: false,
  canReject: false,
  canCreateVersion: false,
  canArchive: false,
};
const catalog = (
  status: string,
  isWorking: boolean
): TechnicalCatalogState => ({
  businessVersion: '2',
  status,
  isWorking,
  isReadOnly: status === 'Archived',
});

jest.mock('../../assets/svg/ic-column.svg', () => ({
  ReactComponent: () => null,
}));
jest.mock(
  '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.component',
  () => () => null
);

describe('getCatalogActions', () => {
  it('offers submit for a Draft working catalog', () => {
    expect(getCatalogActions(catalog('Draft', true), all, true)).toEqual([
      'submit',
    ]);
  });

  it('offers approve and reject for an In Review catalog', () => {
    expect(getCatalogActions(catalog('In Review', true), all, true)).toEqual([
      'approve',
      'reject',
    ]);
  });

  it('offers reopen for a Rejected catalog', () => {
    expect(getCatalogActions(catalog('Rejected', true), all, true)).toEqual([
      'reopen',
    ]);
  });

  it('offers a new version only on the latest active Approved catalog', () => {
    expect(getCatalogActions(catalog('Approved', false), all, true)).toEqual([
      'createDraft',
    ]);
    expect(getCatalogActions(catalog('Approved', false), all, false)).toEqual(
      []
    );
    expect(getCatalogActions(catalog('Archived', false), all, true)).toEqual(
      []
    );
  });

  it('offers nothing without capabilities', () => {
    expect(getCatalogActions(catalog('Draft', true), none, true)).toEqual([]);
    expect(getCatalogActions(catalog('Approved', false), none, true)).toEqual(
      []
    );
  });
});

describe('STAT_ITEMS', () => {
  it('shows the four declared-column cards in order', () => {
    expect(STAT_ITEMS.map((item) => item.key)).toEqual([
      'totalColumns',
      'totalTables',
      'totalSources',
      'approved',
    ]);
  });
});
