import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import PersistentRegimeHeader from "./PersistentRegimeHeader";
import RouteLoading from "./RouteLoading";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { loadCockpit } from "../lib/data";
import { useKeyboardShortcuts } from "../lib/keyboardShortcuts";
import type { CockpitFile } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
  ariaLabel?: string;
  end?: boolean;
}

const navItems: readonly NavItem[] = [
  { to: "/", label: "Overview", end: true },
  { to: "/short-term", label: "Short-Term", ariaLabel: "Short-Term Market Reaction" },
  { to: "/long-term", label: "Long-Term", ariaLabel: "Long-Term Macro / Allocation Climate" },
  { to: "/fragility", label: "Fragility" },
  { to: "/channels", label: "Channels" },
  { to: "/history", label: "History" }
];

const moreItems: readonly NavItem[] = [
  { to: "/diff", label: "Diff" },
  { to: "/calendar", label: "Calendar" },
  { to: "/methodology", label: "Methodology" }
];

// Same threshold the PersistentRegimeHeader uses to switch to thin mode — keeps
// the two sticky chrome tiers in sync visually.
const SCROLL_THIN_THRESHOLD_PX = 80;

export default function AppLayout() {
  const [cockpit, setCockpit] = useState<CockpitFile | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const { showHelp, closeHelp } = useKeyboardShortcuts();

  useEffect(() => {
    let alive = true;
    loadCockpit()
      .then((data) => {
        if (alive) setCockpit(data);
      })
      .catch(() => {
        // Leave cockpit null - header renders its loading placeholder gracefully.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setIsScrolled(window.scrollY > SCROLL_THIN_THRESHOLD_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app">
      <PersistentRegimeHeader cockpit={cockpit} />
      <header className={`site-header${isScrolled ? " site-header--scrolled" : ""}`}>
        <div className="site-header__masthead">
          <p className="eyebrow">Delayed public data</p>
          <h1>Market Weather Map</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.ariaLabel}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
          <details className="site-nav__more">
            <summary className="nav-link">More</summary>
            <div className="site-nav__more-menu">
              {moreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </details>
        </nav>
      </header>
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
      <KeyboardShortcutsHelp open={showHelp} onClose={closeHelp} />
    </div>
  );
}
