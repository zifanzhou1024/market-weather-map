// Vitest global setup.
//
// Node 26 ships a built-in (experimental) `localStorage` global that requires
// a `--localstorage-file` CLI flag and is unrelated to jsdom's in-memory
// implementation. Under vitest 4 + jsdom 29 on Node 26, the bare Node global
// leaks through and shadows jsdom's `window.localStorage` getter (the getter
// returns undefined because the IDL wrapper is mismatched).
//
// We work around that by aliasing the inner jsdom `_localStorage`/
// `_sessionStorage` implementations onto the window + globalThis so tests can
// call `localStorage.setItem(...)` etc. without configuring CLI flags.
const w = window as unknown as {
  _localStorage?: Storage;
  _sessionStorage?: Storage;
  localStorage?: Storage;
  sessionStorage?: Storage;
};

if (w._localStorage) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => w._localStorage as Storage
  });
  (globalThis as unknown as { localStorage: Storage }).localStorage = w._localStorage;
}

if (w._sessionStorage) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    get: () => w._sessionStorage as Storage
  });
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = w._sessionStorage;
}
