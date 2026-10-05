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
  Card,
  Col,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as AllTestsIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as ChecklistIcon } from '../../../assets/svg/ic-checklist.svg';
import { ReactComponent as PlayIcon } from '../../../assets/svg/ic-play.svg';
import {
  GREEN_3,
  GREY_200,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
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
import {
  calculatePercentage,
  formatNumberWithComma,
} from '../../../utils/NumberUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import SummaryPieChartCard from '../../DataQuality/SummaryPannel/SummaryPieChartCard/SummaryPieChartCard.component';
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
import DQScheduleLabel from './DQScheduleLabel.component';
import { localizeDqMessage, normalizeDqThreshold } from './DQRuleTests.utils';
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
      render: (value?: string) => value?.split('.').slice(-1)[0] ?? '--',
    },
    {
      title: t('dq.quality-threshold'),
      dataIndex: 'threshold',
      render: (value?: string) => normalizeDqThreshold(value) ?? '--',
    },
    {
      title: t('dq.test.schedule'),
      dataIndex: 'cron',
      render: (value?: string | null) =>
        value ? (
          <Space direction="vertical" size={0}>
            {value.split('; ').map((cron) => (
              <DQScheduleLabel cron={cron} key={cron} />
            ))}
          </Space>
        ) : (
          <DQScheduleLabel />
        ),
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
        rule.summary.lastRunAt ? formatDateTime(rule.summary.lastRunAt) : '--',
    },
    {
      title: t('label.action-plural'),
      key: 'actions',
      render: (_, rule) =>
        capabilities?.canRun ? (
          <Button
            data-testid={`dq-cde-run-${rule.code}`}
            disabled={rule.summary.applied === 0}
            icon={<PlayIcon className="dq-run-icon" />}
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
      render: (_, row) =>
        row.state === 'ACTIVE' ? (
          <DQOutcomeTag status={row.thresholdResult} />
        ) : (
          t(
            row.state === 'ERROR'
              ? 'dq.test.state-error'
              : 'dq.test.not-applicable'
          )
        ),
    },
    {
      title: t('dq.test.column.pass-rate'),
      dataIndex: 'passedRowsPercentage',
      render: (value?: number | null) =>
        value == null ? '--' : `${value.toFixed(2)}%`,
    },
    {
      title: t('dq.test.column.violations'),
      dataIndex: 'failedRows',
      align: 'right',
      render: (value?: number | null) =>
        value == null ? '--' : formatNumberWithComma(value),
    },
    {
      title: t('dq.test.column.at'),
      dataIndex: 'timestamp',
      render: (value?: number | null) => (value ? formatDateTime(value) : '--'),
    },
    {
      title: t('dq.test.column.reason'),
      width: 260,
      render: (_, row) => {
        const text = row.lastError ?? row.resultMessage ?? '';

        return text ? (
          <Typography.Text
            ellipsis={{ tooltip: localizeDqMessage(t, text, row) }}
            type={row.thresholdResult === 'PASSED' ? 'secondary' : 'danger'}>
            {localizeDqMessage(t, text, row)}
          </Typography.Text>
        ) : (
          '--'
        );
      },
    },
    {
      title: t('label.action-plural'),
      key: 'actions',
      render: (_, row) =>
        row.testCaseFqn ? (
          <Link to={getTestCaseDetailPagePath(row.testCaseFqn)}>
            {t('dq.test.open-test-case')}
          </Link>
        ) : (
          '--'
        ),
    },
  ];

  const { summary } = results;
  const byStatus = summary.rulesByStatus;
  const rulesWithResult = summary.rulesWithTests;
  const passedRules = byStatus.PASSED ?? 0;

  return (
    <div
      className="dq-rule-test-results dq-tests-tab"
      data-testid="dq-cde-test-results">
      <Row gutter={[16, 16]}>
        <Col md={8} xs={24}>
          <SummaryPieChartCard
            showLegends
            chartData={[
              {
                name: t('dq.test.status.passed'),
                value: passedRules,
                color: GREEN_3,
              },
              {
                name: t('dq.test.status.failed'),
                value: byStatus.FAILED ?? 0,
                color: RED_3,
              },
              {
                name: t('dq.test.status.aborted'),
                value: byStatus.ABORTED ?? 0,
                color: YELLOW_2,
              },
              {
                name: t('dq.test.status.no-result'),
                value: (byStatus.NO_RESULT ?? 0) + (byStatus.NOT_DECLARED ?? 0),
                color: GREY_200,
              },
            ]}
            iconData={{ icon: <ChecklistIcon /> }}
            paddingAngle={2}
            percentage={calculatePercentage(
              passedRules,
              rulesWithResult,
              1,
              true
            )}
            title={t('dq.test.cde.rules-table')}
            value={summary.rules}
          />
        </Col>
        <Col md={8} xs={24}>
          <SummaryPieChartCard
            showLegends
            chartData={[
              {
                name: t('dq.test.status.passed'),
                value: summary.passedTestCases,
                color: GREEN_3,
              },
              {
                name: t('dq.test.status.failed'),
                value: summary.testCases - summary.passedTestCases,
                color: RED_3,
              },
            ]}
            iconData={{ icon: <AllTestsIcon /> }}
            paddingAngle={2}
            percentage={calculatePercentage(
              summary.passedTestCases,
              summary.testCases,
              1,
              true
            )}
            title={t('dq.test.summary-test-cases')}
            value={summary.testCases}
          />
        </Col>
        <Col md={8} xs={24}>
          <Card
            className="pie-chart-summary-panel dq-spec-summary h-full"
            data-testid="dq-cde-dimensions">
            <div className="summary-title-row">
              <div className="icon-container">
                <ChecklistIcon />
              </div>
              <Typography.Paragraph className="summary-title">
                {t('dq.test.cde.by-dimension')}
              </Typography.Paragraph>
            </div>
            <Typography.Paragraph className="summary-value m-b-sm">
              {results.dimensions.length}
            </Typography.Paragraph>
            <div className="dq-spec-summary-list">
              {results.dimensions.map((dimension) => {
                const name = (dimension.dimension ?? '--')
                  .split('.')
                  .slice(-1)[0];

                return (
                  <div
                    className="dq-spec-summary-item"
                    key={dimension.dimension ?? 'none'}>
                    <div className="dq-spec-summary-label">
                      <Typography.Text ellipsis={{ tooltip: name }}>
                        {name}
                      </Typography.Text>
                      <span>
                        {dimension.passedRules}/{dimension.rules}
                      </span>
                    </div>
                    <Progress
                      percent={Math.round(dimension.passRate * 100)}
                      showInfo={false}
                      size="small"
                      strokeColor={dimension.passRate >= 1 ? GREEN_3 : RED_3}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className="dq-trend-card"
        extra={
          <Segmented
            options={DQ_TREND_PERIODS.map((days) => ({
              value: days,
              label: t('dq.test.days', { count: days }),
            }))}
            value={trendDays}
            onChange={(value) => setTrendDays(Number(value))}
          />
        }
        title={
          <div>
            <div>{t('dq.test.trend-title')}</div>
            <Typography.Text className="dq-card-subtitle">
              {t('dq.test.trend-subtitle')}
            </Typography.Text>
          </div>
        }>
        <DQTrendChart trend={trend} />
      </Card>

      <Card size="small" title={t('dq.test.cde.rules-table')}>
        <Table<DQCdeRuleRow>
          columns={ruleColumns}
          dataSource={results.rules}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1100 }}
          size="small"
        />
      </Card>

      <Card
        className="dq-results-card"
        extra={
          <Space wrap>
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
        }
        size="small"
        title={
          <Space size={8}>
            {t('dq.test.cde.test-cases-table')}
            <span className="dq-count-badge">{results.paging.total}</span>
          </Space>
        }>
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
            hideOnSinglePage: true,
            onChange: setPage,
          }}
          rowKey={(row) => `${row.ruleId}-${row.spec.key}-${row.column.fqn}`}
          scroll={{ x: 1300 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default DQCdeTestResults;
