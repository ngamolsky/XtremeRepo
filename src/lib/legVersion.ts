export const CURRENT_LEG_VERSION = 2;

export function isCurrentLegVersion(version: number | null | undefined) {
  return version === CURRENT_LEG_VERSION;
}

export function formatLegLabel(
  legNumber: number | null | undefined,
  version: number | null | undefined,
  options: { alwaysShowVersion?: boolean; currentVersion?: number } = {}
) {
  if (legNumber === null || legNumber === undefined) {
    return "Unknown leg";
  }

  const currentVersion = options.currentVersion ?? CURRENT_LEG_VERSION;
  const shouldShowVersion =
    options.alwaysShowVersion || (version !== null && version !== undefined && version !== currentVersion);

  return shouldShowVersion && version !== null && version !== undefined
    ? `Leg ${legNumber} v${version}`
    : `Leg ${legNumber}`;
}
