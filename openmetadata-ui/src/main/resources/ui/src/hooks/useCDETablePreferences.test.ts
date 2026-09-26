/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import { CDE_GLOSSARY_TABLE_PREFERENCE_KEY as key } from '../constants/Glossary.contant';
import { migrateCDETablePreferences } from './useCDETablePreferences';

describe('CDE column preference migration', () => {
  it('adds new columns while preserving existing choices and other tables', () => {
    const result = migrateCDETablePreferences({
      cdeGlossaryTerm: ['cdeDomains'],
      other: ['name'],
    });

    expect(result[key]).toEqual([
      'cdeDomains',
      'version',
      'releaseLevel',
      'effectiveDate',
      'expirationDate',
    ]);
    expect(result.other).toEqual(['name']);
    expect(result[key]).not.toContain('cdeOwners');
  });

  it('does not restore columns the user hides after migrating', () => {
    const saved = { cdeGlossaryTerm: ['cdeDomains'], [key]: [] };

    expect(migrateCDETablePreferences(saved)).toBe(saved);
  });

  it('handles hidden-all legacy preferences and new users', () => {
    expect(
      migrateCDETablePreferences({ cdeGlossaryTerm: [] })[key]
    ).toHaveLength(4);

    const empty = {};

    expect(migrateCDETablePreferences(empty)).toBe(empty);
  });

  it('migrates saved date-column preferences to include release level', () => {
    expect(
      migrateCDETablePreferences({
        cdeGlossaryTermDatesV1: ['cdeDomains', 'expirationDate'],
      })[key]
    ).toEqual([
      'cdeDomains',
      'expirationDate',
      'releaseLevel',
    ]);
  });
});
