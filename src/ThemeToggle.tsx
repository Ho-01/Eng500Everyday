// src/components/ThemeToggle.tsx
import React from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  // localStorage 우선, 없으면 시스템 선호
  try {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  const root = document.documentElement.classList;
  t === "dark" ? root.add("dark") : root.remove("dark");
  try {
    localStorage.setItem("theme", t);
  } catch {}
}

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = React.useState<Theme>(getInitialTheme);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((p) => (p === "dark" ? "light" : "dark"));

  return (
    <button
      onClick={toggle}
      className="text-xs px-3 py-1.5 rounded-full border bg-white/80 dark:bg-white/10 dark:text-white hover:opacity-90 active:scale-[0.98]"
      aria-label="테마 전환" // 접근성
      title={theme === "dark" ? "라이트 모드로" : "다크 모드로"}
    >
      {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
};

export default ThemeToggle;
