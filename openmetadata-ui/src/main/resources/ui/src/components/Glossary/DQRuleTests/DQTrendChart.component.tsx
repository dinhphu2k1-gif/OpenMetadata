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
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  COLOR_GREY_400,
  GREEN_3,
  GREY_200,
  RED_3,
} from '../../../constants/Color.constants';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { DQTrend } from './DQRuleTests.interface';

interface DQTrendChartProps {
  trend?: DQTrend;
  /** Pass-rate threshold in percent, drawn as a dashed line. */
  threshold?: number;
  height?: number;
}

const MS_PER_DAY = 86_400_000;
const AXIS_DATE_FORMAT = 'dd/MM';
const TICK_STYLE = { fontSize: 12, fill: COLOR_GREY_400 };

const DQTrendChart = ({
  trend,
  threshold,
  height = 220,
}: DQTrendChartProps) => {
  const { t } = useTranslation();
  const points = trend?.points ?? [];

  if (points.length === 0) {
    return (
      <div className="dq-trend-empty" data-testid="dq-trend-empty">
        {t('dq.test.trend-empty')}
      </div>
    );
  }

  const end = Date.now();
  const start = end - (trend?.days ?? 30) * MS_PER_DAY;
  const data = points.map((point) => ({
    ...point,
    time: new Date(`${point.date}T12:00:00`).getTime(),
    rate: Math.round(point.passRate * 10_000) / 100,
  }));
  const lowest = Math.min(...data.map((point) => point.rate), threshold ?? 100);
  const yMin = Math.max(0, Math.floor(lowest - 1));

  return (
    <div data-testid="dq-trend-chart">
      <ResponsiveContainer height={height} width="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0 }}>
          <CartesianGrid stroke={GREY_200} vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="time"
            domain={[start, end]}
            scale="time"
            tick={TICK_STYLE}
            tickFormatter={(time: number) =>
              customFormatDateTime(time, AXIS_DATE_FORMAT)
            }
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            domain={[yMin, 100]}
            tick={TICK_STYLE}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number, _name, item) => [
              `${value}% (${item.payload.passed}/${item.payload.total})`,
              t('dq.test.column.pass-rate'),
            ]}
            labelFormatter={(time: number) =>
              customFormatDateTime(time, 'dd/MM/yyyy')
            }
          />
          {threshold !== undefined && (
            <ReferenceLine
              ifOverflow="extendDomain"
              stroke={RED_3}
              strokeDasharray="6 4"
              y={threshold}
            />
          )}
          <Area
            dataKey="rate"
            dot={{ r: 3, fill: GREEN_3 }}
            fill={GREEN_3}
            fillOpacity={0.12}
            stroke={GREEN_3}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="dq-trend-legend">
        <span>
          <span className="dq-trend-legend-line" />
          {t('dq.test.column.pass-rate')}
        </span>
        {threshold !== undefined && (
          <span>
            <span className="dq-trend-legend-line threshold" />
            {t('dq.test.threshold-line', { value: threshold })}
          </span>
        )}
      </div>
    </div>
  );
};

export default DQTrendChart;
