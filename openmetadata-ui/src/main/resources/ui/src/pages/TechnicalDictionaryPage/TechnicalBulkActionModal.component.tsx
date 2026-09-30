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
  Alert,
  Button,
  List,
  Modal,
  Progress,
  Radio,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  runTechnicalBulkWorkflow,
  TechnicalBulkAction,
  TechnicalBulkResult,
} from '../../rest/technicalDictionaryAPI';
import {
  TechnicalDictionaryCapabilities,
  TechnicalDictionaryFilters,
} from './technicalDictionary.interface';
import {
  BulkOutcome,
  buildBulkCriteria,
  runBulkUntilDone,
} from './TechnicalBulkRunner';

type BulkScope = 'selected' | 'filtered';

interface TechnicalBulkActionModalProps {
  open: boolean;
  glossaryId: string;
  businessVersion: string;
  capabilities: TechnicalDictionaryCapabilities;
  filters: TechnicalDictionaryFilters;
  selectedTermIds: string[];
  onClose: () => void;
  onDone: () => void;
}

const allowedActions = (
  capabilities: TechnicalDictionaryCapabilities
): TechnicalBulkAction[] => [
  ...(capabilities.canSubmit ? (['submit'] as const) : []),
  ...(capabilities.canApprove ? (['approve'] as const) : []),
  ...(capabilities.canReject ? (['reject'] as const) : []),
];

const TechnicalBulkActionModal = ({
  open,
  glossaryId,
  businessVersion,
  capabilities,
  filters,
  selectedTermIds,
  onClose,
  onDone,
}: TechnicalBulkActionModalProps) => {
  const { t } = useTranslation();
  const actions = useMemo(() => allowedActions(capabilities), [capabilities]);
  const [action, setAction] = useState<TechnicalBulkAction>(actions[0]);
  const [scope, setScope] = useState<BulkScope>(
    selectedTermIds.length > 0 ? 'selected' : 'filtered'
  );
  const [preview, setPreview] = useState<TechnicalBulkResult>();
  const [outcome, setOutcome] = useState<BulkOutcome>();
  const [isBusy, setIsBusy] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (open) {
      setAction(actions[0]);
      setScope(selectedTermIds.length > 0 ? 'selected' : 'filtered');
      setPreview(undefined);
      setOutcome(undefined);
      cancelled.current = false;
    }
  }, [open, actions, selectedTermIds.length]);

  const request = useMemo(
    () => ({
      glossaryId,
      parentBusinessVersion: businessVersion,
      ...(scope === 'selected'
        ? { termIds: selectedTermIds }
        : { criteria: buildBulkCriteria(filters) }),
    }),
    [businessVersion, filters, glossaryId, scope, selectedTermIds]
  );

  const handlePreview = useCallback(async () => {
    setIsBusy(true);
    try {
      setPreview(
        await runTechnicalBulkWorkflow(action, { ...request, dryRun: true })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
    }
  }, [action, request]);

  const handleRun = useCallback(async () => {
    setIsBusy(true);
    cancelled.current = false;
    try {
      setOutcome(
        await runBulkUntilDone(
          action,
          request,
          setOutcome,
          () => cancelled.current
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
      onDone();
    }
  }, [action, onDone, request]);

  const handleClose = () => {
    cancelled.current = true;
    onClose();
  };

  const percent =
    outcome && outcome.eligible > 0
      ? Math.floor(
          ((outcome.succeeded + outcome.failed) / outcome.eligible) * 100
        )
      : 0;

  return (
    <Modal
      destroyOnClose
      data-testid="technical-bulk-modal"
      footer={
        <Space>
          <Button onClick={handleClose}>{t('label.close')}</Button>
          <Button
            data-testid="technical-bulk-preview"
            disabled={isBusy || outcome !== undefined}
            onClick={handlePreview}>
            {t('label.preview')}
          </Button>
          <Button
            danger={action === 'reject'}
            data-testid="technical-bulk-run"
            disabled={
              !preview || preview.eligible === 0 || outcome !== undefined
            }
            loading={isBusy && preview !== undefined}
            type="primary"
            onClick={handleRun}>
            {t('label.apply')}
          </Button>
        </Space>
      }
      open={open}
      title={t('label.bulk-actions')}
      width={640}
      onCancel={handleClose}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Radio.Group
          disabled={isBusy || outcome !== undefined}
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPreview(undefined);
          }}>
          {actions.map((item) => (
            <Radio.Button key={item} value={item}>
              {t(`label.bulk-${item}`)}
            </Radio.Button>
          ))}
        </Radio.Group>
        <Radio.Group
          disabled={isBusy || outcome !== undefined}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            setPreview(undefined);
          }}>
          <Space direction="vertical">
            <Radio disabled={selectedTermIds.length === 0} value="selected">
              {t('label.bulk-scope-selected', {
                count: selectedTermIds.length,
              })}
            </Radio>
            <Radio value="filtered">{t('label.bulk-scope-filtered')}</Radio>
          </Space>
        </Radio.Group>
        {preview && !outcome && (
          <Alert
            showIcon
            data-testid="technical-bulk-preview-result"
            message={t('message.technical-bulk-preview', {
              matched: preview.matched,
              eligible: preview.eligible,
              ineligible: preview.ineligible,
            })}
            type={preview.eligible > 0 ? 'info' : 'warning'}
          />
        )}
        {outcome && (
          <>
            <Progress percent={Math.min(percent, 100)} />
            <Alert
              showIcon
              data-testid="technical-bulk-outcome"
              message={t('message.technical-bulk-outcome', {
                succeeded: outcome.succeeded,
                failed: outcome.failed,
              })}
              type={outcome.failed > 0 ? 'warning' : 'success'}
            />
            {outcome.failures.length > 0 && (
              <List
                bordered
                dataSource={outcome.failures}
                renderItem={(failure) => (
                  <List.Item>
                    <Typography.Text code>{failure.code}</Typography.Text>{' '}
                    {failure.message}
                  </List.Item>
                )}
                size="small"
                style={{ maxHeight: 200, overflow: 'auto' }}
              />
            )}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default TechnicalBulkActionModal;
