type GradeAdjustedPaceInput = {
  distanceMiles: number | null | undefined;
  elevationGainFeet: number | null | undefined;
  pace: number | null | undefined;
};

const FEET_PER_MILE = 5280;
const MAX_UPHILL_GRADE_FACTOR = 2.2;

export function getGradeAdjustedPace({
  distanceMiles,
  elevationGainFeet,
  pace,
}: GradeAdjustedPaceInput) {
  if (
    pace === null ||
    pace === undefined ||
    distanceMiles === null ||
    distanceMiles === undefined ||
    elevationGainFeet === null ||
    elevationGainFeet === undefined ||
    !Number.isFinite(pace) ||
    !Number.isFinite(distanceMiles) ||
    !Number.isFinite(elevationGainFeet) ||
    pace <= 0 ||
    distanceMiles <= 0 ||
    elevationGainFeet < 0
  ) {
    return null;
  }

  if (elevationGainFeet === 0) {
    return pace;
  }

  const averageUphillGrade = elevationGainFeet / (distanceMiles * FEET_PER_MILE);
  const gradeFactor = Math.min(
    MAX_UPHILL_GRADE_FACTOR,
    1 + 5.6 * averageUphillGrade + 20 * averageUphillGrade * averageUphillGrade
  );

  return pace / gradeFactor;
}

export function formatGradeAdjustedPace(pace: number | null | undefined) {
  if (!pace || pace === Infinity || Number.isNaN(pace)) {
    return "N/A";
  }

  const totalSeconds = Math.round(pace * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
}
