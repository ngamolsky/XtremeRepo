import { Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  Camera,
  History,
  LogOut,
  Trophy,
  Users,
} from "lucide-react";
import React from "react";
import { supabase } from "../lib/supabase";

const Navigation: React.FC = () => {
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const activeTab = currentPath === "/" ? "dashboard" : currentPath.slice(1);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/" },
    { id: "team", label: "Team", icon: Users, path: "/team" },
    { id: "legs", label: "Legs", icon: BarChart3, path: "/legs" },
    { id: "history", label: "History", icon: History, path: "/history" },
    { id: "photos", label: "Photos", icon: Camera, path: "/photos" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Relay Dashboard
              </h1>
              <p className="text-xs text-gray-500">Team Performance Tracker</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 ml-4"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            <select
              value={activeTab}
              onChange={(e) =>
                router.navigate({
                  to:
                    e.target.value === "dashboard" ? "/" : `/${e.target.value}`,
                })
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
