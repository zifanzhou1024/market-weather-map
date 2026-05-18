import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import PersistentRegimeHeader from "./PersistentRegimeHeader";
import { loadCockpit } from "../lib/data";
import type { CockpitFile } from "../lib/types";

const navSections = [
  {
    label: "Primary Views",
    items: [
      { to: "/", label: "Overview" },
      { to: "/short-term", label: "Short-Term", ariaLabel: "Short-Term Market Reaction" },
      { to: "/long-term", label: "Long-Term", ariaLabel: "Long-Term Macro / Allocation Climate" },
      { to: "/fragility", label: "Fragility" },
      { to: "/regime-map", label: "Regime Map" },
      { to: "/replay", label: "Replay", ariaLabel: "Historical Regime Replay" }
    ]
  },
  {
    label: "Data Library",
    items: [
      { to: "/volatility", label: "Volatility" },
      { to: "/rates", label: "Rates" },
      { to: "/liquidity", label: "Liquidity" },
      { to: "/credit", label: "Credit" },
      { to: "/dollar-global", label: "Dollar" },
      { to: "/commodities", label: "Commodities" },
      { to: "/growth", label: "Growth" },
      { to: "/housing", label: "Housing" },
      { to: "/inflation", label: "Inflation" },
      { to: "/sentiment", label: "Positioning" }
    ]
  },
  {
    label: "Reference",
    items: [
      { to: "/calendar", label: "Calendar" },
      { to: "/methodology", label: "Methodology" }
    ]
  }
];

export default function AppLayout() {
  const [cockpit, setCockpit] = useState<CockpitFile | null>(null);

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

  return (
    <div className="app">
      <PersistentRegimeHeader cockpit={cockpit} />
      <header className="site-header">
        <div>
          <p className="eyebrow">Delayed public data</p>
          <h1>Market Weather Map</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {navSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <span className="nav-section__label">{section.label}</span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.ariaLabel}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  end={item.to === "/"}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
