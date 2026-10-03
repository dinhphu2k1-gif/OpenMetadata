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

import { Alert, Button, Card, Modal, Select, Space, Table, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getDqCdeResults,
  getDqCdeTrend,
  runDqRuleTests,
} from '../../../rest/dqRuleTestAPI';
import {
  getGlossaryTermDetailsPath,
  getTestCaseDetailPagePath,
} from '../../../utils/RouterUtils';
import { EntityTabs } from '../../../enums/entity.enum';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import {
  DQ_OUTCOMES,
  DQ_OUTCOME_LABEL_KEY,
  DQ_RESULT_PAGE_SIZE,
  DQ_TREND_PERIODS,
} from './DQRuleTests.constants';
import {
  DQCdeResults,
  DQCdeRuleRow,
  DQTestCapabilities,
  DQTestCaseRow,
  DQTrend,
} from './DQRuleTests.interface';
import DQOutcomeTag from './DQOutcomeTag.component';
import DQTrendChart from './DQTrendChart.component';

interface DQCdeTestResultsProps {
  cdeId: string;
  capabilities?: DQTestCapabilities;
}

const DQCdeTestResults = ({ cdeId, capabilities }: DQCdeTestResultsProps) => {
  const { t } = useTranslation();
  const [results, setResults] = useState<DQCdeResults>();
  const [trend, setTrend] = useState<DQTrend>();
  const [isLoading, setIsLoading] = useState(true);
  const [ruleFilter, setRuleFilter] = useState<string>();
  const [outcomeFilter, setOutcomeFilter] = useState<string>();
  const [page, setPage] = useState(1);
  const [trendDays, setTrendDays] = useState(DQ_TREND_PERIODS[0]);

  const load = useCallback(async () => {
    try {
      const [resultData, trendData] = await Promise.all([
        getDqCdeResults(cdeId, {
          ruleId: ruleFilter,
          result: outcomeFilter,
          offset: (page - 1) * DQ_RESULT_PAGE_SIZE,
          limit: DQ_RESULT_PAGE_SIZE,
        }),
        getDqCdeTrend(cdeId, trendDays),
      ]);
      setResults(resultData);
      setTrend(trendData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [cdeId, ruleFilter, outcomeFilter, page, trendDays]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const runRule = (rule: DQCdeRuleRow) =>
    Modal.confirm({
      title: t('dq.test.run-confirm', {
        specs: rule.specs,
        columns: rule.columns,
        code: rule.code,
      }),
      onOk: async () => {
        try {
          await runDqRuleTests(rule.id);
          showSuccessToast(t('dq.test.run-started'));
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      },
    });

  if (isLoading && !results) {
    return <Loader />;
  }

  if (!results) {
    return null;
  }

  const ruleColumns: ColumnsType<DQCdeRuleRow> = [
    {
      title: t('dq.rule-code'),
      render: (_, rule) =>
        rule.fullyQualifiedName ? (
          <Link
            to={getGlossaryTermDetailsPath(
              rule.fullyQualifiedName,
              EntityTabs.DATA_OBSERVABILITY
            )}>
            {rule.code}
          </Link>
        ) : (
          rule.code
        ),
    },
    { title: t('dq.rule-name'), dataIndex: 'displayName' },
    {
      title: t('dq.dimension'),
      dataIndex: 'dimension',
      render: (value?: string) => value?.split('.').slice(-1)[0],
    },
    { title: t('dq.quality-threshold'), dataIndex: 'threshold' },
    {
      title: t('dq.test.schedule'),
      dataIndex: 'cron',
      render: (value?: string) => value ?? t('dq.test.no-schedule-short'),
    },
    { title: t('dq.test.column.tests'), dataIndex: 'specs' },
    { title: t('dq.test.column.columns'), dataIndex: 'columns' },
    {
      title: t('dq.test.column.passed-failed'),
      render: (_, rule) => `${rule.summary.passed}/${rule.summary.failed}`,
    },
    {
      title: t('dq.test.column.result'),
      render: (_, rule) => <DQOutcomeTag status={rule.status} />,
    },
    {
      title: t('dq.test.last-run'),
      render: (_, rule) =>
        rule.summary.lastRunAt ? formatDateTime(rule.summary.lastRunAt) : '',
    },
    {
      title: '',
      render: (_, rule) =>
        capabilities?.canRun ? (
          <Button
            data-testid={`dq-cde-run-${rule.code}`}
            disabled={rule.summary.applied === 0}
            size="small"
            onClick={() => runRule(rule)}>
            {t('dq.test.run-now')}
          </Button>
        ) : null,
    },
  ];

  const testColumns: ColumnsType<DQTestCaseRow> = [
    { title: t('dq.rule-code'), dataIndex: 'ruleCode' },
    { title: t('dq.test.column.test'), dataIndex: ['spec', 'name'] },
    {
      title: t('dq.test.column.column'),
      render: (_, row) => row.column.fqn.split('.').slice(-1)[0],
    },
    {
      title: t('dq.test.column.table'),
      render: (_, row) => `${row.column.service}.${row.column.table}`,
    },
    {
      title: t('dq.test.column.result'),
      render: (_, row) => <DQOutcomeTag status={row.thresholdResult} />,
    },
    { title: t('dq.test.column.native'), dataIndex: 'nativeStatus' },
    {
      title: t('dq.test.column.pass-rate'),
      dataIndex: 'passedRowsPercentage',
      render: (value?: number | null) =>
        value == null ? '' : `${value.toFixed(2)}%`,
    },
    { title: t('dq.test.column.violations'), dataIndex: 'failedRows' },
    {
      title: t('dq.test.column.at'),
      dataIndex: 'timestamp',
      render: (value?: number | null) => (value ? formatDateTime(value) : ''),
    },
    {
      title: '',
      render: (_, row) =>
        row.testCaseFqn ? (
          <Link to={getTestCaseDetailPagePath(row.testCaseFqn)}>
            {t('dq.test.open-test-case')}
          </Link>
        ) : null,
    },
  ];

  const { summary } = results;

  return (
    <div className="dq-cde-test-results" data-testid="dq-cde-test-results">
      <Card size="small">
        <Space wrap>
          <Tag>{t('dq.test.cde.rules', { count: summary.rules })}</Tag>
          <Tag>
            {t('dq.test.cde.rules-with-tests', {
              count: summary.rulesWithTests,
            })}
          </Tag>
          {Object.entries(summary.rulesByStatus).map(([status, count]) => (
            <Tag key={status}>
              {t(
                DQ_OUTCOME_LABEL_KEY[
                  status as keyof typeof DQ_OUTCOME_LABEL_KEY
                ]
              )}
              : {count}
            </Tag>
          ))}
          <Tag>{t('dq.test.cde.test-cases', { count: summary.testCases })}</Tag>
          {summary.passRate != null && (
            <Tag color={summary.passRate >= 1 ? 'success' : 'warning'}>
              {Math.round(summary.passRate * 100)}%
            </Tag>
          )}
        </Space>
      </Card>

      <div className="dq-cde-test-trend">
        <Space>
          <strong>{t('dq.test.trend')}</strong>
          {DQ_TREND_PERIODS.map((days) => (
            <Tag.CheckableTag
              checked={trendDays === days}
              key={days}
              onChange={() => setTrendDays(days)}>
              {t('dq.test.days', { count: days })}
            </Tag.CheckableTag>
          ))}
        </Space>
        <DQTrendChart trend={trend} />
      </div>

      <div className="dq-cde-test-dimensions" data-testid="dq-cde-dimensions">
        <strong>{t('dq.test.cde.by-dimension')}: </strong>
        {results.dimensions.map((dimension) => (
          <Tag key={dimension.dimension ?? 'none'}>
            {(dimension.dimension ?? '-').split('.').slice(-1)[0]}:{' '}
            {Math.round(dimension.passRate * 100)}% ({dimension.passedRules}/
            {dimension.rules})
          </Tag>
        ))}
      </div>

      <h4>{t('dq.test.cde.rules-table')}</h4>
      <Table<DQCdeRuleRow>
        columns={ruleColumns}
        dataSource={results.rules}
        pagination={false}
        rowKey="id"
        size="small"
      />

      <h4>{t('dq.test.cde.test-cases-table')}</h4>
      <Space wrap className="dq-cde-test-filters">
        <Select
          allowClear
          data-testid="dq-cde-rule-filter"
          options={results.rules.map((rule) => ({
            value: rule.id,
            label: rule.code,
          }))}
          placeholder={t('dq.test.filter-rule')}
          style={{ minWidth: 160 }}
          value={ruleFilter}
          onChange={(value) => {
            setRuleFilter(value);
            setPage(1);
          }}
        />
        <Select
          allowClear
          data-testid="dq-cde-outcome-filter"
          options={DQ_OUTCOMES.map((outcome) => ({
            value: outcome,
            label: t(DQ_OUTCOME_LABEL_KEY[outcome]),
          }))}
          placeholder={t('dq.test.filter-result')}
          style={{ minWidth: 160 }}
          value={outcomeFilter}
          onChange={(value) => {
            setOutcomeFilter(value);
            setPage(1);
          }}
        />
      </Space>
      {results.hiddenTestCases > 0 && (
        <Alert
          showIcon
          message={t('dq.test.hidden', { count: results.hiddenTestCases })}
          type="info"
        />
      )}
      <Table<DQTestCaseRow>
        columns={testColumns}
        dataSource={results.testCases}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: DQ_RESULT_PAGE_SIZE,
          total: results.paging.total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        rowKey={(row) => `${row.ruleId}-${row.spec.key}-${row.column.fqn}`}
        size="small"
      />
    </div>
  );
};

export default DQCdeTestResults;
