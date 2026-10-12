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

import { Typography } from 'antd';
import { ReactNode } from 'react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './dq-rule-test-results.less';

interface DQResultsEmptyStateProps {
  testId: string;
  title: string;
  description: string;
  steps?: string[];
  action?: ReactNode;
}

const DQResultsEmptyState = ({
  testId,
  title,
  description,
  steps,
  action,
}: DQResultsEmptyStateProps) => (
  <div className="dq-results-empty" data-testid={testId}>
    <ErrorPlaceHolder size={SIZE.MEDIUM} type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Typography.Title className="m-t-sm m-b-xs" level={5}>
        {title}
      </Typography.Title>
      <Typography.Paragraph className="dq-results-empty-description">
        {description}
      </Typography.Paragraph>
      {steps && (
        <ol className="dq-results-empty-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="dq-results-empty-step-index">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {action}
    </ErrorPlaceHolder>
  </div>
);

export default DQResultsEmptyState;
