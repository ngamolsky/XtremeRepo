import { Link } from "@tanstack/react-router";
import React from "react";
import { formatLegLabel } from "../lib/legVersion";

interface LegPillProps {
  leg: number;
  version?: number | null;
  className?: string;
  children?: React.ReactNode;
}

export const LegPill: React.FC<LegPillProps> = ({
  leg,
  className,
  children,
}) => {
  return (
    <Link
      to="/legs/$legNumber"
      params={{
        legNumber: leg.toString(),
      }}
      aria-label={`View ${formatLegLabel(leg)} details`}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? formatLegLabel(leg)}
    </Link>
  );
};
