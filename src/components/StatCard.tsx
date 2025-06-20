import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => {
  return (
    <div className="card p-4 flex items-center">
      <div className="p-3 rounded-full bg-gray-100 mr-4">{icon}</div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase">{label}</h3>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};
