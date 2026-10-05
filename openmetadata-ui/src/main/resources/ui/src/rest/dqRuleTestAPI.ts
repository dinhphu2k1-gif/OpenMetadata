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
  DQCdeResults,
  DQLatestRun,
  DQLibraryDefinition,
  DQManagedBy,
  DQPreview,
  DQRuleResults,
  DQTestConfig,
  DQTrend,
} from '../components/Glossary/DQRuleTests/DQRuleTests.interface';
import { DqTestSpecs } from '../generated/type/dqTestSpecs';
import APIClient from './index';

const BASE_URL = '/glossaryTerms/dataQuality';

export const getDqTestConfig = async () => {
  const response = await APIClient.get<DQTestConfig>(`${BASE_URL}/config`);

  return response.data;
};

export const listDqLibraryTestDefinitions = async () => {
  const response = await APIClient.get<DQLibraryDefinition[]>(
    `${BASE_URL}/testDefinitions`
  );

  return response.data;
};

export const previewDqRuleTests = async (
  cdeTermId: string | undefined,
  dataQualityTestSpecs: DqTestSpecs
) => {
  const response = await APIClient.post<DQPreview>(`${BASE_URL}/preview`, {
    cdeTermId,
    dataQualityTestSpecs,
  });

  return response.data;
};

export const getDqRuleStatuses = async () => {
  const response = await APIClient.get<Record<string, string>>(
    `${BASE_URL}/rules/status`
  );

  return response.data;
};

export const getDqRuleResults = async (
  ruleId: string,
  params?: { specKey?: string; offset?: number; limit?: number }
) => {
  const response = await APIClient.get<DQRuleResults>(
    `${BASE_URL}/rules/${ruleId}/results`,
    { params }
  );

  return response.data;
};

export const getDqRuleTrend = async (
  ruleId: string,
  params?: { days?: number; specKey?: string }
) => {
  const response = await APIClient.get<DQTrend>(
    `${BASE_URL}/rules/${ruleId}/trend`,
    { params }
  );

  return response.data;
};

export const previewDqSchedule = async (schedule: {
  cron: string | null;
  timezone?: string;
}) => {
  const response = await APIClient.post<{
    cron: string | null;
    timezone: string;
    nextRuns: number[];
  }>(`${BASE_URL}/schedule/preview`, schedule);

  return response.data;
};

export const runDqRuleTests = async (ruleId: string) => {
  const response = await APIClient.post<{
    triggered: boolean;
    message?: string;
  }>(`${BASE_URL}/rules/${ruleId}/run`);

  return response.data;
};

export const getDqRuleLatestRun = async (ruleId: string) => {
  const response = await APIClient.get<DQLatestRun>(
    `${BASE_URL}/rules/${ruleId}/run/latest`
  );

  return response.data;
};

export const getDqCdeResults = async (
  cdeId: string,
  params?: {
    ruleId?: string;
    result?: string;
    offset?: number;
    limit?: number;
  }
) => {
  const response = await APIClient.get<DQCdeResults>(
    `${BASE_URL}/cdes/${cdeId}/results`,
    { params }
  );

  return response.data;
};

export const getDqCdeTrend = async (cdeId: string, days?: number) => {
  const response = await APIClient.get<DQTrend>(
    `${BASE_URL}/cdes/${cdeId}/trend`,
    { params: { days } }
  );

  return response.data;
};

export const getDqManagedTestCase = async (testCaseId: string) => {
  const response = await APIClient.get<DQManagedBy>(
    `${BASE_URL}/testCases/${testCaseId}/managedBy`
  );

  return response.data;
};
