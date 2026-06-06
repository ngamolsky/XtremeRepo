import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Camera, Flag, Trophy, User, Users } from "lucide-react";
import React from "react";
import { getActiveNavId } from "../lib/navigation";
import ThemeToggle from "./ThemeToggle";

const Navigation: React.FC = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/" },
    { id: "team", label: "Team", icon: Users, path: "/team" },
    { id: "legs", label: "Legs", icon: BarChart3, path: "/legs" },
    { id: "races", label: "Races", icon: Flag, path: "/races" },
    { id: "photos", label: "Photos", icon: Camera, path: "/photos" },
  ];

  const activeTabId = getActiveNavId(pathname);
  const mobileTabs = [
    ...tabs,
    { id: "profile", label: "Me", icon: User, path: "/profile" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 dark:bg-slate-950/90 dark:border-slate-800 dark:shadow-none dark:backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            aria-label="Go to dashboard"
            className="flex min-w-0 items-center space-x-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-slate-900"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap sm:text-xl">
                <span className="sm:hidden">Xtreme</span>
                <span className="hidden sm:inline">Xtreme Falcons</span>
              </h1>
              <p className="hidden text-xs text-gray-500 sm:block">
                Falcon Relay Tracker
              </p>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  activeOptions={tab.path === "/" ? { exact: true } : {}}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                  activeProps={{
                    className:
                      "bg-primary-50 text-primary-700 border border-primary-200",
                  }}
                  inactiveProps={{
                    className:
                      "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}

            {/* Profile Button */}
            <ThemeToggle className="ml-3" />
            <Link
              to="/profile"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
              activeProps={{
                className:
                  "bg-primary-50 text-primary-700 border border-primary-200",
              }}
            >
              <User className="w-4 h-4" />
              <span>Me</span>
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex min-w-0 items-center gap-2">
            <ThemeToggle />
            <div
              role="list"
              aria-label="Primary navigation"
              className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-slate-800 dark:bg-slate-900"
            >
              {mobileTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;

                return (
                  <Link
                    key={tab.id}
                    to={tab.path}
                    aria-current={activeTabId === tab.id ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
