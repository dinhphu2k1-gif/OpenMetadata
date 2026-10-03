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

import { Alert, Button, Card, Modal, Space, Table, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getDqRuleLatestRun,
  getDqRuleResults,
  getDqRuleTrend,
  runDqRuleTests,
  setDqRuleSchedule,
} from '../../../rest/dqRuleTestAPI';
import { getTestCaseDetailPagePath } from '../../../utils/RouterUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import {
  DQ_RESULT_PAGE_SIZE,
  DQ_RUN_POLL_INTERVAL_MS,
  DQ_RUNNING_STATES,
  DQ_TREND_PERIODS,
} from './DQRuleTests.constants';
import {
  DQLatestRun,
  DQRuleResults,
  DQTestCapabilities,
  DQTestCaseRow,
  DQTrend,
} from './DQRuleTests.interface';
import DQOutcomeTag from './DQOutcomeTag.component';
import DQScheduleModal from './DQScheduleModal.component';
import DQTrendChart from './DQTrendChart.component';

interface DQRuleTestResultsProps {
  ruleId: string;
  capabilities?: DQTestCapabilities;
}

const RETIRED_FILTER = '__retired__';
const NOT_AVAILABLE_CODE = 'DQ_TEST_RUN_NOT_AVAILABLE';

const errorCodeOf = (error: unknown) =>
  (error as AxiosError<{ code?: string }>)?.response?.data?.code;

const DQRuleTestResults = ({
  ruleId,
  capabilities,
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

  if (isLoading && !results) {
    return <Loader />;
  }

  if (isNotApplied || !results) {
    return (
      <Alert
        showIcon
        data-testid="dq-results-not-applied"
        message={t('dq.test.empty-not-approved')}
        type="info"
      />
    );
  }

  const { rule, schedule, summary, status, specs } = results;
  const visibleSpecs = specs.filter((spec) => !spec.retired);
  const hasRetired = specs.some((spec) => spec.retired);
  const hasSchedule = Boolean(schedule.cron);

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
        <Space>
          <DQOutcomeTag status={row.thresholdResult} />
          {row.stale && <Tag color="orange">{t('dq.test.stale')}</Tag>}
          {row.state !== 'ACTIVE' && <Tag>{row.state}</Tag>}
        </Space>
      ),
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
  ];

  return (
    <div className="dq-rule-test-results" data-testid="dq-rule-test-results">
      {!rule.effective && (
        <Alert
          showIcon
          data-testid="dq-results-archived"
          message={t('dq.test.archived-banner')}
          type="warning"
        />
      )}
      <Card size="small">
        <Space wrap align="center">
          <DQOutcomeTag status={status} />
          {rule.threshold && (
            <span>
              {t('dq.test.threshold-of-rule', { threshold: rule.threshold })}
            </span>
          )}
          <span>
            {t('dq.test.last-run')}:{' '}
            {summary.lastRunAt ? formatDateTime(summary.lastRunAt) : '-'}
          </span>
          {capabilities?.canRun && (
            <Button
              data-testid="dq-run-now"
              disabled={isRunning || summary.applied === 0}
              loading={isRunning}
              type="primary"
              onClick={runNow}>
              {isRunning ? t('dq.test.running') : t('dq.test.run-now')}
            </Button>
          )}
        </Space>
        <div className="dq-rule-test-schedule" data-testid="dq-schedule-line">
          <strong>{t('dq.test.schedule')}:</strong>{' '}
          {hasSchedule ? (
            <>
              <code>{schedule.cron}</code> ({schedule.timezone})
              {schedule.nextRuns[0] && (
                <>
                  {' '}
                  · {t('dq.test.next-run')}:{' '}
                  {formatDateTime(schedule.nextRuns[0])}
                </>
              )}
            </>
          ) : (
            t('dq.test.no-schedule')
          )}{' '}
          {canEdit && (
            <Button
              data-testid="dq-change-schedule"
              size="small"
              type="link"
              onClick={() => setIsScheduleOpen(true)}>
              {t('dq.test.change-schedule')}
            </Button>
          )}
        </div>
        {!hasSchedule && (
          <Alert
            showIcon
            data-testid="dq-no-schedule-warning"
            message={t('dq.test.no-schedule-warning')}
            type="warning"
          />
        )}
      </Card>

      <Space wrap className="dq-rule-test-cards">
        <Tag>{t('dq.test.count.specs', { count: summary.specs })}</Tag>
        <Tag>{t('dq.test.count.columns', { count: summary.applied })}</Tag>
        <Tag color="success">
          {t('dq.test.count.passed', { count: summary.passed })}
        </Tag>
        <Tag color="error">
          {t('dq.test.count.failed', { count: summary.failed })}
        </Tag>
        <Tag color="warning">
          {t('dq.test.count.aborted', { count: summary.aborted })}
        </Tag>
        <Tag>
          {t('dq.test.count.not-applicable', { count: summary.notApplicable })}
        </Tag>
      </Space>

      <div className="dq-rule-test-filter" data-testid="dq-spec-filter">
        <Tag.CheckableTag
          checked={specKey === undefined}
          onChange={() => {
            setSpecKey(undefined);
            setPage(1);
          }}>
          {t('dq.test.all')}
        </Tag.CheckableTag>
        {visibleSpecs.map((spec) => (
          <Tag.CheckableTag
            checked={specKey === spec.key}
            key={spec.key}
            onChange={() => {
              setSpecKey(spec.key);
              setPage(1);
            }}>
            {spec.name} · {spec.summary.passed}/{spec.summary.applied}
          </Tag.CheckableTag>
        ))}
        {hasRetired && (
          <Tag.CheckableTag
            checked={specKey === RETIRED_FILTER}
            onChange={() => {
              setSpecKey(RETIRED_FILTER);
              setPage(1);
            }}>
            {t('dq.test.retired')}
          </Tag.CheckableTag>
        )}
      </div>

      <div className="dq-rule-test-trend">
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

      {results.hiddenTestCases > 0 && (
        <Alert
          showIcon
          message={t('dq.test.hidden', { count: results.hiddenTestCases })}
          type="info"
        />
      )}
      <Table<DQTestCaseRow>
        columns={columns}
        dataSource={results.testCases}
        expandable={{
          rowExpandable: (row) => Boolean(row.lastError || row.testCaseFqn),
          expandedRowRender: (row) => (
            <>
              {row.lastError && <Alert message={row.lastError} type="error" />}
              {row.testCaseFqn && (
                <Link to={getTestCaseDetailPagePath(row.testCaseFqn)}>
                  {t('dq.test.open-test-case')}
                </Link>
              )}
            </>
          ),
        }}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: DQ_RESULT_PAGE_SIZE,
          total: results.paging.total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        rowKey={(row) => `${row.spec.key}-${row.column.fqn}`}
        size="small"
      />

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
