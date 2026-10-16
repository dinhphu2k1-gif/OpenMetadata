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

import { BookOpen01, Code02, Lock01 } from '@untitledui/icons';
import { Radio, RadioChangeEvent } from 'antd';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DqTestSpecKind } from '../../../generated/type/dqTestSpecs';

interface DQTestKindFieldProps {
  value?: DqTestSpecKind;
  onChange?: (event: RadioChangeEvent) => void;
  disabled?: boolean;
}

const KIND_OPTIONS: {
  kind: DqTestSpecKind;
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
}[] = [
  {
    kind: DqTestSpecKind.Library,
    icon: BookOpen01,
    titleKey: 'dq.test.kind-library-title',
    descriptionKey: 'dq.test.kind-library-description',
  },
  {
    kind: DqTestSpecKind.SQL,
    icon: Code02,
    titleKey: 'dq.test.kind-sql-title',
    descriptionKey: 'dq.test.kind-sql-description',
  },
];

/** "Cách kiểm tra" as two described option cards; locked once the test has produced test cases. */
const DQTestKindField = ({
  value,
  onChange,
  disabled = false,
}: DQTestKindFieldProps) => {
  const { t } = useTranslation();

  return (
    <div className="dq-test-kind-field">
      <Radio.Group
        className="dq-test-kind-options"
        data-testid="dq-test-kind"
        disabled={disabled}
        value={value}
        onChange={onChange}>
        {KIND_OPTIONS.map(({ kind, icon: Icon, titleKey, descriptionKey }) => (
          <Radio
            className="dq-test-kind-option"
            data-testid={`dq-test-kind-${kind}`}
            key={kind}
            value={kind}>
            <span className="dq-test-kind-option-title">
              <Icon className="dq-test-kind-option-icon" />
              {t(titleKey)}
            </span>
            <span className="dq-test-kind-option-description">
              {t(descriptionKey)}
            </span>
          </Radio>
        ))}
      </Radio.Group>
      {disabled && (
        <span className="dq-test-kind-locked" data-testid="dq-test-kind-locked">
          <Lock01 className="dq-test-kind-locked-icon" />
          {t('dq.test.definition-locked')}
        </span>
      )}
    </div>
  );
};

export default DQTestKindField;
