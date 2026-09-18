/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import { useEffect } from 'react';
import {
  CDE_GLOSSARY_TABLE_COLUMNS_KEYS,
  CDE_GLOSSARY_TABLE_PREFERENCE_KEY,
} from '../constants/Glossary.contant';
import { useCurrentUserPreferences } from './currentUserStore/useCurrentUserStore';

export const migrateCDETablePreferences = (
  preferences: Record<string, string[]>
): Record<string, string[]> => {
  const old = preferences.cdeGlossaryTerm;
  if (!old || preferences[CDE_GLOSSARY_TABLE_PREFERENCE_KEY] !== undefined) {
    return preferences;
  }

  return {
    ...preferences,
    [CDE_GLOSSARY_TABLE_PREFERENCE_KEY]: Array.from(
      new Set([
        ...old,
        CDE_GLOSSARY_TABLE_COLUMNS_KEYS.VERSION,
        CDE_GLOSSARY_TABLE_COLUMNS_KEYS.EFFECTIVE_DATE,
        CDE_GLOSSARY_TABLE_COLUMNS_KEYS.EXPIRATION_DATE,
      ])
    ),
  };
};

export const useCDETablePreferences = () => {
  const {
    preferences: { selectedEntityTableColumns },
    setPreference,
  } = useCurrentUserPreferences();
  useEffect(() => {
    const migrated = migrateCDETablePreferences(
      selectedEntityTableColumns ?? {}
    );
    if (migrated !== selectedEntityTableColumns) {
      setPreference({ selectedEntityTableColumns: migrated });
    }
  }, [selectedEntityTableColumns, setPreference]);
};
