import React, { useEffect, useRef, useState } from "react";
import { PARTY_OPT_OUT_KEY, partyDayActive } from "../lib/partyDay";

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
  // On the party day we surface party mode for everyone without persisting it,
  // so saved preferences survive untouched and normal behavior resumes after.
  const partyDay = useRef<boolean>(partyDayActive());

  // Track whether the user has explicitly chosen a theme. Until they
  // tap the toggle, the app mirrors the OS's prefers-color-scheme — except
  // on the party day, where the forced default must not be persisted.
  const userChose = useRef<boolean>(!partyDay.current && storedTheme() !== null);
  const [theme, setTheme] = useState<Theme>(() =>
    partyDay.current ? "party" : storedTheme() ?? systemTheme()
  );

  // Apply the current theme + persist only after an explicit choice.
  useEffect(() => {
    apply(theme);
    if (userChose.current) localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Follow OS changes while the user hasn't picked anything yet — but not on
  // the party day, where the party default should hold until the user acts.
  useEffect(() => {
    if (
      partyDay.current ||
      userChose.current ||
      typeof window === "undefined" ||
      !window.matchMedia
    )
      return;
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
    // A manual change on the party day opts the user out of the forced default
    // for the rest of the day and becomes a normal, persisted choice.
    if (partyDay.current) {
      partyDay.current = false;
      localStorage.setItem(PARTY_OPT_OUT_KEY, String(new Date().getFullYear()));
    }
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
