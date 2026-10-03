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

export type DQOutcome = 'PASSED' | 'FAILED' | 'ABORTED' | 'NO_RESULT';

export type DQRuleStatus = DQOutcome | 'NOT_DECLARED';

export interface DQTestCapabilities {
  canView: boolean;
  canEdit: boolean;
  canRun: boolean;
  isAdmin: boolean;
}

export interface DQTestConfig {
  testExecutionEnabled: boolean;
  defaultTimezone: string;
  capabilities?: DQTestCapabilities;
}

export interface DQParameterDefinition {
  name: string;
  displayName?: string;
  description?: string;
  dataType?: string;
  required: boolean;
  optionValues?: unknown[];
}

export interface DQLibraryDefinition {
  fqn: string;
  name: string;
  displayName?: string;
  description?: string;
  supportsRowLevelPassedFailed: boolean;
  supportedDataTypes?: string[];
  parameterDefinition: DQParameterDefinition[];
}

export interface DQPreviewTestVerdict {
  specKey?: string;
  index: number;
  name: string;
  applicable: boolean;
  reason: string | null;
}

export interface DQPreviewColumn {
  columnKey: string;
  columnFqn: string;
  service: string;
  table: string | null;
  dataType: string | null;
  tests: DQPreviewTestVerdict[];
}

export interface DQPreview {
  cdeTermId?: string;
  columns: DQPreviewColumn[];
  totals: {
    specs: number;
    columns: number;
    testCases: number;
    notApplicable: number;
  };
}

export interface DQSchedule {
  ruleId: string;
  cron: string | null;
  timezone: string;
  updatedBy: string | null;
  updatedAt: number | null;
  nextRuns: number[];
}

export interface DQLatestRun {
  state: string | null;
  pipelineId?: string;
  pipelineFqn?: string;
  runId?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface DQSummary {
  specs: number;
  applied: number;
  notApplicable: number;
  passed: number;
  failed: number;
  aborted: number;
  noResult: number;
  stale: number;
  lastRunAt: number | null;
}

export interface DQSpecResult {
  key: string;
  name: string;
  kind: string;
  testDefinitionFqn?: string;
  retired: boolean;
  threshold: string | null;
  effectiveThreshold: string | null;
  status: DQOutcome;
  summary: DQSummary;
}

export interface DQTestCaseRow {
  testCaseId: string | null;
  testCaseFqn: string | null;
  ruleId: string;
  ruleCode: string;
  spec: { key: string; name: string };
  column: { fqn: string; table: string; service: string };
  state: string;
  stateReason: string | null;
  lastError: string | null;
  thresholdResult: DQOutcome;
  nativeStatus: string | null;
  passedRowsPercentage: number | null;
  failedRows: number | null;
  timestamp: number | null;
  stale: boolean;
}

export interface DQPaging {
  offset: number;
  limit: number;
  total: number;
}

export interface DQRuleSummary {
  id: string;
  code: string;
  fullyQualifiedName?: string;
  displayName?: string;
  threshold: string | null;
  dimension: string | null;
  effective: boolean;
  businessVersion: string;
}

export interface DQRuleResults {
  rule: DQRuleSummary;
  schedule: DQSchedule;
  status: DQRuleStatus;
  summary: DQSummary;
  specs: DQSpecResult[];
  testCases: DQTestCaseRow[];
  hiddenTestCases: number;
  paging: DQPaging;
}

export interface DQCdeRuleRow extends DQRuleSummary {
  status: DQRuleStatus;
  cron: string | null;
  specs: number;
  columns: number;
  summary: DQSummary;
}

export interface DQCdeResults {
  cdeTermId: string;
  summary: {
    rules: number;
    rulesWithTests: number;
    rulesByStatus: Record<string, number>;
    testCases: number;
    passedTestCases: number;
    passRate: number | null;
  };
  dimensions: {
    dimension: string | null;
    rules: number;
    passedRules: number;
    passRate: number;
  }[];
  rules: DQCdeRuleRow[];
  testCases: DQTestCaseRow[];
  hiddenTestCases: number;
  paging: DQPaging;
}

export interface DQTrendPoint {
  date: string;
  passed: number;
  total: number;
  passRate: number;
}

export interface DQTrend {
  days: number;
  points: DQTrendPoint[];
  versions: {
    ruleCode: string;
    businessVersion: string;
    publishedAt: number;
  }[];
}

export interface DQManagedBy {
  managed: boolean;
  ruleId?: string;
  ruleCode?: string;
  specKey?: string;
  specName?: string;
}
