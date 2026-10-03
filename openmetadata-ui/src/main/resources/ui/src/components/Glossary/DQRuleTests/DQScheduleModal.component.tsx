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

import { Alert, Button, Input, Modal, Radio, Space } from 'antd';
import cronstrue from 'cronstrue';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { previewDqSchedule } from '../../../rest/dqRuleTestAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import {
  DQ_DEFAULT_TIMEZONE,
  DQ_SCHEDULE_PRESETS,
} from './DQRuleTests.constants';
import { DQSchedule } from './DQRuleTests.interface';

interface DQScheduleModalProps {
  open: boolean;
  schedule?: DQSchedule;
  onCancel: () => void;
  onSave: (cron: string | null, timezone: string) => Promise<void>;
}

const NONE = 'none';
const CUSTOM = 'custom';

const presetOf = (cron: string | null) =>
  cron === null
    ? NONE
    : DQ_SCHEDULE_PRESETS.find((preset) => preset.cron === cron)?.key ?? CUSTOM;

const DQScheduleModal = ({
  open,
  schedule,
  onCancel,
  onSave,
}: DQScheduleModalProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<string>(NONE);
  const [cron, setCron] = useState('');
  const [timezone, setTimezone] = useState(DQ_DEFAULT_TIMEZONE);
  const [nextRuns, setNextRuns] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const current = schedule?.cron ?? null;
      setMode(presetOf(current));
      setCron(current ?? '');
      setTimezone(schedule?.timezone ?? DQ_DEFAULT_TIMEZONE);
      setNextRuns(schedule?.nextRuns ?? []);
      setError(undefined);
    }
  }, [open, schedule]);

  const effectiveCron = mode === NONE ? null : cron.trim();

  useEffect(() => {
    if (!open) {
      return;
    }
    if (effectiveCron === null) {
      setNextRuns([]);
      setError(undefined);

      return;
    }
    const handle = setTimeout(() => {
      previewDqSchedule({ cron: effectiveCron, timezone })
        .then((preview) => {
          setNextRuns(preview.nextRuns);
          setError(undefined);
        })
        .catch(() => {
          setNextRuns([]);
          setError(t('dq.test.schedule-invalid'));
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [open, effectiveCron, timezone, t]);

  const choose = (key: string) => {
    setMode(key);
    const preset = DQ_SCHEDULE_PRESETS.find((entry) => entry.key === key);
    if (preset) {
      setCron(preset.cron);
    }
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(effectiveCron, timezone);
    } finally {
      setIsSaving(false);
    }
  };

  const describe = () => {
    try {
      return effectiveCron ? cronstrue.toString(effectiveCron) : '';
    } catch {
      return '';
    }
  };

  return (
    <Modal
      destroyOnClose
      data-testid="dq-schedule-modal"
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="dq-schedule-save"
          disabled={Boolean(error) || (mode !== NONE && !effectiveCron)}
          key="save"
          loading={isSaving}
          type="primary"
          onClick={save}>
          {t('label.save')}
        </Button>,
      ]}
      open={open}
      title={t('dq.test.change-schedule')}
      onCancel={onCancel}>
      <Space className="dq-schedule-form" direction="vertical" size="middle">
        <Radio.Group
          value={mode}
          onChange={(event) => choose(event.target.value)}>
          <Space direction="vertical">
            <Radio value={NONE}>{t('dq.test.schedule-none')}</Radio>
            {DQ_SCHEDULE_PRESETS.map((preset) => (
              <Radio key={preset.key} value={preset.key}>
                {t(`dq.test.schedule-${preset.key}`)}
              </Radio>
            ))}
            <Radio value={CUSTOM}>{t('dq.test.schedule-custom')}</Radio>
          </Space>
        </Radio.Group>
        {mode !== NONE && (
          <Input
            data-testid="dq-schedule-cron"
            disabled={mode !== CUSTOM}
            placeholder="0 2 * * *"
            status={error ? 'error' : undefined}
            value={cron}
            onChange={(event) => setCron(event.target.value)}
          />
        )}
        <Input
          addonBefore={t('dq.test.timezone')}
          data-testid="dq-schedule-timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
        {describe() && <span>{describe()}</span>}
        {error && <Alert showIcon message={error} type="error" />}
        {nextRuns.length > 0 && (
          <div data-testid="dq-schedule-next-runs">
            <strong>{t('dq.test.next-runs')}</strong>
            <ul>
              {nextRuns.map((run) => (
                <li key={run}>{formatDateTime(run)}</li>
              ))}
            </ul>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default DQScheduleModal;
