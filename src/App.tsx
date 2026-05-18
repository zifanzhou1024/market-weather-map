import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { ModeProvider } from "./lib/mode";
import Calendar from "./routes/Calendar";
import Channels from "./routes/Channels";
import Diff from "./routes/Diff";
import FragilityShockRisk from "./routes/FragilityShockRisk";
import History from "./routes/History";
import LongTermMacroClimate from "./routes/LongTermMacroClimate";
import Methodology from "./routes/Methodology";
import Overview from "./routes/Overview";
import TacticalTradingWeather from "./routes/TacticalTradingWeather";

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
