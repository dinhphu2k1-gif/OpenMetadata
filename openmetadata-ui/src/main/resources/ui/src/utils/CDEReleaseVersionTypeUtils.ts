export const CDE_RELEASE_VERSION_TYPE = {
  MAIN: 'Bản chính',
  SECONDARY: 'Bản phụ',
} as const;

export const getCDEReleaseVersionType = (
  storedValue: unknown,
  businessVersion?: string
) => {
  const normalizedStoredValue = Array.isArray(storedValue)
    ? storedValue[0]
    : storedValue;

  if (
    normalizedStoredValue === CDE_RELEASE_VERSION_TYPE.MAIN ||
    normalizedStoredValue === CDE_RELEASE_VERSION_TYPE.SECONDARY
  ) {
    return normalizedStoredValue;
  }

  const match = businessVersion?.trim().match(/^([1-9]\d*)\.(\d+)$/);

  return match
    ? Number(match[2]) === 0
      ? CDE_RELEASE_VERSION_TYPE.MAIN
      : CDE_RELEASE_VERSION_TYPE.SECONDARY
    : undefined;
};

export const getCDEReleaseVersionTypeClassName = (value?: string) =>
  value === CDE_RELEASE_VERSION_TYPE.MAIN
    ? 'cde-value-pill-release-version-main'
    : 'cde-value-pill-release-version-secondary';
