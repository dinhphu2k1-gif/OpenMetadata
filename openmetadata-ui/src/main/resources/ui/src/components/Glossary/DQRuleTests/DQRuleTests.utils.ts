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

type MessageRows = { passedRows: number | null; totalRows: number | null };

interface MessageRule {
  pattern: RegExp;
  key: string;
  params: (match: RegExpMatchArray, rows?: MessageRows) => Record<string, string>;
}

const MESSAGE_PREFIX = 'dq.test.messages';
const DIMENSION_MESSAGE = /^Dimension (.+?)=(.*?): (Found .*)$/;

/**
 * Every message the test engine is known to send, in the order they are tried. A message that
 * matches none stays as the engine wrote it. To translate a new one, add a rule here and its key
 * under `dq.test.messages` in the locale files.
 */
const MESSAGE_RULES: MessageRule[] = [
  {
    pattern:
      /^Found (\d+) value\(s\) matching regex pattern vs (\d+) value\(s\) in the column\.?$/,
    key: 'regex-match',
    // The pass rate counts every row, not only the values the engine tested
    params: (match, rows) => ({
      matched: String(rows?.passedRows ?? match[1]),
      total: String(rows?.totalRows ?? match[2]),
    }),
  },
  {
    pattern:
      /^Found (\d+) value\(s\) matching the forbidden regex pattern\.?$/,
    key: 'forbidden-regex',
    params: (match) => ({ count: match[1] }),
  },
  {
    pattern: /^Found (\w+)=(\S+?)\. It should be 0\.?$/,
    key: 'should-be-zero',
    params: (match) => ({ metric: match[1], value: match[2] }),
  },
  {
    pattern:
      /^Found (valuesCount=\S+) vs\. (uniqueCount=\S+?)\. Both counts should be equal.*$/,
    key: 'unique',
    params: (match) => ({ found: match[1], other: match[2] }),
  },
  {
    pattern:
      /^Found (\S+) row\(s\)\. Test query is expected to return (.+?) (\S+) row\(s\)\.?$/,
    key: 'query-rows',
    params: (match) => ({
      count: match[1],
      operator: match[2],
      threshold: match[3],
    }),
  },
  {
    pattern:
      /^Found (\d+) different rows which is more than the threshold of (\S+)$/,
    key: 'diff-rows-over',
    params: (match) => ({ count: match[1], threshold: match[2] }),
  },
  {
    pattern: /^Found (\d+) different rows\.?$/,
    key: 'diff-rows',
    params: (match) => ({ count: match[1] }),
  },
  // "Found <measured> vs. the expected <bounds>": the range checks of every column and table test
  {
    pattern: /^Found (.+?) vs\.? (?:the )?expected (.+?)\.?$/,
    key: 'expected',
    params: (match) => ({ found: match[1], expected: match[2] }),
  },
];

/**
 * The engine words its results in English; the messages it is known to send are translated.
 * `rows` are the row counts the pass rate itself is based on.
 */
export const localizeDqMessage = (
  t: TFunction,
  message: string,
  rows?: MessageRows
): string => {
  const hasRows = rows?.passedRows != null && rows.totalRows != null;
  const dimension = message.match(DIMENSION_MESSAGE);
  if (dimension) {
    return t(`${MESSAGE_PREFIX}.dimension`, {
      name: dimension[1],
      value: dimension[2],
      message: localizeDqMessage(t, dimension[3], rows),
    });
  }

  for (const rule of MESSAGE_RULES) {
    const match = message.match(rule.pattern);
    if (match) {
      const params = rule.params(match, hasRows ? rows : undefined);
      if (rule.key === 'expected') {
        // Metric names such as nullCount stay as they are; only the words around them change
        params.found = translateUnits(t, params.found);
        params.expected = translateUnits(t, params.expected);
      }

      return t(`${MESSAGE_PREFIX}.${rule.key}`, params);
    }
  }

  return message;
};

const translateUnits = (t: TFunction, text: string) =>
  text
    .replace(/\bcolumns?\b/g, t(`${MESSAGE_PREFIX}.column`))
    .replace(/\band\b/g, t(`${MESSAGE_PREFIX}.and`));
