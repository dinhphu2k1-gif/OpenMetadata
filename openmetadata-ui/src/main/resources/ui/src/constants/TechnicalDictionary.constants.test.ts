/* Copyright 2026 Collate. Licensed under the Apache License, Version 2.0. */

import {
  isTechnicalDictionaryFeatureEnabled,
  TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY,
  TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG,
  TECHNICAL_DICTIONARY_READ_PATH_FLAG,
} from './TechnicalDictionary.constants';

describe('TechnicalDictionary constants', () => {
  afterEach(() => localStorage.clear());

  it('uses an isolated column preference key', () => {
    expect(TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY).toBe(
      'governedGlossary.TECHNICAL_DICTIONARY.v1'
    );
  });

  it('keeps governed read and mutation paths independently gated', () => {
    localStorage.setItem(TECHNICAL_DICTIONARY_READ_PATH_FLAG, 'true');

    expect(
      isTechnicalDictionaryFeatureEnabled(TECHNICAL_DICTIONARY_READ_PATH_FLAG)
    ).toBe(true);
    expect(
      isTechnicalDictionaryFeatureEnabled(
        TECHNICAL_DICTIONARY_MUTATION_PATH_FLAG
      )
    ).toBe(false);
  });
});
