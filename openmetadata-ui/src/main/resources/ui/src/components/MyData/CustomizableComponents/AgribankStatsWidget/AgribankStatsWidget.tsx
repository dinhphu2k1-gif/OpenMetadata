import React, { useEffect, useState } from 'react';
import { Card, Typography } from 'antd';
import {
  DatabaseOutlined,
  TableOutlined,
  FileDoneOutlined,
  BookOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import './agribank-stats-widget.less';
import { searchData } from '../../../../rest/miscAPI';
import { SearchIndex } from '../../../../enums/search.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getFeedsWithFilter } from '../../../../rest/feedsAPI';
import { FeedFilter } from '../../../../enums/mydata.enum';
import { ThreadTaskStatus, ThreadType } from '../../../../generated/entity/feed/thread';
import { getChartPreviewByName } from '../../../../rest/DataInsightAPI';
import { SystemChartType } from '../../../../enums/DataInsight.enum';
import { getEpochMillisForPastDays, getCurrentMillis } from '../../../../utils/date-time/DateTimeUtils';
import { groupBy } from 'lodash';

const { Text, Title } = Typography;

const calculateTrend = (current: number, past: number) => {
  if (!past || past === 0) return { trend: 'up', trendValue: '0%' };
  const diff = current - past;
  const percentage = Math.round((Math.abs(diff) / past) * 100);
  return {
    trend: diff >= 0 ? 'up' : 'down',
    trendValue: `${percentage}%`,
  };
};

const AgribankStatsWidget = () => {
  const { currentUser } = useApplicationStore();
  const [stats, setStats] = useState({
    totalAssets: { value: 0, trend: 'up', trendValue: '0%' },
    tables: { value: 0, trend: 'up', trendValue: '0%' },
    databases: { value: 0, trend: 'up', trendValue: '0%' },
    pendingTasks: { value: 0, trend: 'up', trendValue: '0%' },
    followedAssets: { value: 0, trend: 'up', trendValue: '0%' },
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch Total Assets
        const totalAssetsRes = await searchData('', 0, 0, '', '', '', [SearchIndex.DATA_ASSET], false, true);
        const totalAssets = totalAssetsRes?.data?.hits?.total?.value ?? 0;

        // Fetch Tables
        const tablesRes = await searchData('', 0, 0, '', '', '', SearchIndex.TABLE as any, false, true);
        const tables = tablesRes?.data?.hits?.total?.value ?? 0;

        // Fetch Databases
        const databasesRes = await searchData('', 0, 0, '', '', '', SearchIndex.DATABASE as any, false, true);
        const databases = databasesRes?.data?.hits?.total?.value ?? 0;

        // Fetch Followed Assets
        let followedAssets = 0;
        if (currentUser?.id) {
          const followedRes = await searchData('', 0, 0, `followers:${currentUser.id}`, '', '', [SearchIndex.DATA_ASSET], false, true);
          followedAssets = followedRes?.data?.hits?.total?.value ?? 0;
        }

        // Fetch Pending Tasks
        let pendingTasks = 0;
        if (currentUser?.id) {
          const tasksRes = await getFeedsWithFilter(
            currentUser.id,
            FeedFilter.OWNER_OR_FOLLOWS,
            undefined,
            ThreadType.Task,
            ThreadTaskStatus.Open
          );
          pendingTasks = tasksRes?.data?.paging?.total ?? 0;
        }

        // Fetch Data Insight historical data for trends (last 7 days)
        let pastTotalAssets = 0;
        let pastTables = 0;
        let pastDatabases = 0;
        
        try {
          const filter = {
            start: getEpochMillisForPastDays(7),
            end: getCurrentMillis(),
          };
          const chartData = await getChartPreviewByName(SystemChartType.TotalDataAssets, filter);
          const results = chartData?.results ?? [];
          
          if (results.length > 0) {
            // Group by day to find the oldest day in the 7-day range
            const groupedByDay = groupBy(results, 'day');
            const days = Object.keys(groupedByDay).map(Number).sort((a, b) => a - b);
            
            if (days.length > 0) {
              const oldestDay = days[0];
              const oldestData = groupedByDay[oldestDay] || [];
              
              pastTotalAssets = oldestData.reduce((acc, curr) => acc + (curr.count || 0), 0);
              const tableData = oldestData.find(d => d.group === 'table');
              if (tableData) pastTables = tableData.count;
              const dbData = oldestData.find(d => d.group === 'database');
              if (dbData) pastDatabases = dbData.count;
            }
          }
        } catch (err) {
          // Ignore data insight errors if not configured
        }

        setStats({
          totalAssets: { value: totalAssets, ...calculateTrend(totalAssets, pastTotalAssets) },
          tables: { value: tables, ...calculateTrend(tables, pastTables) },
          databases: { value: databases, ...calculateTrend(databases, pastDatabases) },
          // No historical tracking natively available for these two, default to 0% trend or calculate if API allows
          pendingTasks: { value: pendingTasks, trend: 'up', trendValue: '0%' },
          followedAssets: { value: followedAssets, trend: 'up', trendValue: '0%' },
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [currentUser]);

  const statsData = [
    {
      id: 1,
      title: 'Tổng tài sản dữ liệu',
      value: stats.totalAssets.value.toLocaleString('vi-VN'),
      trend: stats.totalAssets.trend,
      trendValue: stats.totalAssets.trendValue,
      trendText: 'so với tuần trước',
      icon: <DatabaseOutlined style={{ fontSize: '24px', color: '#AE1C3F' }} />,
      bgClass: 'bg-red-light',
    },
    {
      id: 2,
      title: 'Bảng dữ liệu',
      value: stats.tables.value.toLocaleString('vi-VN'),
      trend: stats.tables.trend,
      trendValue: stats.tables.trendValue,
      trendText: 'so với tuần trước',
      icon: <TableOutlined style={{ fontSize: '24px', color: '#AE1C3F' }} />,
      bgClass: 'bg-red-light',
    },
    {
      id: 3,
      title: 'Cơ sở dữ liệu',
      value: stats.databases.value.toLocaleString('vi-VN'),
      trend: stats.databases.trend,
      trendValue: stats.databases.trendValue,
      trendText: 'so với tuần trước',
      icon: <DatabaseOutlined style={{ fontSize: '24px', color: '#AE1C3F' }} />,
      bgClass: 'bg-red-light',
    },
    {
      id: 4,
      title: 'Tài sản chờ phê duyệt',
      value: stats.pendingTasks.value.toLocaleString('vi-VN'),
      trend: stats.pendingTasks.trend,
      trendValue: stats.pendingTasks.trendValue,
      trendText: 'so với tuần trước',
      icon: <FileDoneOutlined style={{ fontSize: '24px', color: '#d97706' }} />,
      bgClass: 'bg-orange-light',
    },
    {
      id: 5,
      title: 'Tài sản tôi theo dõi',
      value: stats.followedAssets.value.toLocaleString('vi-VN'),
      trend: stats.followedAssets.trend,
      trendValue: stats.followedAssets.trendValue,
      trendText: 'so với tuần trước',
      icon: <BookOutlined style={{ fontSize: '24px', color: '#059669' }} />,
      bgClass: 'bg-green-light',
    },
  ];

  return (
    <div className="agribank-stats-container">
      {statsData.map((stat) => (
        <Card key={stat.id} className="agribank-stat-card" bordered>
          <div className="stat-card-body">
            <div className={`stat-icon-wrapper ${stat.bgClass}`}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <Title level={3} className="stat-value">
                {stat.value}
              </Title>
              <Text className="stat-title">{stat.title}</Text>
              <div
                className={`stat-trend ${
                  stat.trend === 'up' ? 'trend-up' : 'trend-down'
                }`}>
                {stat.trend === 'up' ? (
                  <ArrowUpOutlined className="trend-icon" />
                ) : (
                  <ArrowDownOutlined className="trend-icon" />
                )}
                <Text className="trend-text">
                  <span className="trend-value">{stat.trendValue}</span> {stat.trendText}
                </Text>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AgribankStatsWidget;

