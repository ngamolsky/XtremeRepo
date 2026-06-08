import { Link, type LinkProps } from "@tanstack/react-router";
import React from "react";

export type EntityCategory =
  | "race"
  | "leg"
  | "performance"
  | "performance-entry"
  | "runner"
  | "photo"
  | "search"
  | "me";

const categoryClasses: Record<EntityCategory, string> = {
  race: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60",
  leg: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
  performance:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60",
  "performance-entry":
    "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 dark:border-purple-800/60 dark:bg-purple-950/50 dark:text-purple-200 dark:hover:bg-purple-900/60",
  runner: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/60",
  photo: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  search: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  me: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
};

type EntityPillBaseProps = {
  category: EntityCategory;
  children: React.ReactNode;
  className?: string;
};

type EntityPillProps = EntityPillBaseProps &
  (
    | { to?: undefined; params?: never; search?: never; ariaLabel?: string }
    | { to: LinkProps["to"]; params?: LinkProps["params"]; search?: LinkProps["search"]; ariaLabel?: string }
  );

const baseClasses =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-slate-950";

export const EntityPill: React.FC<EntityPillProps> = ({
  ariaLabel,
  category,
  children,
  className = "",
  ...linkProps
}) => {
  const pillClasses = `${baseClasses} ${categoryClasses[category]} ${className}`.trim();

  if ("to" in linkProps && linkProps.to) {
    return (
      <Link
        to={linkProps.to}
        params={linkProps.params}
        search={linkProps.search}
        aria-label={ariaLabel}
        className={pillClasses}
      >
        {children}
      </Link>
    );
  }

  return (
    <span aria-label={ariaLabel} className={pillClasses}>
      {children}
    </span>
  );
};

export default EntityPill;
