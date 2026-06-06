import { Moon, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, Theme } from "../lib/theme";

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const isDarkMode = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextMode = isDarkMode ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextMode)}
      className={`theme-toggle ${className}`}
      aria-label={`Switch to ${nextMode} mode`}
      title={`Switch to ${nextMode} mode`}
    >
      {isDarkMode ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
};

export default ThemeToggle;
