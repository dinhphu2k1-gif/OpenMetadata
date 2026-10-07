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
import { Button } from '@openmetadata/ui-core-components';
import { Modal } from 'antd';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './review-action-confirm-modal.less';

export type ReviewConfirmAction = 'submit' | 'approve' | 'reject' | 'withdraw';

export interface ReviewActionConfirmModalProps {
  open: boolean;
  action: ReviewConfirmAction;
  /** Records the action is about; fills the default question. */
  count?: number;
  /** Replaces the default question, for a single record or a different wording. */
  message?: ReactNode;
  /** Shown under the question, for example a progress bar while the action runs. */
  children?: ReactNode;
  isLoading?: boolean;
  /** Hides Cancel and Confirm, while the action is running. */
  hideActions?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const TITLE_KEYS: Record<ReviewConfirmAction, string> = {
  submit: 'label.review-confirm-submit',
  approve: 'label.review-confirm-approve',
  reject: 'label.review-confirm-reject',
  withdraw: 'label.review-confirm-withdraw',
};

const MESSAGE_KEYS: Record<ReviewConfirmAction, string> = {
  submit: 'message.review-confirm-submit',
  approve: 'message.review-confirm-approve',
  reject: 'message.review-confirm-reject',
  withdraw: 'message.review-confirm-withdraw',
};

/**
 * The confirmation shown before records or a glossary are submitted for approval, approved or
 * rejected: a title that names the action, a question, and Cancel and Confirm at the bottom right.
 */
const ReviewActionConfirmModal = ({
  open,
  action,
  count = 0,
  message,
  children,
  isLoading = false,
  hideActions = false,
  onCancel,
  onConfirm,
}: ReviewActionConfirmModalProps) => {
  const { t } = useTranslation();
  const busy = isLoading || hideActions;
  const defaultQuestion = count > 0 ? t(MESSAGE_KEYS[action], { count }) : null;
  const question = hideActions ? null : message ?? defaultQuestion;

  return (
    <Modal
      centered
      destroyOnClose
      className="review-action-confirm-modal"
      closable={!busy}
      data-testid="confirmation-modal"
      footer={
        hideActions ? null : (
          <div className="review-action-confirm-footer">
            <Button
              color="secondary"
              data-testid="cancel"
              isDisabled={isLoading}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color={action === 'reject' ? 'primary-destructive' : 'primary'}
              data-testid="save-button"
              isLoading={isLoading}
              onPress={onConfirm}>
              {t('label.confirm')}
            </Button>
          </div>
        )
      }
      maskClosable={!busy}
      open={open}
      title={<span data-testid="modal-header">{t(TITLE_KEYS[action])}</span>}
      width={520}
      onCancel={onCancel}>
      {question && (
        <p className="review-action-confirm-message" data-testid="body-text">
          {question}
        </p>
      )}
      {children}
    </Modal>
  );
};

export default ReviewActionConfirmModal;
