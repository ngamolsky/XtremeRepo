import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Camera, Flag, Menu, Trophy, User, Users, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div
              aria-hidden={!mobileMenuOpen}
              className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
                mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside
              aria-label="Mobile menu"
              className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-950 ${
                mobileMenuOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    Xtreme Falcons
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Menu
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                {mobileTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTabId === tab.id;

                  return (
                    <Link
                      key={tab.id}
                      to={tab.path}
                      aria-current={activeTabId === tab.id ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-primary-600 text-white shadow-sm"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
