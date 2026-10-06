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

import { Progress, Space, Typography } from 'antd';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGlossaryTermWorkingVersion,
  GlossaryWorkflowAction,
  transitionGlossaryTermWorkflow,
} from '../../../../rest/glossaryAPI';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import ReviewActionConfirmModal, {
  ReviewConfirmAction,
} from '../../../common/ReviewActionConfirmModal/ReviewActionConfirmModal.component';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';

export type BulkActionType = 'submitForReview' | 'approve' | 'reject';

export interface GlossaryBulkActionModalProps {
  actionType: BulkActionType;
  open: boolean;
  terms: ModifiedGlossaryTerm[];
  onCancel: () => void;
  onSuccess: () => void;
}

const BATCH_CONCURRENCY = 5;

const CONFIRM_ACTIONS: Record<BulkActionType, ReviewConfirmAction> = {
  submitForReview: 'submit',
  approve: 'approve',
  reject: 'reject',
};

export const GlossaryBulkActionModal: FC<GlossaryBulkActionModalProps> = ({
  actionType,
  open,
  terms,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation();

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTermName, setCurrentTermName] = useState<string>('');

  const handleExecute = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);

    const action: GlossaryWorkflowAction =
      actionType === 'submitForReview'
        ? 'submit'
        : actionType === 'approve'
        ? 'approve'
        : actionType;

    let successCount = 0;
    let failedCount = 0;
    const total = terms.length;

    for (let i = 0; i < total; i += BATCH_CONCURRENCY) {
      const chunk = terms.slice(i, i + BATCH_CONCURRENCY);
      await Promise.all(
        chunk.map(async (term) => {
          try {
            setCurrentTermName(term.displayName || term.name || '');
            const working = await getGlossaryTermWorkingVersion(
              term.id,
              term.parentBusinessVersion
            );
            await transitionGlossaryTermWorkflow(
              term.id,
              action,
              {
                expectedRevision: Number(working.workingRevision),
              },
              term.parentBusinessVersion
            );
            successCount++;
          } catch {
            failedCount++;
          }
        })
      );

      const processedCount = Math.min(i + BATCH_CONCURRENCY, total);
      setProgress(Math.round((processedCount / total) * 100));
    }

    const failedText =
      failedCount > 0
        ? `, ${t('label.failed-count', 'thất bại {{count}}', {
            count: failedCount,
          })}`
        : '';

    showSuccessToast(
      t(
        'message.bulk-action-completed',
        'Đã xử lý xong {{success}} bản ghi thành công{{failedText}}.',
        {
          success: successCount,
          failedText,
        }
      )
    );

    setIsProcessing(false);
    setProgress(0);
    setCurrentTermName('');
    onSuccess();
  }, [actionType, terms, onSuccess, t]);

  const handleModalClose = useCallback(() => {
    if (!isProcessing) {
      setProgress(0);
      setCurrentTermName('');
      onCancel();
    }
  }, [isProcessing, onCancel]);

  return (
    <ReviewActionConfirmModal
      action={CONFIRM_ACTIONS[actionType]}
      count={terms.length}
      hideActions={isProcessing}
      open={open}
      onCancel={handleModalClose}
      onConfirm={handleExecute}>
      {isProcessing && (
        <Space
          direction="vertical"
          size="middle"
          style={{ width: '100%', padding: '24px 0', textAlign: 'center' }}>
          <Typography.Text className="font-medium text-md">
            {t(
              'message.bulk-progress-processing',
              'Đang xử lý {{current}} / {{total}} bản ghi...',
              {
                current: Math.round((progress / 100) * terms.length),
                total: terms.length,
              }
            )}
          </Typography.Text>
          <Progress percent={progress} status="active" />
          <Typography.Text type="secondary">{currentTermName}</Typography.Text>
        </Space>
      )}
    </ReviewActionConfirmModal>
  );
};

export default GlossaryBulkActionModal;
