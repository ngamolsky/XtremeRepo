import { Link, useRouter } from "@tanstack/react-router";
import { BarChart3, Camera, History, Trophy, User, Users, Upload, LogOut } from "lucide-react";
import React from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { cn } from "../lib/utils";

const Navigation: React.FC = () => {
  const router = useRouter();
  const pathname = router.state.location.pathname;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/" },
    { id: "team", label: "Team", icon: Users, path: "/team" },
    { id: "legs", label: "Legs", icon: BarChart3, path: "/legs" },
    { id: "history", label: "History", icon: History, path: "/history" },
    { id: "photos", label: "Photos", icon: Camera, path: "/photos" },
    { id: "upload", label: "Upload", icon: Upload, path: "/upload" },
  ];

  const getActiveTabId = () => {
    if (pathname === "/") {
      return "dashboard";
    }
    const topLevelPath = pathname.substring(1).split("/")[0];
    const matchingTab = tabs.find((tab) => tab.path === `/${topLevelPath}`);
    return matchingTab ? matchingTab.id : "dashboard";
  };
  const activeTabId = getActiveTabId();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleMobileNavigation = (value: string) => {
    router.navigate({
      to: value === "dashboard" ? "/" : `/${value}`,
    });
  };

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Relay Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">Team Performance Tracker</p>
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
                  activeOptions={tab.path === "/" ? { exact: true } : {}}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                    "text-muted-foreground hover:text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  activeProps={{
                    className: cn(
                      "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    ),
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Profile Button */}
            <Link
              to="/profile"
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                "text-muted-foreground hover:text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              activeProps={{
                className: cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                ),
              }}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>

            {/* Sign Out Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center space-x-2">
            <Select value={activeTabId} onValueChange={handleMobileNavigation}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center space-x-2">
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/profile"
                className="p-2"
                activeProps={{
                  className: "bg-primary text-primary-foreground",
                }}
              >
                <User className="w-4 h-4" />
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
              className="p-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
