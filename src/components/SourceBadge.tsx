import React from "react";

export type SourceKind =
  | "official"
  | "accepted-correction"
  | "proposed-correction"
  | "self-reported"
  | "historical-spreadsheet"
  | "historical-pdf"
  | "computed"
  | "inferred"
  | "missing";

const sourceKindLabels: Record<SourceKind, string> = {
  official: "Official",
  "accepted-correction": "Accepted correction",
  "proposed-correction": "Proposed correction",
  "self-reported": "Self-reported",
  "historical-spreadsheet": "Historical spreadsheet",
  "historical-pdf": "Historical PDF",
  computed: "Computed",
  inferred: "Inferred",
  missing: "Missing",
};

const sourceKindClasses: Record<SourceKind, string> = {
  official: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-200",
  "accepted-correction":
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  "proposed-correction":
    "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-800/60 dark:bg-lime-950/50 dark:text-lime-200",
  "self-reported":
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  "historical-spreadsheet":
    "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800/60 dark:bg-purple-950/50 dark:text-purple-200",
  "historical-pdf":
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-800/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-200",
  computed:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  inferred:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  missing:
    "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400",
};

type SourceBadgeProps = {
  kind: SourceKind;
  label?: string;
  compact?: boolean;
  className?: string;
  title?: string;
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  className = "",
  compact = false,
  kind,
  label,
  title,
}) => {
  const text = label ?? sourceKindLabels[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold leading-none ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      } ${sourceKindClasses[kind]} ${className}`.trim()}
      title={title}
    >
      {text}
    </span>
  );
};

export default SourceBadge;
