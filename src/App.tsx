import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { ModeProvider } from "./lib/mode";
import Overview from "./routes/Overview";

// Lazy-loaded top-level routes. Suspense fallback lives inside AppLayout so the
// header/nav shell stays mounted while only the route body shows the fallback.
// Overview stays eagerly imported because it is the primary landing route and a
// Suspense flash on first paint would harm perceived performance.
const TacticalTradingWeather = lazy(() => import("./routes/TacticalTradingWeather"));
const LongTermMacroClimate = lazy(() => import("./routes/LongTermMacroClimate"));
const FragilityShockRisk = lazy(() => import("./routes/FragilityShockRisk"));
const Channels = lazy(() => import("./routes/Channels"));
const History = lazy(() => import("./routes/History"));
const Calendar = lazy(() => import("./routes/Calendar"));
const Methodology = lazy(() => import("./routes/Methodology"));
const Diff = lazy(() => import("./routes/Diff"));

export default function App() {
  return (
    <ModeProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/short-term" element={<TacticalTradingWeather />} />
          <Route path="/tactical" element={<Navigate to="/short-term" replace />} />
          <Route path="/long-term" element={<LongTermMacroClimate />} />
          <Route path="/macro-climate" element={<Navigate to="/long-term" replace />} />
          <Route path="/fragility" element={<FragilityShockRisk />} />
          <Route path="/history" element={<History />} />
          <Route path="/regime-map" element={<Navigate to="/history?tab=regime" replace />} />
          <Route path="/replay" element={<Navigate to="/history?tab=replay" replace />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/diff" element={<Diff />} />
          <Route path="/volatility" element={<Navigate to="/channels?tab=volatility" replace />} />
          <Route path="/rates" element={<Navigate to="/channels?tab=rates" replace />} />
          <Route path="/liquidity" element={<Navigate to="/channels?tab=liquidity" replace />} />
          <Route path="/credit" element={<Navigate to="/channels?tab=credit" replace />} />
          <Route path="/dollar-global" element={<Navigate to="/channels?tab=dollar" replace />} />
          <Route path="/commodities" element={<Navigate to="/channels?tab=commodities" replace />} />
          <Route path="/growth" element={<Navigate to="/channels?tab=growth" replace />} />
          <Route path="/housing" element={<Navigate to="/channels?tab=housing" replace />} />
          <Route path="/inflation" element={<Navigate to="/channels?tab=inflation" replace />} />
          <Route path="/sentiment" element={<Navigate to="/channels?tab=positioning" replace />} />
          <Route path="/methodology" element={<Methodology />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ModeProvider>
  );
}
