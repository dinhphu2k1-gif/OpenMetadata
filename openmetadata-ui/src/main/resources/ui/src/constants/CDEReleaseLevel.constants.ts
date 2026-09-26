export const CDE_RELEASE_LEVEL = {
  CEO: 'CEO',
  TTQLDL: 'TTQLDL',
} as const;

export type CDEReleaseLevel =
  (typeof CDE_RELEASE_LEVEL)[keyof typeof CDE_RELEASE_LEVEL];

export const getCDEReleaseLevelValue = (
  value?: unknown
): CDEReleaseLevel | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;

  return Object.values(CDE_RELEASE_LEVEL).includes(
    candidate as CDEReleaseLevel
  )
    ? (candidate as CDEReleaseLevel)
    : undefined;
};

export const CDE_RELEASE_LEVEL_OPTIONS = [
  { label: 'Tổng Giám đốc', value: CDE_RELEASE_LEVEL.CEO },
  { label: 'TTQLDL', value: CDE_RELEASE_LEVEL.TTQLDL },
];

export const getCDEReleaseLevelLabel = (value?: unknown) =>
  CDE_RELEASE_LEVEL_OPTIONS.find(
    (option) => option.value === getCDEReleaseLevelValue(value)
  )?.label ?? '--';
