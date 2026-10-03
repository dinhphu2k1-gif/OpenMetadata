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

import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { DQTrend } from './DQRuleTests.interface';

interface DQTrendChartProps {
  trend?: DQTrend;
  width?: number;
  height?: number;
}

const PADDING = 6;
const MS_PER_DAY = 86_400_000;

/** Daily pass rate as a line with a dot per day and a vertical line at each approved version. */
const DQTrendChart = ({
  trend,
  width = 360,
  height = 64,
}: DQTrendChartProps) => {
  const { t } = useTranslation();
  const points = trend?.points ?? [];

  if (points.length === 0) {
    return (
      <span className="dq-trend-empty" data-testid="dq-trend-empty">
        {t('dq.test.trend-empty')}
      </span>
    );
  }

  const start = Date.now() - (trend?.days ?? 30) * MS_PER_DAY;
  const x = (time: number) =>
    PADDING +
    ((time - start) / ((trend?.days ?? 30) * MS_PER_DAY)) *
      (width - 2 * PADDING);
  const y = (rate: number) => PADDING + (1 - rate) * (height - 2 * PADDING);
  const coordinates = points.map((point) => ({
    ...point,
    cx: x(new Date(`${point.date}T12:00:00`).getTime()),
    cy: y(point.passRate),
  }));

  return (
    <svg
      aria-label={t('dq.test.trend')}
      data-testid="dq-trend-chart"
      height={height}
      role="img"
      width={width}>
      {(trend?.versions ?? []).map((version) => (
        <line
          key={`${version.ruleCode}-${version.businessVersion}`}
          stroke="currentColor"
          strokeDasharray="3 3"
          strokeOpacity={0.4}
          x1={x(version.publishedAt)}
          x2={x(version.publishedAt)}
          y1={0}
          y2={height}>
          <title>{`v${version.businessVersion} · ${formatDateTime(
            version.publishedAt
          )}`}</title>
        </line>
      ))}
      <polyline
        fill="none"
        points={coordinates.map((point) => `${point.cx},${point.cy}`).join(' ')}
        stroke="#1677ff"
        strokeWidth={2}
      />
      {coordinates.map((point) => (
        <circle
          cx={point.cx}
          cy={point.cy}
          fill="#1677ff"
          key={point.date}
          r={3}>
          <title>{`${point.date}: ${Math.round(point.passRate * 100)}% (${
            point.passed
          }/${point.total})`}</title>
        </circle>
      ))}
    </svg>
  );
};

export default DQTrendChart;
