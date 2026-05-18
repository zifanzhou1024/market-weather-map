import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { ModeProvider } from "./lib/mode";
import Calendar from "./routes/Calendar";
import Commodities from "./routes/Commodities";
import Credit from "./routes/Credit";
import DollarGlobal from "./routes/DollarGlobal";
import FragilityShockRisk from "./routes/FragilityShockRisk";
import Growth from "./routes/Growth";
import HistoricalRegimeReplay from "./routes/HistoricalRegimeReplay";
import Housing from "./routes/Housing";
import Inflation from "./routes/Inflation";
import Liquidity from "./routes/Liquidity";
import LongTermMacroClimate from "./routes/LongTermMacroClimate";
import Methodology from "./routes/Methodology";
import Overview from "./routes/Overview";
import Rates from "./routes/Rates";
import RegimeMap from "./routes/RegimeMap";
import Sentiment from "./routes/Sentiment";
import TacticalTradingWeather from "./routes/TacticalTradingWeather";
import Volatility from "./routes/Volatility";

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
          <Route path="/regime-map" element={<RegimeMap />} />
          <Route path="/replay" element={<HistoricalRegimeReplay />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/housing" element={<Housing />} />
          <Route path="/inflation" element={<Inflation />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/liquidity" element={<Liquidity />} />
          <Route path="/credit" element={<Credit />} />
          <Route path="/volatility" element={<Volatility />} />
          <Route path="/dollar-global" element={<DollarGlobal />} />
          <Route path="/commodities" element={<Commodities />} />
          <Route path="/sentiment" element={<Sentiment />} />
          <Route path="/methodology" element={<Methodology />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ModeProvider>
  );
}
