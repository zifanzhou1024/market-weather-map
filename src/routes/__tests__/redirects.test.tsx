import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// Helper component that records the resolved location after navigation settles.
function LocationProbe({ onLocation }: { onLocation: (path: string, search: string) => void }) {
  const loc = useLocation();
  onLocation(loc.pathname, loc.search);
  return null;
}

let container: HTMLDivElement;
beforeEach(() => {
  // @ts-expect-error -- React 18 act environment flag is not in the public types.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  document.body.removeChild(container);
});

// We test the redirect contract using a minimal Routes block that mirrors
// the redirect-only portion of App.tsx — this isolates the test from the
// rest of App's lazy loads / data fetching.
const REDIRECT_CASES: Array<[string, string, string]> = [
  ["/volatility", "/channels", "?tab=volatility"],
  ["/rates", "/channels", "?tab=rates"],
  ["/liquidity", "/channels", "?tab=liquidity"],
  ["/credit", "/channels", "?tab=credit"],
  ["/dollar-global", "/channels", "?tab=dollar"],
  ["/commodities", "/channels", "?tab=commodities"],
  ["/growth", "/channels", "?tab=growth"],
  ["/housing", "/channels", "?tab=housing"],
  ["/inflation", "/channels", "?tab=inflation"],
  ["/sentiment", "/channels", "?tab=positioning"],
  ["/regime-map", "/history", "?tab=regime"],
  ["/replay", "/history", "?tab=replay"]
];

function renderAtPath(initialPath: string) {
  let location: { pathname: string; search: string } = { pathname: "", search: "" };
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/channels/*"
            element={
              <LocationProbe onLocation={(p, s) => (location = { pathname: p, search: s })} />
            }
          />
          <Route
            path="/history/*"
            element={
              <LocationProbe onLocation={(p, s) => (location = { pathname: p, search: s })} />
            }
          />
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
          <Route path="/regime-map" element={<Navigate to="/history?tab=regime" replace />} />
          <Route path="/replay" element={<Navigate to="/history?tab=replay" replace />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return location;
}

describe("Detail-route redirects (mirror of App.tsx contract)", () => {
  test.each(REDIRECT_CASES)("%s redirects to %s%s", (oldPath, newPath, newSearch) => {
    const loc = renderAtPath(oldPath);
    expect(loc.pathname).toBe(newPath);
    expect(loc.search).toBe(newSearch);
  });
});
