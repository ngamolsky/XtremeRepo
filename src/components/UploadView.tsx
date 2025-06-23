import { Link, useSearch } from "@tanstack/react-router";
import React from "react";
import UploadPhotosView from "./UploadPhotosView";
import UploadResultsView from "./UploadResultsView";

const UploadView: React.FC = () => {
  const { tab } = useSearch({ from: "/upload" });

  const tabs = [
    { id: "results", label: "Race Results", component: UploadResultsView },
    { id: "photos", label: "Photos", component: UploadPhotosView },
  ];

  const activeTab = tabs.find((t) => t.id === tab) || tabs[0];
  const ActiveComponent = activeTab.component;

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-md animate-fade-in">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Upload Data</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tabItem) => (
            <Link
              key={tabItem.id}
              to="/upload"
              search={{ tab: tabItem.id as "results" | "photos" }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab.id === tabItem.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tabItem.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <ActiveComponent />
    </div>
  );
};

export default UploadView;
