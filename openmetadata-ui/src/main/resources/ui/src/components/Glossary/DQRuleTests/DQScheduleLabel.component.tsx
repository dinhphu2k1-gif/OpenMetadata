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

import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { DQ_SCHEDULE_PRESETS } from './DQRuleTests.constants';

/** The schedule of a test declaration in words when it is a preset, else its cron expression. */
const DQScheduleLabel = ({ cron }: { cron?: string }) => {
  const { t } = useTranslation();
  const preset = DQ_SCHEDULE_PRESETS.find((item) => item.cron === cron);

  return cron ? (
    <Tooltip title={cron}>
      <span data-testid="dq-test-schedule">
        {preset ? t(`dq.test.schedule-${preset.key}`) : <code>{cron}</code>}
      </span>
    </Tooltip>
  ) : (
    <span data-testid="dq-test-schedule">{t('dq.test.schedule-none')}</span>
  );
};

export default DQScheduleLabel;
