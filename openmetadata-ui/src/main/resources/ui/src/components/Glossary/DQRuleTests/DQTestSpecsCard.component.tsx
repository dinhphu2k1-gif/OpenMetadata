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

import { Button, Card, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import {
  DqTestSpec,
  DqTestSpecKind,
  DqTestSpecs,
} from '../../../generated/type/dqTestSpecs';

export interface DQTestSpecActions {
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

interface DQTestSpecsCardProps {
  specs?: DqTestSpecs;
  ruleThreshold?: string;
  /** Present when the viewer can change the declarations of this version. */
  actions?: DQTestSpecActions;
}

const SQL_PREVIEW_LENGTH = 80;

/** The test declarations of the Rule version being viewed. */
const DQTestSpecsCard = ({
  specs,
  ruleThreshold,
  actions,
}: DQTestSpecsCardProps) => {
  const { t } = useTranslation();
  const items = specs?.items ?? [];

  if (items.length === 0 && !actions) {
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
    ...(actions
      ? [
          {
            title: t('label.action-plural'),
            key: 'actions',
            width: 90,
            render: (_: unknown, __: DqTestSpec, index: number) => (
              <Space size={4}>
                <Tooltip title={t('dq.test.edit')}>
                  <Button
                    className="flex-center"
                    data-testid={`dq-test-edit-${index}`}
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                    onClick={() => actions.onEdit(index)}
                  />
                </Tooltip>
                <Tooltip title={t('dq.test.remove')}>
                  <Button
                    className="flex-center"
                    data-testid={`dq-test-remove-${index}`}
                    icon={<DeleteIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                    onClick={() => actions.onRemove(index)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      className="dq-test-specs-card"
      data-testid="dq-test-specs-card"
      extra={
        actions && (
          <Button
            data-testid="dq-test-add"
            size="small"
            type="primary"
            onClick={actions.onAdd}>
            {t('dq.test.add')}
          </Button>
        )
      }
      size="small"
      title={t('dq.test.title')}>
      <Table<DqTestSpec>
        columns={columns}
        dataSource={items}
        locale={{ emptyText: t('dq.test.empty') }}
        pagination={false}
        rowKey={(spec) => spec.key ?? spec.name}
        size="small"
      />
    </Card>
  );
};

export default DQTestSpecsCard;
