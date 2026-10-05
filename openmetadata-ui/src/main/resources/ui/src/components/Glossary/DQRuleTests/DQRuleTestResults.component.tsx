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
  Divider,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as AllTestsIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as ChecklistIcon } from '../../../assets/svg/ic-checklist.svg';
import { ReactComponent as CoverageIcon } from '../../../assets/svg/ic-data-assets-coverage.svg';
import { ReactComponent as PlayIcon } from '../../../assets/svg/ic-play.svg';
import {
  BLUE_2,
  GREEN_3,
  GREY_200,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  getDqRuleLatestRun,
  getDqRuleResults,
  getDqRuleTrend,
  runDqRuleTests,
  setDqRuleSchedule,
} from '../../../rest/dqRuleTestAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import {
  calculatePercentage,
  formatNumberWithComma,
} from '../../../utils/NumberUtils';
import { getTestCaseDetailPagePath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import SummaryPieChartCard from '../../DataQuality/SummaryPannel/SummaryPieChartCard/SummaryPieChartCard.component';
import DQOutcomeTag from './DQOutcomeTag.component';
import './dq-rule-test-results.less';
import {
  DQ_RESULT_PAGE_SIZE,
  DQ_RUN_POLL_INTERVAL_MS,
  DQ_RUNNING_STATES,
  DQ_SCHEDULE_PRESETS,
  DQ_TREND_PERIODS,
} from './DQRuleTests.constants';
import {
  DQLatestRun,
  DQOutcome,
  DQRuleResults,
  DQTestCapabilities,
  DQTestCaseRow,
  DQTrend,
} from './DQRuleTests.interface';
import DQScheduleModal from './DQScheduleModal.component';
import DQTrendChart from './DQTrendChart.component';

interface DQDeclareAction {
  label: string;
  hint?: string;
  onClick: () => void;
}

interface DQRuleTestResultsProps {
  ruleId: string;
  capabilities?: DQTestCapabilities;
  /** The way to declare tests from this tab; absent when the viewer cannot edit. */
  declareAction?: DQDeclareAction;
}

const ALL_FILTER = '__all__';
const RETIRED_FILTER = '__retired__';
const NOT_AVAILABLE_CODE = 'DQ_TEST_RUN_NOT_AVAILABLE';

const OUTCOME_STROKE: Record<DQOutcome, string> = {
  PASSED: GREEN_3,
  FAILED: RED_3,
  ABORTED: YELLOW_2,
  NO_RESULT: GREY_200,
};

const errorCodeOf = (error: unknown) =>
  (error as AxiosError<{ code?: string }>)?.response?.data?.code;

/** The percent of a threshold such as ">= 99.5%"; undefined for a non-percent threshold. */
const percentOf = (threshold?: string | null) => {
  const match = threshold?.match(/(\d+(?:\.\d+)?)\s*%/);

  return match ? Number(match[1]) : undefined;
};

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

const DQRuleTestResults = ({
  ruleId,
  capabilities,
  declareAction,
}: DQRuleTestResultsProps) => {
  const { t } = useTranslation();
  const [results, setResults] = useState<DQRuleResults>();
  const [trend, setTrend] = useState<DQTrend>();
  const [latestRun, setLatestRun] = useState<DQLatestRun>();
  const [isLoading, setIsLoading] = useState(true);
  const [isNotApplied, setIsNotApplied] = useState(false);
  const [specKey, setSpecKey] = useState<string>();
  const [page, setPage] = useState(1);
  const [trendDays, setTrendDays] = useState(DQ_TREND_PERIODS[0]);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const wasRunning = useRef(false);

  const isRunning = DQ_RUNNING_STATES.has(latestRun?.state ?? '');
  const canEdit = Boolean(capabilities?.canEdit);

  const load = useCallback(async () => {
    try {
      const [resultData, trendData, runData] = await Promise.all([
        getDqRuleResults(ruleId, {
          specKey: specKey === RETIRED_FILTER ? undefined : specKey,
          offset: (page - 1) * DQ_RESULT_PAGE_SIZE,
          limit: DQ_RESULT_PAGE_SIZE,
        }),
        getDqRuleTrend(ruleId, { days: trendDays, specKey }),
        getDqRuleLatestRun(ruleId),
      ]);
      setResults(resultData);
      setTrend(trendData);
      setLatestRun(runData);
      setIsNotApplied(false);
    } catch (error) {
      if (errorCodeOf(error) === NOT_AVAILABLE_CODE) {
        setIsNotApplied(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ruleId, specKey, page, trendDays]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!isRunning) {
      if (wasRunning.current) {
        wasRunning.current = false;
        load();
      }

      return undefined;
    }
    wasRunning.current = true;
    const handle = setInterval(async () => {
      try {
        setLatestRun(await getDqRuleLatestRun(ruleId));
      } catch {
        // The next tick retries.
      }
    }, DQ_RUN_POLL_INTERVAL_MS);

    return () => clearInterval(handle);
  }, [isRunning, ruleId, load]);

  const runNow = () =>
    Modal.confirm({
      title: t('dq.test.run-confirm', {
        specs: results?.summary.specs ?? 0,
        columns: results?.summary.applied ?? 0,
        code: results?.rule.code,
      }),
      onOk: async () => {
        try {
          await runDqRuleTests(ruleId);
          showSuccessToast(t('dq.test.run-started'));
          setLatestRun({ ...(latestRun ?? {}), state: 'queued' });
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      },
    });

  const saveSchedule = async (cron: string | null, timezone: string) => {
    try {
      await setDqRuleSchedule(ruleId, { cron, timezone });
      setIsScheduleOpen(false);
      await load();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const changeSpecFilter = (value: string) => {
    setSpecKey(value === ALL_FILTER ? undefined : value);
    setPage(1);
  };

  if (isLoading && !results) {
    return <Loader />;
  }

  const declareButton = declareAction && (
    <div className="dq-results-empty-action">
      <Button
        data-testid="dq-declare-tests"
        type="primary"
        onClick={declareAction.onClick}>
        {declareAction.label}
      </Button>
      {declareAction.hint && (
        <Typography.Text className="dq-card-subtitle">
          {declareAction.hint}
        </Typography.Text>
      )}
    </div>
  );

  if (isNotApplied || !results) {
    return (
      <DQResultsEmptyState
        action={declareButton}
        description={t('dq.test.empty-not-approved')}
        testId="dq-results-not-applied"
        title={t('dq.test.not-approved-title')}
      />
    );
  }

  const { rule, schedule, summary, status, specs } = results;
  const visibleSpecs = specs.filter((spec) => !spec.retired);
  const hasRetired = specs.some((spec) => spec.retired);
  const hasSchedule = Boolean(schedule.cron);
  const schedulePreset = DQ_SCHEDULE_PRESETS.find(
    (preset) => preset.cron === schedule.cron
  );
  const archivedBanner = !rule.effective && (
    <Alert
      showIcon
      data-testid="dq-results-archived"
      message={t('dq.test.archived-banner')}
      type="warning"
    />
  );

  if (status === 'NOT_DECLARED' || summary.applied === 0) {
    const isNotDeclared = status === 'NOT_DECLARED';

    return (
      <div className="dq-rule-test-results" data-testid="dq-rule-test-results">
        {archivedBanner}
        <DQResultsEmptyState
          action={declareButton}
          description={
            isNotDeclared
              ? t('dq.test.empty-description')
              : t('dq.test.no-columns-description')
          }
          steps={
            isNotDeclared
              ? [
                  t('dq.test.empty-step-declare'),
                  t('dq.test.empty-step-approve'),
                  t('dq.test.empty-step-run'),
                ]
              : undefined
          }
          testId={
            isNotDeclared ? 'dq-results-not-declared' : 'dq-results-no-columns'
          }
          title={
            isNotDeclared
              ? t('dq.test.empty-title')
              : t('dq.test.no-columns-title')
          }
        />
      </div>
    );
  }

  const columns: ColumnsType<DQTestCaseRow> = [
    { title: t('dq.test.column.test'), dataIndex: ['spec', 'name'] },
    {
      title: t('dq.test.column.column'),
      dataIndex: ['column', 'fqn'],
      render: (_, row) => row.column.fqn.split('.').slice(-1)[0],
    },
    {
      title: t('dq.test.column.table'),
      render: (_, row) => `${row.column.service}.${row.column.table}`,
    },
    {
      title: t('dq.test.column.result'),
      render: (_, row) => (
        <Space size={4}>
          <DQOutcomeTag status={row.thresholdResult} />
          {row.stale && <Tag color="orange">{t('dq.test.stale')}</Tag>}
          {row.state !== 'ACTIVE' && <Tag>{row.state}</Tag>}
        </Space>
      ),
    },
    {
      title: t('dq.test.column.pass-rate'),
      dataIndex: 'passedRowsPercentage',
      width: 200,
      render: (value: number | null, row) =>
        value == null ? (
          '--'
        ) : (
          <div className="dq-pass-rate">
            <Progress
              percent={value}
              showInfo={false}
              size="small"
              strokeColor={OUTCOME_STROKE[row.thresholdResult]}
            />
            <span>{`${value.toFixed(2)}%`}</span>
          </div>
        ),
    },
    {
      title: t('dq.test.column.violations'),
      dataIndex: 'failedRows',
      align: 'right',
      render: (value: number | null) =>
        value == null ? (
          '--'
        ) : (
          <span className={value > 0 ? 'dq-violations' : undefined}>
            {formatNumberWithComma(value)}
          </span>
        ),
    },
    {
      title: t('dq.test.column.at'),
      dataIndex: 'timestamp',
      render: (value?: number | null) => (value ? formatDateTime(value) : '--'),
    },
  ];

  const specOptions = [
    { value: ALL_FILTER, label: t('dq.test.filter-all-tests') },
    ...visibleSpecs.map((spec) => ({
      value: spec.key,
      label: `${spec.name} · ${spec.summary.passed}/${spec.summary.applied}`,
    })),
    ...(hasRetired
      ? [{ value: RETIRED_FILTER, label: t('dq.test.retired') }]
      : []),
  ];

  return (
    <div className="dq-rule-test-results" data-testid="dq-rule-test-results">
      {archivedBanner}

      <Card className="dq-run-bar">
        <div className="dq-run-bar-items">
          <div className="dq-run-bar-item">
            <span className="dq-run-bar-label">{t('dq.test.rule-status')}</span>
            <DQOutcomeTag status={status} />
          </div>
          {rule.threshold && (
            <>
              <Divider className="dq-run-bar-divider" type="vertical" />
              <div className="dq-run-bar-item">
                <span className="dq-run-bar-label">
                  {t('dq.test.effective-threshold')}
                </span>
                <span className="dq-run-bar-value">{rule.threshold}</span>
              </div>
            </>
          )}
          <Divider className="dq-run-bar-divider" type="vertical" />
          <div className="dq-run-bar-item">
            <span className="dq-run-bar-label">{t('dq.test.last-run')}</span>
            <span className="dq-run-bar-value">
              {summary.lastRunAt ? formatDateTime(summary.lastRunAt) : '--'}
            </span>
          </div>
          <Divider className="dq-run-bar-divider" type="vertical" />
          <div className="dq-run-bar-item">
            <span className="dq-run-bar-label">{t('dq.test.schedule')}</span>
            <span className="dq-run-bar-value" data-testid="dq-schedule-line">
              {hasSchedule ? (
                <Tooltip title={`${schedule.cron} (${schedule.timezone})`}>
                  {schedulePreset ? (
                    t(`dq.test.schedule-${schedulePreset.key}`)
                  ) : (
                    <code>{schedule.cron}</code>
                  )}
                </Tooltip>
              ) : (
                <Tooltip title={t('dq.test.no-schedule')}>
                  <Typography.Text
                    data-testid="dq-no-schedule-warning"
                    type="warning">
                    {t('dq.test.no-schedule-short')}
                  </Typography.Text>
                </Tooltip>
              )}
              {hasSchedule && schedule.nextRuns[0] && (
                <span className="dq-run-bar-muted">
                  · {t('dq.test.next-run')}:{' '}
                  {formatDateTime(schedule.nextRuns[0])}
                </span>
              )}
              {canEdit && (
                <Button
                  className="p-0"
                  data-testid="dq-change-schedule"
                  type="link"
                  onClick={() => setIsScheduleOpen(true)}>
                  {t('dq.test.change-schedule')}
                </Button>
              )}
            </span>
          </div>
        </div>
        {capabilities?.canRun && (
          <Button
            data-testid="dq-run-now"
            disabled={isRunning}
            icon={!isRunning && <PlayIcon className="dq-run-icon" />}
            loading={isRunning}
            type="primary"
            onClick={runNow}>
            {isRunning ? t('dq.test.running') : t('dq.test.run-now')}
          </Button>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col md={8} xs={24}>
          <SummaryPieChartCard
            showLegends
            chartData={[
              {
                name: t('dq.test.status.passed'),
                value: summary.passed,
                color: GREEN_3,
              },
              {
                name: t('dq.test.status.failed'),
                value: summary.failed,
                color: RED_3,
              },
              {
                name: t('dq.test.status.aborted'),
                value: summary.aborted,
                color: YELLOW_2,
              },
              {
                name: t('dq.test.status.no-result'),
                value: summary.noResult,
                color: GREY_200,
              },
            ]}
            iconData={{ icon: <AllTestsIcon /> }}
            paddingAngle={2}
            percentage={calculatePercentage(
              summary.passed,
              summary.applied,
              1,
              true
            )}
            title={t('dq.test.summary-test-cases')}
            value={summary.applied}
          />
        </Col>
        <Col md={8} xs={24}>
          <SummaryPieChartCard
            showLegends
            chartData={[
              {
                name: t('dq.test.applied'),
                value: summary.applied,
                color: BLUE_2,
              },
              {
                name: t('dq.test.not-applicable'),
                value: summary.notApplicable,
                color: GREY_200,
              },
            ]}
            iconData={{ icon: <CoverageIcon /> }}
            percentage={calculatePercentage(
              summary.applied,
              summary.applied + summary.notApplicable,
              1,
              true
            )}
            title={t('dq.test.summary-coverage')}
            value={summary.applied}
          />
        </Col>
        <Col md={8} xs={24}>
          <Card
            className="pie-chart-summary-panel dq-spec-summary h-full"
            data-testid="dq-spec-summary">
            <div className="summary-title-row">
              <div className="icon-container">
                <ChecklistIcon />
              </div>
              <Typography.Paragraph className="summary-title">
                {t('dq.test.summary-specs')}
              </Typography.Paragraph>
            </div>
            <Typography.Paragraph className="summary-value m-b-sm">
              {summary.specs}
            </Typography.Paragraph>
            <div className="dq-spec-summary-list">
              {visibleSpecs.map((spec) => (
                <div className="dq-spec-summary-item" key={spec.key}>
                  <div className="dq-spec-summary-label">
                    <Typography.Text ellipsis={{ tooltip: spec.name }}>
                      {spec.name}
                    </Typography.Text>
                    <span>
                      {t('dq.test.spec-passed', {
                        passed: spec.summary.passed,
                        total: spec.summary.applied,
                      })}
                    </span>
                  </div>
                  <Progress
                    percent={Number(
                      calculatePercentage(
                        spec.summary.passed,
                        spec.summary.applied,
                        1
                      )
                    )}
                    showInfo={false}
                    size="small"
                    strokeColor={OUTCOME_STROKE[spec.status]}
                  />
                </div>
              ))}
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
        <DQTrendChart threshold={percentOf(rule.threshold)} trend={trend} />
      </Card>

      <Card
        className="dq-results-card"
        extra={
          <Select
            className="dq-spec-filter"
            data-testid="dq-spec-filter"
            options={specOptions}
            value={specKey ?? ALL_FILTER}
            onChange={changeSpecFilter}
          />
        }
        title={
          <Space size={8}>
            {t('dq.test.results-title')}
            <span className="dq-count-badge">{results.paging.total}</span>
            {results.hiddenTestCases > 0 && (
              <Typography.Text className="dq-card-subtitle">
                {t('dq.test.hidden', { count: results.hiddenTestCases })}
              </Typography.Text>
            )}
          </Space>
        }>
        <Table<DQTestCaseRow>
          columns={columns}
          dataSource={results.testCases}
          expandable={{
            rowExpandable: (row) =>
              Boolean(row.lastError || row.testCaseFqn || row.nativeStatus),
            expandedRowRender: (row) => (
              <Space direction="vertical" size={4}>
                {row.lastError && (
                  <Alert message={row.lastError} type="error" />
                )}
                {row.nativeStatus && (
                  <Typography.Text type="secondary">
                    {t('dq.test.native-status', { status: row.nativeStatus })}
                  </Typography.Text>
                )}
                {row.testCaseFqn && (
                  <Link to={getTestCaseDetailPagePath(row.testCaseFqn)}>
                    {t('dq.test.open-test-case')}
                  </Link>
                )}
              </Space>
            ),
          }}
          loading={isLoading}
          locale={{ emptyText: t('dq.test.status.no-result') }}
          pagination={{
            current: page,
            pageSize: DQ_RESULT_PAGE_SIZE,
            total: results.paging.total,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: setPage,
          }}
          rowKey={(row) => `${row.spec.key}-${row.column.fqn}`}
          scroll={{ x: 960 }}
          size="small"
        />
      </Card>

      <DQScheduleModal
        open={isScheduleOpen}
        schedule={schedule}
        onCancel={() => setIsScheduleOpen(false)}
        onSave={saveSchedule}
      />
    </div>
  );
};

export default DQRuleTestResults;
