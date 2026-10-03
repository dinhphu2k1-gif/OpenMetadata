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

import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DQ_OUTCOME_COLOR,
  DQ_OUTCOME_LABEL_KEY,
} from './DQRuleTests.constants';
import { DQRuleStatus } from './DQRuleTests.interface';

interface DQOutcomeTagProps {
  status: DQRuleStatus;
}

const DQOutcomeTag = ({ status }: DQOutcomeTagProps) => {
  const { t } = useTranslation();

  return (
    <Tag color={DQ_OUTCOME_COLOR[status]} data-testid={`dq-outcome-${status}`}>
      {t(DQ_OUTCOME_LABEL_KEY[status])}
    </Tag>
  );
};

export default DQOutcomeTag;
