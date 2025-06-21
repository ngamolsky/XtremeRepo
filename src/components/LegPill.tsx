import { Link } from "@tanstack/react-router";
import React from "react";

interface LegPillProps {
  leg: number;
  version: number;
  className?: string;
  children: React.ReactNode;
}

export const LegPill: React.FC<LegPillProps> = ({
  leg,
  version,
  className,
  children,
}) => {
  return (
    <Link
      to="/legs/$legNumber/$version"
      params={{
        legNumber: leg.toString(),
        version: version.toString(),
      }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
};
