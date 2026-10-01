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
import { Alert, Spin } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  getCdeTechnicalAssets,
  TechnicalAssetsPage,
  TechnicalRecordApiRow,
} from '../../../../rest/technicalDictionaryAPI';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import Fqn from '../../../../utils/Fqn';
import { getTermQuery } from '../../../../utils/SearchUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import EntitySummaryPanel from '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../Explore/ExplorePage.interface';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import AssetsTabs from './AssetsTabs.component';

interface CDETechnicalAssetsTabProps {
  /** Any version of the CDE: the binding is to the CDE, so every version shows the same list. */
  cdeId: string;
  glossaryTerm?: GlossaryTerm;
}

// The API serves at most this many Columns per request; the stock tab shows them on one page.
const MAX_ASSETS = 100;
const TABLE_FQN_DEPTH = 4;

// The list is read-only: bindings are made in the Technical Dictionary, not here.
const READ_ONLY_PERMISSIONS = new Proxy({} as OperationPermission, {
  get: (_, key) => key === 'ViewAll' || key === 'ViewBasic',
});

/** FQN of the Table that holds a Column, or undefined when it cannot be derived. */
export const getTableFqnOfColumn = (columnFqn?: string): string | undefined => {
  let result: string | undefined;
  try {
    const parts = columnFqn ? Fqn.split(columnFqn) : [];
    result =
      parts.length > TABLE_FQN_DEPTH
        ? Fqn.build(...parts.slice(0, TABLE_FQN_DEPTH))
        : undefined;
  } catch {
    result = undefined;
  }

  return result;
};

/** A bound Column shaped like a `column_search_index` hit, which the stock Assets tab knows how to draw. */
export const toColumnSearchHit = (
  row: TechnicalRecordApiRow
): SearchedDataProps['data'][number] => {
  const tableFqn = getTableFqnOfColumn(row.columnFqn);
  const tableName = row.table ?? '';

  return {
    _index: 'column_search_index',
    _id: row.columnKey,
    _source: {
      id: row.columnKey,
      name: row.column,
      displayName: row.column,
      fullyQualifiedName: row.columnFqn,
      description: row.description,
      dataType: row.dataType,
      entityType: EntityType.TABLE_COLUMN,
      deleted: row.sourceStatus === 'Unavailable',
      table: tableFqn
        ? {
            name: tableName,
            displayName: tableName,
            fullyQualifiedName: tableFqn,
            type: EntityType.TABLE,
          }
        : undefined,
      service: row.service ? { name: row.service } : undefined,
      database: row.database ? { name: row.database } : undefined,
      databaseSchema: row.schema ? { name: row.schema } : undefined,
    },
  } as unknown as SearchedDataProps['data'][number];
};

/** The search documents of the given Columns, so they are drawn exactly as the stock Assets tab draws them. */
const fetchIndexedColumns = async (
  rows: TechnicalRecordApiRow[]
): Promise<SearchedDataProps['data']> => {
  let found: SearchedDataProps['data'] = [];
  if (rows.length > 0) {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: rows.length,
        searchIndex: SearchIndex.COLUMN,
        query: '*',
        queryFilter: getTermQuery(
          { fullyQualifiedName: rows.map((row) => row.columnFqn) },
          'should',
          1
        ) as Record<string, unknown>,
      });
      found = (response.hits?.hits ?? []) as SearchedDataProps['data'];
    } catch {
      found = [];
    }
  }

  return found;
};

/**
 * Columns the Technical Dictionary binds to a CDE, drawn by the stock Assets tab. Used where the
 * stock tag search has nothing to find: a CDE of a replaced Data Dictionary version, whose tags were
 * removed from the Columns at the cutover. The list is then the one frozen at that cutover.
 */
const CDETechnicalAssetsTab = ({
  cdeId,
  glossaryTerm,
}: CDETechnicalAssetsTabProps) => {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<TechnicalAssetsPage>();
  const [indexed, setIndexed] = useState<SearchedDataProps['data']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getCdeTechnicalAssets(cdeId, MAX_ASSETS, 0)
      .then(async (loaded) => {
        const found = await fetchIndexedColumns(loaded.data);
        if (active) {
          setIndexed(found);
          setAssets(loaded);
        }
      })
      .catch((error) => {
        active && setAssets(undefined);
        showErrorToast(error as AxiosError);
      })
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, [cdeId]);

  // The Column as the search index has it, which is what the stock tab and its summary panel draw;
  // the frozen row stands in for a Column the index no longer has.
  const hits = useMemo(() => {
    const byFqn = new Map(
      indexed.map((hit) => [hit._source.fullyQualifiedName, hit])
    );

    // The rank is the one of the binding; AssetsTabs reads it from the hit's extension.
    return (assets?.data ?? []).map((row) => {
      const hit = byFqn.get(row.columnFqn) ?? toColumnSearchHit(row);

      return row.rank
        ? {
            ...hit,
            _source: {
              ...hit._source,
              extension: {
                ...(hit._source as { extension?: object }).extension,
                survivorshipRank: row.rank,
              },
            },
          }
        : hit;
    }) as SearchedDataProps['data'];
  }, [assets, indexed]);

  const notice =
    assets?.source === 'SNAPSHOT' ? (
      <Alert
        showIcon
        className="m-b-md"
        data-testid="cde-technical-assets-snapshot"
        message={t('message.technical-assets-snapshot', {
          version: assets.dataDictionaryVersion,
          date: assets.frozenAt ? formatDateTime(assets.frozenAt) : '',
        })}
        type="info"
      />
    ) : assets?.source === 'NONE' ? (
      <Alert
        showIcon
        className="m-b-md"
        data-testid="cde-technical-assets-none"
        message={t('message.technical-assets-not-available', {
          version: assets.dataDictionaryVersion,
        })}
        type="info"
      />
    ) : null;

  // Same layout as the stock Assets tab: the list on the left, the summary of the clicked Column on the right.
  return (
    <div className="h-full" data-testid="cde-technical-assets">
      <ResizablePanels
        className="h-full glossary-term-resizable-panel"
        firstPanel={{
          className: 'glossary-term-resizable-panel-container',
          children: (
            <>
              {notice}
              <Spin spinning={isLoading}>
                {!isLoading && (
                  <AssetsTabs
                    skipSearch
                    activeEntity={glossaryTerm}
                    assetCount={hits.length}
                    entityFqn={glossaryTerm?.fullyQualifiedName ?? ''}
                    isSummaryPanelOpen={Boolean(previewAsset)}
                    noDataPlaceholder={{
                      message: t('message.technical-assets-empty'),
                    }}
                    permissions={READ_ONLY_PERMISSIONS}
                    preloadedData={hits}
                    selectFirstAsset={false}
                    onAddAsset={() => undefined}
                    onAssetClick={setPreviewAsset}
                  />
                )}
              </Spin>
            </>
          ),
          flex: 0.7,
          minWidth: 700,
          wrapInCard: false,
        }}
        hideSecondPanel={!previewAsset}
        pageTitle={t('label.glossary-term')}
        secondPanel={{
          children: previewAsset && (
            <EntitySummaryPanel
              entityDetails={previewAsset}
              handleClosePanel={() => setPreviewAsset(undefined)}
              highlights={{
                'tag.name': [glossaryTerm?.fullyQualifiedName ?? ''],
              }}
              key={
                previewAsset.details.id ??
                previewAsset.details.fullyQualifiedName
              }
              panelPath="glossary-term-assets-tab"
            />
          ),
          className:
            'entity-summary-resizable-right-panel-container glossary-term-resizable-panel-container',
          flex: 0.3,
          minWidth: 400,
          wrapInCard: false,
        }}
      />
    </div>
  );
};

export default CDETechnicalAssetsTab;
