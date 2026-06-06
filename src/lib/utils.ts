export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
  }
  if (parts.length === 3) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
  }
  return 0;
};

export const formatPace = (pace: number): string => {
  if (!pace || pace === Infinity || isNaN(pace)) return "N/A";
  const totalSeconds = Math.round(pace * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
};

export const formatSourceType = (sourceType: string | null | undefined): string => {
  const sourceLabels: Record<string, string> = {
    apple_watch: "Apple Watch",
    garmin: "Garmin",
    phone: "Phone",
    strava: "Strava",
    manual_runner: "Runner",
    manual_admin: "Manual",
    official: "Official",
    other: "Other",
  };

  return sourceLabels[sourceType || ""] || "Other";
};

export const formatMiles = (distance: number | null | undefined): string => {
  if (distance === null || distance === undefined || !Number.isFinite(distance)) {
    return "N/A";
  }

  return `${distance.toFixed(2).replace(/\.?0+$/, "")} mi`;
};

export const formatFeet = (elevationGain: number | null | undefined): string => {
  if (elevationGain === null || elevationGain === undefined || !Number.isFinite(elevationGain)) {
    return "N/A";
  }

  return `${elevationGain} ft`;
};

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};
