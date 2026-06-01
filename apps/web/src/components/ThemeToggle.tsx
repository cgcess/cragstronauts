import React, { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light" | "party";
const THEMES: Theme[] = ["dark", "light", "party"];
const STORAGE_KEY = "cragstronauts.theme";

const ICON: Record<Theme, string> = {
  dark: "🌙",
  light: "☀️",
  party: "🪩",
};
const LABEL: Record<Theme, string> = {
  dark: "Dark mode",
  light: "Light mode",
  party: "Party mode",
};

function storedTheme(): Theme | null {
  const v = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "party" || v === "dark" ? v : null;
}

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function apply(theme: Theme) {
  const cls = document.documentElement.classList;
  cls.toggle("theme-light", theme === "light");
  cls.toggle("theme-party", theme === "party");
  // "dark" = no class (it's the :root default).
}

export default function ThemeToggle() {
  // Track whether the user has explicitly chosen a theme. Until they
  // tap the toggle, the app mirrors the OS's prefers-color-scheme.
  const userChose = useRef<boolean>(storedTheme() !== null);
  const [theme, setTheme] = useState<Theme>(
    () => storedTheme() ?? systemTheme()
  );

  // Apply the current theme + persist only after an explicit choice.
  useEffect(() => {
    apply(theme);
    if (userChose.current) localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Follow OS changes while the user hasn't picked anything yet.
  useEffect(() => {
    if (userChose.current || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? "light" : "dark");
    // Older Safari versions only support addListener / removeListener.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const cycle = () => {
    userChose.current = true;
    setTheme((cur) => THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  };
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${theme}`}
      onClick={cycle}
      aria-label={`Switch to ${LABEL[next].toLowerCase()}`}
      title={`Switch to ${LABEL[next]}`}
    >
      {ICON[theme]}
    </button>
  );
}
