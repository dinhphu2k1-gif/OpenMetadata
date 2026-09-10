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

import { Button, Modal, Progress, Space, Typography } from 'antd';
import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import { patchGlossaryTerm } from '../../../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';

export type BulkActionType = 'submitForReview' | 'approve' | 'reject' | 'revoke';

export interface GlossaryBulkActionModalProps {
  actionType: BulkActionType;
  open: boolean;
  terms: ModifiedGlossaryTerm[];
  onCancel: () => void;
  onSuccess: () => void;
}

const BATCH_CONCURRENCY = 5;

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

  const modalTitle = {
    submitForReview: t(
      'message.confirm-bulk-submit-title',
      'Xác nhận gửi phê duyệt hàng loạt'
    ),
    approve: t(
      'message.confirm-bulk-approve-title',
      'Xác nhận phê duyệt hàng loạt'
    ),
    reject: t(
      'message.confirm-bulk-reject-title',
      'Xác nhận từ chối hàng loạt'
    ),
    revoke: t(
      'message.confirm-bulk-revoke-title',
      'Xác nhận hủy duyệt hàng loạt'
    ),
  }[actionType];

  const modalDescription = {
    submitForReview: t(
      'message.confirm-bulk-submit-desc',
      'Bạn có chắc chắn muốn gửi phê duyệt {{count}} bản ghi đang ở trạng thái Bản nháp sang trạng thái Chờ duyệt?',
      { count: terms.length }
    ),
    approve: t(
      'message.confirm-bulk-approve-desc',
      'Bạn có chắc chắn muốn phê duyệt {{count}} bản ghi đang ở trạng thái Chờ duyệt sang trạng thái Đã duyệt?',
      { count: terms.length }
    ),
    reject: t(
      'message.confirm-bulk-reject-desc',
      'Bạn có chắc chắn muốn từ chối {{count}} bản ghi đang ở trạng thái Chờ duyệt? Các bản ghi này sẽ được chuyển về trạng thái Bản nháp để người đề xuất chỉnh sửa lại.',
      { count: terms.length }
    ),
    revoke: t(
      'message.confirm-bulk-revoke-desc',
      'Bạn có chắc chắn muốn hủy duyệt {{count}} bản ghi đang ở trạng thái Đã duyệt? Các bản ghi này sẽ được chuyển về trạng thái Bản nháp để người đề xuất chỉnh sửa lại.',
      { count: terms.length }
    ),
  }[actionType];

  const handleExecute = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);

    const targetStatus =
      actionType === 'submitForReview'
        ? EntityStatus.InReview
        : actionType === 'approve'
        ? EntityStatus.Approved
        : EntityStatus.Draft;

    let successCount = 0;
    let failedCount = 0;
    const total = terms.length;

    for (let i = 0; i < total; i += BATCH_CONCURRENCY) {
      const chunk = terms.slice(i, i + BATCH_CONCURRENCY);
      await Promise.all(
        chunk.map(async (term) => {
          try {
            setCurrentTermName(term.displayName || term.name || '');
            const patch = [
              {
                op: 'replace',
                path: '/entityStatus',
                value: targetStatus,
              },
            ];

            await patchGlossaryTerm(term.id, patch);
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
      t('message.bulk-action-completed', 'Đã xử lý xong {{success}} bản ghi thành công{{failedText}}.', {
        success: successCount,
        failedText,
      })
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
    <Modal
      centered
      closable={!isProcessing}
      data-testid="glossary-bulk-action-modal"
      destroyOnClose
      footer={
        isProcessing
          ? null
          : [
              <Button key="cancel" onClick={handleModalClose}>
                {t('label.cancel', 'Hủy')}
              </Button>,
              <Button
                danger={actionType === 'reject' || actionType === 'revoke'}
                key="confirm"
                type="primary"
                onClick={handleExecute}>
                {actionType === 'revoke'
                  ? t('label.revoke-approval', 'Hủy duyệt')
                  : t('label.confirm', 'Xác nhận')}
              </Button>,
            ]
      }
      maskClosable={!isProcessing}
      open={open}
      title={modalTitle}
      onCancel={handleModalClose}>
      {isProcessing ? (
        <Space direction="vertical" size="middle" style={{ width: '100%', padding: '24px 0', textAlign: 'center' }}>
          <Typography.Text className="font-medium text-md">
            {t('message.bulk-progress-processing', 'Đang xử lý {{current}} / {{total}} bản ghi...', {
              current: Math.round((progress / 100) * terms.length),
              total: terms.length,
            })}
          </Typography.Text>
          <Progress percent={progress} status="active" />
          <Typography.Text type="secondary">
            {currentTermName}
          </Typography.Text>
        </Space>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text>{modalDescription}</Typography.Text>

          <div
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              backgroundColor: '#fafafa',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #f0f0f0',
            }}>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {terms.map((term) => (
                <li key={term.id || term.fullyQualifiedName}>
                  <strong>{term.name}</strong>
                  {term.displayName && term.displayName !== term.name
                    ? ` (${term.displayName})`
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        </Space>
      )}
    </Modal>
  );
};

export default GlossaryBulkActionModal;
