import { Link } from "@tanstack/react-router";
import React from "react";
import { formatLegLabel } from "../lib/legVersion";

interface LegPillProps {
  leg: number;
  version: number;
  className?: string;
  children?: React.ReactNode;
  showVersion?: boolean;
}

export const LegPill: React.FC<LegPillProps> = ({
  leg,
  version,
  className,
  children,
  showVersion = false,
}) => {
  return (
    <Link
      to="/legs/$legNumber/$version"
      params={{
        legNumber: leg.toString(),
        version: version.toString(),
      }}
      aria-label={`View ${formatLegLabel(leg, version, { alwaysShowVersion: true })} details`}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? formatLegLabel(leg, version, { alwaysShowVersion: showVersion })}
    </Link>
  );
};
