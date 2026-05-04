import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Commodities from "./routes/Commodities";
import Credit from "./routes/Credit";
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
        <Route path="/volatility" element={<Volatility />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/liquidity" element={<Liquidity />} />
        <Route path="/credit" element={<Credit />} />
        <Route path="/commodities" element={<Commodities />} />
        <Route path="/sentiment" element={<Sentiment />} />
        <Route path="/methodology" element={<Methodology />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
