export function formatLegLabel(
  legNumber: number | null | undefined,
  _version?: number | null | undefined,
  _options: { alwaysShowVersion?: boolean; currentVersion?: number } = {}
) {
  if (legNumber === null || legNumber === undefined) {
    return "Unknown leg";
  }

  return `Leg ${legNumber}`;
}
