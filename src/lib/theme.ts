export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "xtreme-falcons-theme";

const hasDOM = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

export const getInitialTheme = (): Theme => {
  if (!hasDOM()) {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const applyTheme = (theme: Theme) => {
  if (!hasDOM()) {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};
