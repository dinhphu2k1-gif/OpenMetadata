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

export interface SurvivorshipRule {
  assetFqn: string;
  rank: number; // 1, 2, 3, ... N
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type SurvivorshipRulesMap = Map<string, SurvivorshipRule>;

export const parseSurvivorshipRules = (
  rawRules?: unknown
): SurvivorshipRule[] => {
  if (!rawRules) {
    return [];
  }
  if (Array.isArray(rawRules)) {
    return rawRules as SurvivorshipRule[];
  }
  if (typeof rawRules === 'string') {
    try {
      const parsed = JSON.parse(rawRules);
      if (Array.isArray(parsed)) {
        return parsed as SurvivorshipRule[];
      }
    } catch {
      return [];
    }
  }

  return [];
};

export interface SurvivorshipSourceCandidate {
  name?: string;
  fullyQualifiedName?: string;
  columns?: Array<{
    name?: string;
    fullyQualifiedName?: string;
    extension?: {
      survivorshipRank?: number;
      survivorshipNote?: string;
    };
  }>;
  extension?: {
    survivorshipRank?: number;
    survivorshipNote?: string;
  };
}

export const findSurvivorshipRule = (
  source: SurvivorshipSourceCandidate | unknown,
  rulesMap: Map<string, SurvivorshipRule>
): SurvivorshipRule | undefined => {
  if (!source || rulesMap.size === 0) {
    return undefined;
  }

  const candidate = source as SurvivorshipSourceCandidate;
  const fqn = (candidate.fullyQualifiedName ?? candidate.name ?? '').trim();
  const fqnLower = fqn.toLowerCase();

  const matchingRules: SurvivorshipRule[] = [];

  // 1. Exact match on table/column FQN
  if (rulesMap.has(fqn)) {
    matchingRules.push(rulesMap.get(fqn) as SurvivorshipRule);
  }
  for (const [key, rule] of rulesMap.entries()) {
    if (key.toLowerCase() === fqnLower || rule.assetFqn.toLowerCase() === fqnLower) {
      matchingRules.push(rule);
    }
  }

  // 2. Check columns inside source (if source is a Table with columns)
  const columns = candidate.columns || [];
  for (const col of columns) {
    const colFqn = (col.fullyQualifiedName || `${fqn}.${col.name || ''}`).trim();
    const colFqnLower = colFqn.toLowerCase();

    if (rulesMap.has(colFqn)) {
      matchingRules.push(rulesMap.get(colFqn) as SurvivorshipRule);
    }
    for (const [key, rule] of rulesMap.entries()) {
      if (key.toLowerCase() === colFqnLower || rule.assetFqn.toLowerCase() === colFqnLower) {
        matchingRules.push(rule);
      }
    }
    if (col.extension?.survivorshipRank) {
      matchingRules.push({
        assetFqn: colFqn,
        rank: col.extension.survivorshipRank,
        note: col.extension.survivorshipNote,
      });
    }
  }

  // 3. Prefix match: any rule in rulesMap whose assetFqn starts with `${fqn}.` (e.g. tableFqn.columnName)
  for (const [key, rule] of rulesMap.entries()) {
    const ruleFqnLower = (rule.assetFqn || key).toLowerCase();
    if (ruleFqnLower.startsWith(`${fqnLower}.`)) {
      matchingRules.push(rule);
    }
  }

  // 4. Reverse prefix match: if source is a column, check if rule is for the table
  for (const [key, rule] of rulesMap.entries()) {
    const ruleFqnLower = (rule.assetFqn || key).toLowerCase();
    if (fqnLower.startsWith(`${ruleFqnLower}.`)) {
      matchingRules.push(rule);
    }
  }

  // 5. Source entity extension fallback
  const sourceExt = candidate.extension;
  if (sourceExt?.survivorshipRank) {
    matchingRules.push({
      assetFqn: fqn,
      rank: sourceExt.survivorshipRank,
      note: sourceExt.survivorshipNote,
    });
  }

  if (matchingRules.length === 0) {
    return undefined;
  }

  // Return the rule with the best (lowest number) rank
  return matchingRules.reduce((best, curr) => (curr.rank < best.rank ? curr : best));
};
