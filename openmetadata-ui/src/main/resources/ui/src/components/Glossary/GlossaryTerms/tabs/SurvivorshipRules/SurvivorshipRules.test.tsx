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

import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  findSurvivorshipRule,
  parseSurvivorshipRules,
  SurvivorshipRule,
} from './survivorship.interface';
import SurvivorshipBadge from './SurvivorshipBadge.component';

describe('SurvivorshipRules Helper & Logic', () => {
  describe('findSurvivorshipRule', () => {
    const rulesMap = new Map<string, SurvivorshipRule>([
      ['db.schema.table_a.col_1', { assetFqn: 'db.schema.table_a.col_1', rank: 1, note: 'Gold' }],
      ['db.schema.table_b', { assetFqn: 'db.schema.table_b', rank: 2 }],
      ['db.schema.table_c.col_2', { assetFqn: 'db.schema.table_c.col_2', rank: 3 }],
    ]);

    it('should find rule by prefix when source is a Table and rule is on its Column', () => {
      const source = {
        name: 'table_a',
        fullyQualifiedName: 'db.schema.table_a',
      };
      const rule = findSurvivorshipRule(source, rulesMap);

      expect(rule).toBeDefined();
      expect(rule?.rank).toBe(1);
      expect(rule?.assetFqn).toBe('db.schema.table_a.col_1');
    });

    it('should find rule when source matches exactly (Table level)', () => {
      const source = {
        name: 'table_b',
        fullyQualifiedName: 'db.schema.table_b',
      };
      const rule = findSurvivorshipRule(source, rulesMap);

      expect(rule).toBeDefined();
      expect(rule?.rank).toBe(2);
    });

    it('should find rule by inspecting source.columns', () => {
      const source = {
        name: 'table_c',
        fullyQualifiedName: 'db.schema.table_c',
        columns: [
          { name: 'other_col', fullyQualifiedName: 'db.schema.table_c.other_col' },
          { name: 'col_2', fullyQualifiedName: 'db.schema.table_c.col_2' },
        ],
      };
      const rule = findSurvivorshipRule(source, rulesMap);

      expect(rule).toBeDefined();
      expect(rule?.rank).toBe(3);
    });

    it('should return undefined for unranked table', () => {
      const source = {
        name: 'table_z',
        fullyQualifiedName: 'db.schema.table_z',
      };
      const rule = findSurvivorshipRule(source, rulesMap);

      expect(rule).toBeUndefined();
    });
  });

  describe('parseSurvivorshipRules', () => {
    it('should return empty array for undefined or invalid input', () => {
      expect(parseSurvivorshipRules(undefined)).toEqual([]);
      expect(parseSurvivorshipRules('')).toEqual([]);
      expect(parseSurvivorshipRules('invalid-json')).toEqual([]);
      expect(parseSurvivorshipRules('{}')).toEqual([]);
    });

    it('should parse valid JSON array of rules', () => {
      const raw = JSON.stringify([
        { assetFqn: 'table_a', rank: 1, note: 'Golden source' },
        { assetFqn: 'table_b', rank: 2 },
      ]);
      const result = parseSurvivorshipRules(raw);

      expect(result).toHaveLength(2);
      expect(result[0].assetFqn).toBe('table_a');
      expect(result[0].rank).toBe(1);
      expect(result[0].note).toBe('Golden source');
      expect(result[1].rank).toBe(2);
    });
  });

  describe('Sorting Logic (Rank ASC -> Alphabet A-Z tie-break)', () => {
    const rulesMap = new Map<string, SurvivorshipRule>([
      ['fqn.table_c', { assetFqn: 'fqn.table_c', rank: 2 }],
      ['fqn.table_b', { assetFqn: 'fqn.table_b', rank: 1 }],
      ['fqn.table_a', { assetFqn: 'fqn.table_a', rank: 1 }],
      ['fqn.table_d', { assetFqn: 'fqn.table_d', rank: 4 }],
    ]);

    const mockAssets = [
      { name: 'table_c', fullyQualifiedName: 'fqn.table_c' },
      { name: 'table_b', fullyQualifiedName: 'fqn.table_b' },
      { name: 'table_a', fullyQualifiedName: 'fqn.table_a' },
      { name: 'table_d', fullyQualifiedName: 'fqn.table_d' },
      { name: 'table_z_unranked', fullyQualifiedName: 'fqn.table_z' },
    ];

    it('should sort assets by rank ascending, then alphabetically for same rank', () => {
      const sorted = [...mockAssets].sort((a, b) => {
        const ruleA = rulesMap.get(a.fullyQualifiedName);
        const ruleB = rulesMap.get(b.fullyQualifiedName);
        const rankA = ruleA?.rank ?? 9999;
        const rankB = ruleB?.rank ?? 9999;

        if (rankA !== rankB) {
          return rankA - rankB;
        }

        return a.name.localeCompare(b.name);
      });

      // Rank 1: table_a and table_b -> tie-break A-Z -> table_a first, then table_b
      expect(sorted[0].name).toBe('table_a');
      expect(sorted[1].name).toBe('table_b');

      // Rank 2: table_c
      expect(sorted[2].name).toBe('table_c');

      // Rank 4: table_d
      expect(sorted[3].name).toBe('table_d');

      // Unranked: table_z_unranked (rank 9999)
      expect(sorted[4].name).toBe('table_z_unranked');
    });
  });

  describe('SurvivorshipBadge Component', () => {
    it('should render Golden Source badge for Rank 1', () => {
      render(
        <SurvivorshipBadge
          rule={{ assetFqn: 'fqn.a', rank: 1, note: 'Core system' }}
        />
      );

      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText('Hạng 1 (Nguồn Vàng)')).toBeInTheDocument();
    });

    it('should render Rank 2 badge', () => {
      render(<SurvivorshipBadge rule={{ assetFqn: 'fqn.b', rank: 2 }} />);

      expect(screen.getByText('🥈')).toBeInTheDocument();
      expect(screen.getByText('Hạng 2')).toBeInTheDocument();
    });

    it('should render Rank 3 badge', () => {
      render(<SurvivorshipBadge rule={{ assetFqn: 'fqn.c', rank: 3 }} />);

      expect(screen.getByText('🥉')).toBeInTheDocument();
      expect(screen.getByText('Hạng 3')).toBeInTheDocument();
    });

    it('should render Rank N badge for rank > 3 without limit', () => {
      render(<SurvivorshipBadge rule={{ assetFqn: 'fqn.d', rank: 5 }} />);

      expect(screen.getByText('🏷️')).toBeInTheDocument();
      expect(screen.getByText('Hạng 5')).toBeInTheDocument();
    });

    it('should return null when rule or rank is missing', () => {
      const { container } = render(<SurvivorshipBadge />);

      expect(container.firstChild).toBeNull();
    });
  });
});
