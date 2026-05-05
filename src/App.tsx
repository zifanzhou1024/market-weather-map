import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Calendar from "./routes/Calendar";
import Commodities from "./routes/Commodities";
import Credit from "./routes/Credit";
import DollarGlobal from "./routes/DollarGlobal";
import Growth from "./routes/Growth";
import Housing from "./routes/Housing";
import Inflation from "./routes/Inflation";
import Liquidity from "./routes/Liquidity";
import Methodology from "./routes/Methodology";
import Overview from "./routes/Overview";
import Rates from "./routes/Rates";
import Sentiment from "./routes/Sentiment";
import Volatility from "./routes/Volatility";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
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
  );
}
