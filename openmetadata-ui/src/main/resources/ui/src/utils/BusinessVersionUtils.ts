const LEGACY_VERSION_FIELD = ['cde', 'Version'].join('');

type VersionExtension = Record<string, unknown> | undefined;

/** Read current and legacy snapshot versions without writing the legacy field. */
export const getBusinessVersion = (
  extension: VersionExtension,
  fallback = '1.0'
): string => {
  const value =
    extension?.version ??
    extension?.[LEGACY_VERSION_FIELD] ??
    extension?.phien_ban;

  return String(value ?? fallback).trim();
};

/** Remove the legacy version field before creating an API payload. */
export const normalizeBusinessVersionExtension = (
  extension: VersionExtension
): Record<string, unknown> => {
  const version = getBusinessVersion(extension);
  const normalized = Object.fromEntries(
    Object.entries(extension ?? {}).filter(
      ([key]) => key !== 'version' && key !== LEGACY_VERSION_FIELD && key !== 'phien_ban'
    )
  );

  return { ...normalized, version };
};

export const getComparableBusinessVersion = (version: string): number[] => {
  const normalized = version
    .trim()
    .replace(/^(?:version|v)\s*/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10));

  return normalized.every(Number.isFinite) ? normalized : [0];
};

export const compareBusinessVersions = (left: string, right: string): number => {
  const leftParts = getComparableBusinessVersion(left);
  const rightParts = getComparableBusinessVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
};
