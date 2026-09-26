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
  const datePreferences = preferences.cdeGlossaryTermDatesV1;
  const old = datePreferences ?? preferences.cdeGlossaryTerm;
  if (!old || preferences[CDE_GLOSSARY_TABLE_PREFERENCE_KEY] !== undefined) {
    return preferences;
  }

  const addedColumns =
    datePreferences !== undefined
      ? [CDE_GLOSSARY_TABLE_COLUMNS_KEYS.RELEASE_LEVEL]
      : [
          CDE_GLOSSARY_TABLE_COLUMNS_KEYS.VERSION,
          CDE_GLOSSARY_TABLE_COLUMNS_KEYS.RELEASE_LEVEL,
          CDE_GLOSSARY_TABLE_COLUMNS_KEYS.EFFECTIVE_DATE,
          CDE_GLOSSARY_TABLE_COLUMNS_KEYS.EXPIRATION_DATE,
        ];

  return {
    ...preferences,
    [CDE_GLOSSARY_TABLE_PREFERENCE_KEY]: Array.from(
      new Set([...old, ...addedColumns])
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
