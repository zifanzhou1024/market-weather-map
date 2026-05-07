import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Commodities from "./routes/Commodities";
import Credit from "./routes/Credit";
import DollarGlobal from "./routes/DollarGlobal";
import FragilityShockRisk from "./routes/FragilityShockRisk";
import Growth from "./routes/Growth";
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
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/tactical" element={<TacticalTradingWeather />} />
        <Route path="/fragility" element={<FragilityShockRisk />} />
        <Route path="/macro-climate" element={<LongTermMacroClimate />} />
        <Route path="/regime-map" element={<RegimeMap />} />
        <Route path="/growth" element={<Growth />} />
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
  );
}
