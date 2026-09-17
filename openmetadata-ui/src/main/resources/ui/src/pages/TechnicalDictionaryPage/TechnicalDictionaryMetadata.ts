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

interface TechnicalColumnMetadata {
  fullyQualifiedName?: string;
  dataLength?: number;
  precision?: number;
  scale?: number;
  dataTypeDisplay?: string;
  extension?: {
    survivorshipRank?: number;
    survivorshipNote?: string;
  };
}

export const getTechnicalColumnMetadata = (
  column: TechnicalColumnMetadata,
  rules?: Map<string, { rank: number; note?: string }>
) => {
  const fqn = column.fullyQualifiedName?.trim().toLowerCase();
  const rule = fqn
    ? Array.from(rules?.entries() ?? []).find(
        ([key]) => key.trim().toLowerCase() === fqn
      )?.[1]
    : undefined;
  // Older column indexes only expose length/precision in the SQL type display.
  const dimensions = column.dataTypeDisplay?.match(
    /^\s*(?:n?varchar2?|n?char|character(?:\s+varying)?|varbinary|binary|decimal|numeric|number)\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*|(?:char|byte)\s*)?\)/i
  );

  return {
    dataLength:
      column.dataLength ??
      column.precision ??
      (dimensions ? Number(dimensions[1]) : undefined),
    scale:
      column.scale ?? (dimensions?.[2] ? Number(dimensions[2]) : undefined),
    survivorshipRank: rule?.rank ?? column.extension?.survivorshipRank,
    survivorshipNote: rule ? rule.note : column.extension?.survivorshipNote,
  };
};
