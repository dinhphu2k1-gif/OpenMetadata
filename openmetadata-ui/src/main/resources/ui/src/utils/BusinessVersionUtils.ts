/** Read the canonical business version. */
export const getBusinessVersion = (
  businessVersion?: string,
  fallback = '1.0'
): string => {
  return String(businessVersion ?? fallback).trim();
};

export const getComparableBusinessVersion = (version: string): number[] => {
  const normalized = version
    .trim()
    .replace(/^(?:version|v)\s*/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10));

  return normalized.every(Number.isFinite) ? normalized : [0];
};

export const compareBusinessVersions = (
  left: string,
  right: string
): number => {
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
