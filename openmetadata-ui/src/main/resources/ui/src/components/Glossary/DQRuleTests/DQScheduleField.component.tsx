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

import { Alert, Input, Select, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { previewDqSchedule } from '../../../rest/dqRuleTestAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import {
  DQ_DEFAULT_TIMEZONE,
  DQ_SCHEDULE_PRESETS,
} from './DQRuleTests.constants';

export interface DQScheduleValue {
  cron?: string;
  timezone?: string;
}

interface DQScheduleFieldProps {
  value?: DQScheduleValue;
  onChange?: (value: DQScheduleValue) => void;
}

const NONE = 'none';
const CUSTOM = 'custom';
const PREVIEW_DEBOUNCE_MS = 300;
const NEXT_RUNS_SHOWN = 3;

const modeOf = (cron?: string) =>
  !cron
    ? NONE
    : DQ_SCHEDULE_PRESETS.find((preset) => preset.cron === cron)?.key ?? CUSTOM;

const describe = (cron?: string) => {
  try {
    return cron ? cronstrue.toString(cron) : '';
  } catch {
    return '';
  }
};

/** Form control of the run schedule of one test declaration. */
const DQScheduleField = ({ value, onChange }: DQScheduleFieldProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState(modeOf(value?.cron));
  const [nextRuns, setNextRuns] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const cron = value?.cron ?? '';
  const timezone = value?.timezone ?? DQ_DEFAULT_TIMEZONE;

  useEffect(() => {
    if (!cron) {
      setNextRuns([]);
      setError(undefined);

      return undefined;
    }
    const handle = setTimeout(() => {
      previewDqSchedule({ cron, timezone })
        .then((preview) => {
          setNextRuns(preview.nextRuns);
          setError(undefined);
        })
        .catch(() => {
          setNextRuns([]);
          setError(t('dq.test.schedule-invalid'));
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [cron, timezone, t]);

  const choose = (key: string) => {
    setMode(key);
    const preset = DQ_SCHEDULE_PRESETS.find((entry) => entry.key === key);
    onChange?.({
      cron: key === NONE ? undefined : preset?.cron ?? cron,
      timezone,
    });
  };

  const options = [
    { value: NONE, label: t('dq.test.schedule-none') },
    ...DQ_SCHEDULE_PRESETS.map((preset) => ({
      value: preset.key,
      label: t(`dq.test.schedule-${preset.key}`),
    })),
    { value: CUSTOM, label: t('dq.test.schedule-custom') },
  ];

  return (
    <Space
      className="dq-schedule-field w-full"
      data-testid="dq-schedule-field"
      direction="vertical"
      size="small">
      <Select
        className="w-full"
        data-testid="dq-schedule-mode"
        options={options}
        value={mode}
        onChange={choose}
      />
      {mode !== NONE && (
        <Input
          data-testid="dq-schedule-cron"
          disabled={mode !== CUSTOM}
          placeholder="0 2 * * *"
          status={error ? 'error' : undefined}
          value={cron}
          onChange={(event) =>
            onChange?.({ cron: event.target.value, timezone })
          }
        />
      )}
      {mode !== NONE && (
        <Input
          addonBefore={t('dq.test.timezone')}
          data-testid="dq-schedule-timezone"
          value={timezone}
          onChange={(event) =>
            onChange?.({ cron, timezone: event.target.value })
          }
        />
      )}
      {describe(cron) && (
        <Typography.Text type="secondary">{describe(cron)}</Typography.Text>
      )}
      {error && <Alert showIcon message={error} type="error" />}
      {nextRuns.length > 0 && (
        <Typography.Text data-testid="dq-schedule-next-runs" type="secondary">
          {t('dq.test.next-runs')}:{' '}
          {nextRuns.slice(0, NEXT_RUNS_SHOWN).map(formatDateTime).join(' · ')}
        </Typography.Text>
      )}
    </Space>
  );
};

export default DQScheduleField;
