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
import { Descriptions, Empty, List, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGlossaryTermsVersionsList } from '../../rest/glossaryAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';

/** The part of a published snapshot the history view shows. */
export interface TechnicalVersionSnapshot {
  businessVersion: string;
  entityStatus: string;
  publishedAt?: number;
  publishedBy?: string;
  archivedAt?: number;
  description?: string;
  relatedTerms?: Array<{ term?: { name?: string; displayName?: string } }>;
  extension?: { survivorshipRank?: number };
  tags?: Array<{ tagFQN: string; displayName?: string; name?: string }>;
}

interface TechnicalVersionHistoryProps {
  row: TechnicalDictionaryRow;
}

const parseSnapshots = (versions: string[]): TechnicalVersionSnapshot[] =>
  versions.map((version) => JSON.parse(version) as TechnicalVersionSnapshot);

const tagLabel = (tag: NonNullable<TechnicalVersionSnapshot['tags']>[number]) =>
  tag.displayName || tag.name || tag.tagFQN.split('.').pop() || tag.tagFQN;

/** Approved and Archived versions of one record, read-only; the newest is selected first. */
const TechnicalVersionHistory = ({ row }: TechnicalVersionHistoryProps) => {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<TechnicalVersionSnapshot[]>([]);
  const [selected, setSelected] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getGlossaryTermsVersionsList(row.termId, row.parentBusinessVersion)
      .then((history) => {
        if (active) {
          const loaded = parseSnapshots(history.versions as string[]);
          setSnapshots(loaded);
          setSelected(loaded[0]?.businessVersion);
        }
      })
      .catch(() => active && setSnapshots([]))
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, [row.termId, row.parentBusinessVersion]);

  const current = snapshots.find(
    (snapshot) => snapshot.businessVersion === selected
  );

  return (
    <Spin spinning={isLoading}>
      {snapshots.length === 0 ? (
        <Empty
          data-testid="technical-version-history-empty"
          description={t('message.technical-version-history-empty')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <List
            bordered
            data-testid="technical-version-history"
            dataSource={snapshots}
            renderItem={(snapshot) => (
              <List.Item
                className="cursor-pointer"
                data-testid={`technical-version-${snapshot.businessVersion}`}
                style={{
                  fontWeight:
                    snapshot.businessVersion === selected ? 600 : undefined,
                }}
                onClick={() => setSelected(snapshot.businessVersion)}>
                <span>{snapshot.businessVersion}</span>
                <Tag>{snapshot.entityStatus}</Tag>
                <span>{snapshot.publishedBy}</span>
                <span>
                  {snapshot.publishedAt ? formatDateTime(snapshot.publishedAt) : ''}
                </span>
              </List.Item>
            )}
            size="small"
          />
          {current && (
            <Descriptions
              bordered
              column={1}
              data-testid="technical-version-detail"
              size="small"
              style={{ marginTop: 12 }}>
              <Descriptions.Item label={t('label.cde-code-ref')}>
                {current.relatedTerms?.[0]?.term?.name}
              </Descriptions.Item>
              <Descriptions.Item label={t('label.cde-name')}>
                {current.relatedTerms?.[0]?.term?.displayName}
              </Descriptions.Item>
              <Descriptions.Item label={t('label.rank')}>
                {current.extension?.survivorshipRank}
              </Descriptions.Item>
              <Descriptions.Item label={t('label.classification-plural')}>
                {current.tags?.map(tagLabel).join(', ')}
              </Descriptions.Item>
            </Descriptions>
          )}
        </>
      )}
    </Spin>
  );
};

export default TechnicalVersionHistory;
