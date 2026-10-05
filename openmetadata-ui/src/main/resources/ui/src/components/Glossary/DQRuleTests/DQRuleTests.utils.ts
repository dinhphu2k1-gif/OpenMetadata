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

import { TFunction } from 'i18next';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getEntityName } from '../../../utils/EntityNameUtils';

/** Test definitions come from the server in English; the ones a Rule can use are translated in the locale files. */
export const getDqDefinitionName = (
  t: TFunction,
  name: string,
  fallback: string = name
) => t(`dq.test.definitions.${name}.name`, { defaultValue: fallback });

export const localizeDqDefinition = (
  t: TFunction,
  definition: TestDefinition
): TestDefinition => ({
  ...definition,
  displayName: getDqDefinitionName(
    t,
    definition.name,
    getEntityName(definition)
  ),
  description: t(`dq.test.definitions.${definition.name}.description`, {
    defaultValue: definition.description,
  }),
  parameterDefinition: definition.parameterDefinition?.map((parameter) => ({
    ...parameter,
    displayName: t(`dq.test.parameters.${parameter.name}.name`, {
      defaultValue: parameter.displayName ?? parameter.name,
    }),
    description: t(`dq.test.parameters.${parameter.name}.description`, {
      defaultValue: parameter.description,
    }),
  })),
});

const BARE_PERCENTAGE = /^(\d+(?:\.\d+)?)\s*%?$/;

/** A threshold typed as a bare number, such as "90", means at least that percent: ">= 90%". */
export const normalizeDqThreshold = (threshold?: string) => {
  const match = threshold?.trim().match(BARE_PERCENTAGE);

  return match ? `>= ${Number(match[1])}%` : threshold;
};

const REGEX_MATCH_MESSAGE =
  /^Found (\d+) value\(s\) matching regex pattern vs (\d+) value\(s\) in the column\.?$/;

/**
 * The engine words its results in English and counts only the values it tested; the messages it is
 * known to send are translated, with the row counts the pass rate itself is based on.
 */
export const localizeDqMessage = (
  t: TFunction,
  message: string,
  rows?: { passedRows: number | null; totalRows: number | null }
) => {
  const regex = message.match(REGEX_MATCH_MESSAGE);
  const hasRows = rows?.passedRows != null && rows.totalRows != null;

  return regex
    ? t('dq.test.messages.regex-match', {
        matched: hasRows ? rows?.passedRows : regex[1],
        total: hasRows ? rows?.totalRows : regex[2],
      })
    : message;
};
