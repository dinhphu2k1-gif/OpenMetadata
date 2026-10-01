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
import { render, screen, waitFor } from '@testing-library/react';
import {
  getCdeTechnicalAssets,
  TechnicalAssetsPage,
} from '../../../../rest/technicalDictionaryAPI';
import CDETechnicalAssetsTab, {
  getTableFqnOfColumn,
  toColumnSearchHit,
} from './CDETechnicalAssetsTab.component';

jest.mock('../../../../rest/technicalDictionaryAPI', () => ({
  getCdeTechnicalAssets: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
jest.mock('../../../common/ResizablePanels/ResizablePanels', () => ({
  __esModule: true,
  default: ({ firstPanel }: { firstPanel: { children: React.ReactNode } }) => (
    <div>{firstPanel.children}</div>
  ),
}));
jest.mock(
  '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => ({ __esModule: true, default: () => <div /> })
);
jest.mock('./AssetsTabs.component', () => ({
  __esModule: true,
  default: ({
    preloadedData,
    skipSearch,
  }: {
    preloadedData: Array<{ _source: { name: string } }>;
    skipSearch?: boolean;
  }) => (
    <div data-skip-search={String(Boolean(skipSearch))} data-testid="assets">
      {preloadedData.map((hit) => (
        <span key={hit._source.name}>{hit._source.name}</span>
      ))}
    </div>
  ),
}));

const ROW = {
  termId: 'term-1',
  columnKey: 'key-1',
  columnFqn: 'ipcas.core.dbo.CUSTOMER.ID_NO',
  service: 'ipcas',
  database: 'core',
  schema: 'dbo',
  table: 'CUSTOMER',
  column: 'ID_NO',
  dataType: 'varchar(20)',
  sourceStatus: 'Available' as const,
  revision: 1,
  rank: 1,
};

const page = (
  overrides: Partial<TechnicalAssetsPage>
): TechnicalAssetsPage => ({
  source: 'SNAPSHOT',
  dataDictionaryVersion: '1',
  frozenAt: 1_700_000_000_000,
  data: [ROW],
  paging: { total: 1, limit: 100, offset: 0 },
  ...overrides,
});

describe('CDETechnicalAssetsTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hands the frozen Columns to the stock Assets tab and says they were frozen', async () => {
    (getCdeTechnicalAssets as jest.Mock).mockResolvedValue(page({}));

    render(<CDETechnicalAssetsTab cdeId="cde-1" />);

    expect(await screen.findByText('ID_NO')).toBeInTheDocument();
    expect(getCdeTechnicalAssets).toHaveBeenCalledWith('cde-1', 100, 0);
    expect(screen.getByTestId('assets')).toHaveAttribute(
      'data-skip-search',
      'true'
    );
    expect(
      screen.getByTestId('cde-technical-assets-snapshot')
    ).toBeInTheDocument();
  });

  it('says the bindings are not available while the version is still being drafted', async () => {
    (getCdeTechnicalAssets as jest.Mock).mockResolvedValue(
      page({ source: 'NONE', dataDictionaryVersion: '2', data: [] })
    );

    render(<CDETechnicalAssetsTab cdeId="cde-1" />);

    await waitFor(() =>
      expect(
        screen.getByTestId('cde-technical-assets-none')
      ).toBeInTheDocument()
    );
  });
});

describe('toColumnSearchHit', () => {
  it('shapes a bound Column like a column search hit with its Table', () => {
    const { _source } = toColumnSearchHit(ROW) as unknown as {
      _source: Record<string, unknown>;
    };

    expect(_source).toMatchObject({
      entityType: 'tableColumn',
      fullyQualifiedName: 'ipcas.core.dbo.CUSTOMER.ID_NO',
      table: { fullyQualifiedName: 'ipcas.core.dbo.CUSTOMER' },
      deleted: false,
    });
  });

  it('marks a Column whose source is gone as deleted', () => {
    const { _source } = toColumnSearchHit({
      ...ROW,
      sourceStatus: 'Unavailable',
    }) as unknown as { _source: Record<string, unknown> };

    expect(_source.deleted).toBe(true);
  });
});

describe('getTableFqnOfColumn', () => {
  it('drops the column segment of a Column FQN', () => {
    expect(getTableFqnOfColumn('ipcas.core.dbo.CUSTOMER.ID_NO')).toBe(
      'ipcas.core.dbo.CUSTOMER'
    );
  });

  it('gives nothing for a FQN that is not a Column', () => {
    expect(getTableFqnOfColumn('ipcas.core.dbo.CUSTOMER')).toBeUndefined();
  });
});
