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

import { Collapse, Empty, Modal, Skeleton, Typography } from 'antd';
import { AxiosError } from 'axios';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGlossaryTermCorrectionHistory,
  GlossaryTermCorrectionHistoryEntry,
} from '../../../rest/glossaryAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export interface CorrectionHistoryModalProps {
  businessVersion: string;
  open: boolean;
  parentBusinessVersion?: string;
  termId: string;
  onClose: () => void;
}

const HASH_PREVIEW_LENGTH = 12;

const CorrectionHistoryModal: FC<CorrectionHistoryModalProps> = ({
  businessVersion,
  open,
  parentBusinessVersion,
  termId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<GlossaryTermCorrectionHistoryEntry[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let isCurrent = true;
    setIsLoading(true);
    getGlossaryTermCorrectionHistory(
      termId,
      businessVersion,
      parentBusinessVersion
    )
      .then((history) => isCurrent && setEntries(history))
      .catch((error: AxiosError) => isCurrent && showErrorToast(error))
      .finally(() => isCurrent && setIsLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [open, termId, businessVersion, parentBusinessVersion]);

  const panels = entries.map((entry) => (
    <Collapse.Panel
      header={
        <span data-testid={`correction-history-${entry.historyId}`}>
          {t('label.replaced-on', {
            date: formatDateTime(entry.supersededAt),
            user: entry.supersededBy,
          })}
        </span>
      }
      key={entry.historyId}>
      <div className="d-flex flex-col gap-2">
        <Typography.Text type="secondary">
          {t('label.approved-by-on', {
            date: formatDateTime(entry.publishedAt),
            user: entry.publishedBy,
          })}
        </Typography.Text>
        <div>
          <Typography.Text strong>{t('label.display-name')}: </Typography.Text>
          <Typography.Text>{entry.displayName ?? '--'}</Typography.Text>
        </div>
        <div>
          <Typography.Text strong>{t('label.description')}: </Typography.Text>
          <Typography.Text>{entry.description || '--'}</Typography.Text>
        </div>
        <Typography.Text code>
          {entry.contentHash.slice(0, HASH_PREVIEW_LENGTH)}
        </Typography.Text>
      </div>
    </Collapse.Panel>
  ));

  return (
    <Modal
      destroyOnClose
      footer={null}
      open={open}
      title={t('label.correction-history-version', {
        version: businessVersion,
      })}
      width={640}
      onCancel={onClose}>
      {isLoading ? (
        <Skeleton active />
      ) : panels.length === 0 ? (
        <Empty
          data-testid="correction-history-empty"
          description={t('message.no-correction-history')}
        />
      ) : (
        <Collapse accordion defaultActiveKey={entries[0].historyId}>
          {panels}
        </Collapse>
      )}
    </Modal>
  );
};

export default CorrectionHistoryModal;
