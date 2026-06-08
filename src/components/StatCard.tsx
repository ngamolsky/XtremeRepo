import React from "react";

interface StatCardProps {
  detail?: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  value: string;
}

export const StatCard: React.FC<StatCardProps> = ({ detail, icon, label, value }) => {
  return (
    <div className="card flex h-full min-h-32 items-center p-4">
      <div className="mr-4 shrink-0 rounded-full bg-gray-100 p-3">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-gray-500 uppercase">{label}</h3>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {detail && (
          <div className="mt-2 text-xs text-gray-500">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
};
