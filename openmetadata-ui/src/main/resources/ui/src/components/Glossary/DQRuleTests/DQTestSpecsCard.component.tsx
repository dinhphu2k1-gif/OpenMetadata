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

import { Card, Table, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { useTranslation } from 'react-i18next';
import {
  DqTestSpec,
  DqTestSpecKind,
  DqTestSpecs,
} from '../../../generated/type/dqTestSpecs';

interface DQTestSpecsCardProps {
  specs?: DqTestSpecs;
  ruleThreshold?: string;
}

const SQL_PREVIEW_LENGTH = 80;

/** Read-only list of the test declarations of the Rule version being viewed. */
const DQTestSpecsCard = ({ specs, ruleThreshold }: DQTestSpecsCardProps) => {
  const { t } = useTranslation();
  const items = specs?.items ?? [];

  if (items.length === 0) {
    return null;
  }

  const columns: ColumnsType<DqTestSpec> = [
    { title: t('dq.test.name'), dataIndex: 'name' },
    {
      title: t('dq.test.kind'),
      dataIndex: 'kind',
      render: (kind: DqTestSpecKind) => (
        <Tag>
          {kind === DqTestSpecKind.SQL
            ? t('dq.test.kind-sql')
            : t('dq.test.kind-library')}
        </Tag>
      ),
    },
    {
      title: t('dq.test.definition'),
      render: (_, spec) =>
        spec.kind === DqTestSpecKind.SQL ? (
          <code>
            {(spec.sqlExpression ?? '').slice(0, SQL_PREVIEW_LENGTH)}
            {(spec.sqlExpression ?? '').length > SQL_PREVIEW_LENGTH ? '…' : ''}
          </code>
        ) : (
          spec.testDefinitionFqn
        ),
    },
    {
      title: t('dq.test.effective-threshold'),
      render: (_, spec) => spec.threshold ?? ruleThreshold ?? '-',
    },
  ];

  return (
    <Card
      className="dq-test-specs-card"
      data-testid="dq-test-specs-card"
      size="small"
      title={t('dq.test.title')}>
      <Table<DqTestSpec>
        columns={columns}
        dataSource={items}
        pagination={false}
        rowKey={(spec) => spec.key ?? spec.name}
        size="small"
      />
    </Card>
  );
};

export default DQTestSpecsCard;
