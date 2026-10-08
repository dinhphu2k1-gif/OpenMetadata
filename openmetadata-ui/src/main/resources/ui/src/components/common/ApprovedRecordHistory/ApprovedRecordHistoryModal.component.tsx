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
import { getApprovedRecordFieldLabelKey } from '../../../utils/ApprovedRecordHistoryUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ApprovedRecordHistoryEntry,
  ApprovedRecordHistoryModalProps,
} from './ApprovedRecordHistory.interface';

const EMPTY_VALUE = '--';

const ApprovedRecordHistoryModal: FC<ApprovedRecordHistoryModalProps> = ({
  open,
  scope,
  subtitle,
  load,
  onClose,
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ApprovedRecordHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let isCurrent = true;
    setIsLoading(true);
    load()
      .then((history) => isCurrent && setEntries(history))
      .catch((error: AxiosError) => {
        if (isCurrent) {
          setEntries([]);
          showErrorToast(error);
        }
      })
      .finally(() => isCurrent && setIsLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [open, load]);

  const panels = entries.map((entry) => (
    <Collapse.Panel
      header={
        <span data-testid={`approved-record-history-${entry.id}`}>
          {t('label.approved-by-on', {
            date: formatDateTime(entry.approvedAt),
            user: entry.approvedBy,
          })}
        </span>
      }
      key={entry.id}>
      <div className="d-flex flex-col gap-2">
        {entry.proposedBy && entry.proposedAt != null && (
          <Typography.Text type="secondary">
            {t('label.proposed-by-on', {
              date: formatDateTime(entry.proposedAt),
              user: entry.proposedBy,
            })}
          </Typography.Text>
        )}
        {entry.changes.length === 0 ? (
          <Typography.Text type="secondary">
            {t('message.no-field-changes')}
          </Typography.Text>
        ) : (
          entry.changes.map((change) => (
            <div
              data-testid={`approved-record-change-${change.field}`}
              key={change.field}>
              <Typography.Text strong>
                {t(getApprovedRecordFieldLabelKey(scope, change.field))}
                {': '}
              </Typography.Text>
              <Typography.Text type="secondary">
                {change.oldValue || EMPTY_VALUE} {'→'}{' '}
                {change.newValue || EMPTY_VALUE}
              </Typography.Text>
            </div>
          ))
        )}
      </div>
    </Collapse.Panel>
  ));

  return (
    <Modal
      destroyOnClose
      data-testid="approved-record-history-modal"
      footer={null}
      open={open}
      title={
        <>
          {t('label.correction-history')}
          {subtitle && (
            <div className="text-grey-muted text-xs">{subtitle}</div>
          )}
        </>
      }
      width={720}
      onCancel={onClose}>
      {isLoading ? (
        <Skeleton active />
      ) : panels.length === 0 ? (
        <Empty
          data-testid="approved-record-history-empty"
          description={t('message.no-correction-history')}
        />
      ) : (
        <Collapse accordion defaultActiveKey={entries[0].id}>
          {panels}
        </Collapse>
      )}
    </Modal>
  );
};

export default ApprovedRecordHistoryModal;
