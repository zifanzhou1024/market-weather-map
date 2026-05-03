import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/volatility", label: "Volatility" },
  { to: "/rates", label: "Rates" },
  { to: "/liquidity", label: "Liquidity" },
  { to: "/credit", label: "Credit" },
  { to: "/methodology", label: "Methodology" }
];

export default function AppLayout() {
  return (
    <div className="app">
      <header className="site-header">
        <div>
          <p className="eyebrow">Delayed public data</p>
          <h1>Market Weather Map</h1>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
