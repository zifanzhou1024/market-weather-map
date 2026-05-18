import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import PersistentRegimeHeader from "./PersistentRegimeHeader";
import RouteLoading from "./RouteLoading";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { loadCockpit } from "../lib/data";
import { useKeyboardShortcuts } from "../lib/keyboardShortcuts";
import { LocaleProvider, useT } from "../lib/i18n";
import type { CockpitFile } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
  ariaLabel?: string;
  end?: boolean;
}

const SCROLL_THIN_THRESHOLD_PX = 80;

export default function AppLayout() {
  return (
    <LocaleProvider>
      <AppLayoutInner />
    </LocaleProvider>
  );
}

function AppLayoutInner() {
  const { t } = useT();
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

  const localizedNavItems: readonly NavItem[] = [
    { to: "/", label: t("nav.overview"), end: true, ariaLabel: t("nav.overview") },
    { to: "/short-term", label: t("nav.shortTerm"), ariaLabel: t("routes.shortTermHeading") },
    { to: "/long-term", label: t("nav.longTerm"), ariaLabel: t("routes.longTermHeading") },
    { to: "/fragility", label: t("nav.fragility") },
    { to: "/channels", label: t("nav.channels") },
    { to: "/history", label: t("nav.history") }
  ];

  const localizedMoreItems: readonly NavItem[] = [
    { to: "/diff", label: t("nav.diff") },
    { to: "/calendar", label: t("nav.calendar") },
    { to: "/methodology", label: t("nav.methodology") }
  ];

  return (
    <div className="app">
      <PersistentRegimeHeader cockpit={cockpit} />
      <header className={`site-header${isScrolled ? " site-header--scrolled" : ""}`}>
        <div className="site-header__masthead">
          <p className="eyebrow">{t("chrome.eyebrow")}</p>
          <h1>{t("chrome.mastheadTitle")}</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {localizedNavItems.map((item) => (
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
            <summary className="nav-link">{t("nav.more")}</summary>
            <div className="site-nav__more-menu">
              {localizedMoreItems.map((item) => (
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
