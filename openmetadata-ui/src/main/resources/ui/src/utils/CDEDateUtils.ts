/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
import { DateTime } from 'luxon';

export const CDE_DATE_FIELDS = ['effectiveDate', 'expirationDate'] as const;
export type CDEDateField = (typeof CDE_DATE_FIELDS)[number];
export type CDEDates = Partial<Record<CDEDateField, string | null>>;

// Empty and invalid are distinct: an empty value explicitly clears a date.
export const normalizeCDEDate = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  if (!text) {
    return '';
  }
  const format = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? 'yyyy-MM-dd'
    : /^\d{2}\/\d{2}\/\d{4}$/.test(text)
    ? 'dd/MM/yyyy'
    : undefined;
  const date = format ? DateTime.fromFormat(text, format) : undefined;

  return date?.isValid ? date.toFormat('yyyy-MM-dd') : undefined;
};

export const formatCDEDate = (value: unknown, placeholder = '--'): string => {
  const normalized = normalizeCDEDate(value);

  return normalized
    ? DateTime.fromISO(normalized).toFormat('dd/MM/yyyy')
    : placeholder;
};

export const validateCDEDates = (dates: CDEDates): string | undefined => {
  const start = normalizeCDEDate(dates.effectiveDate);
  const end = normalizeCDEDate(dates.expirationDate);
  if (start === undefined || end === undefined) {
    return 'cde.invalid-date';
  }
  if (start && end && end < start) {
    return 'cde.invalid-date-range';
  }

  return undefined;
};

// Missing keys preserve existing dates; present, empty keys remove them.
export const mergeCDEDates = (
  extension: Record<string, unknown>,
  dates: CDEDates
): Record<string, unknown> => {
  const result = { ...extension };
  CDE_DATE_FIELDS.forEach((key) => {
    if (dates[key] !== undefined) {
      const value = normalizeCDEDate(dates[key]);
      if (value === undefined) {
        throw new Error('cde.invalid-date');
      }
      if (value) {
        result[key] = value;
      } else {
        delete result[key];
      }
    }
  });
  const error = validateCDEDates(result as CDEDates);
  if (error) {
    throw new Error(error);
  }

  return result;
};
