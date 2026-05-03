import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<main className="page-shell">Overview loading...</main>} />
      <Route path="/volatility" element={<main className="page-shell">Volatility loading...</main>} />
      <Route path="/rates" element={<main className="page-shell">Rates loading...</main>} />
      <Route path="/liquidity" element={<main className="page-shell">Liquidity loading...</main>} />
      <Route path="/credit" element={<main className="page-shell">Credit loading...</main>} />
      <Route path="/methodology" element={<main className="page-shell">Methodology loading...</main>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
