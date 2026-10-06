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
import { Empty, Spin, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getTechnicalRecordHistory,
  TechnicalHistoryChange,
  TechnicalHistoryEntry,
} from '../../rest/technicalDictionaryAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const PAGE_SIZE = 10;

const FIELD_LABELS: Record<string, string> = {
  cde: 'label.cde-code-ref',
  rank: 'label.rank',
  elementType: 'label.data-element-type',
  generationType: 'label.generation-type',
  creationMethod: 'label.creation-method',
  timeliness: 'label.timeliness',
  systemOwner: 'label.technical-data-steward',
};

interface TechnicalHistoryPanelProps {
  /** Record whose history is shown; nothing loads without it. */
  termId?: string;
  /** Loads only while true, so a closed dialog or hidden tab stays idle. */
  active?: boolean;
}

/** Who changed a Technical Dictionary record, when, and from which value to which. */
const TechnicalHistoryPanel = ({
  termId,
  active = true,
}: TechnicalHistoryPanelProps) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TechnicalHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (active) {
      setPage(1);
    }
  }, [active, termId]);

  useEffect(() => {
    if (!active || !termId) {
      return undefined;
    }
    let isCurrent = true;
    setIsLoading(true);
    getTechnicalRecordHistory(termId, PAGE_SIZE, (page - 1) * PAGE_SIZE)
      .then((loaded) => {
        if (isCurrent) {
          setEntries(loaded.data);
          setTotal(loaded.paging.total);
        }
      })
      .catch((error) => {
        isCurrent && setEntries([]);
        showErrorToast(error as AxiosError);
      })
      .finally(() => isCurrent && setIsLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [active, termId, page]);

  const renderChange = (change: TechnicalHistoryChange) => (
    <div className="m-b-xss" key={change.field}>
      <strong>{t(FIELD_LABELS[change.field])}</strong>
      {': '}
      <span className="text-grey-muted">
        {change.oldValue || '--'} → {change.newValue || '--'}
      </span>
    </div>
  );

  const columns: ColumnsType<TechnicalHistoryEntry> = [
    {
      title: t('label.time'),
      dataIndex: 'at',
      width: 170,
      render: (at: number) => formatDateTime(at),
    },
    {
      title: t('label.user'),
      dataIndex: 'actor',
      width: 140,
    },
    {
      title: t('label.action'),
      dataIndex: 'action',
      width: 220,
      render: (action: string) =>
        t(
          `label.technical-history-action-${action
            .toLowerCase()
            .replace('_', '-')}`
        ),
    },
    {
      title: t('label.technical-history-changes'),
      dataIndex: 'changes',
      render: (changes: TechnicalHistoryChange[]) =>
        changes.some((change) => FIELD_LABELS[change.field])
          ? changes
              .filter((change) => FIELD_LABELS[change.field])
              .map(renderChange)
          : '--',
    },
  ];

  return (
    <Spin spinning={isLoading}>
      {entries.length === 0 && !isLoading ? (
        <Empty
          description={t('message.technical-history-empty')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={entries}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: setPage,
          }}
          rowKey="id"
          size="small"
        />
      )}
    </Spin>
  );
};

export default TechnicalHistoryPanel;
