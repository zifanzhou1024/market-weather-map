# Agent rules — market-weather-map

Static GitHub Pages dashboard. Vite + React + TypeScript frontend reads JSON under `public/data/`. Python (3.11) + GitHub Actions ingest public sources and write static JSON. The Pages workflow runs `npm run build` and uploads `dist/`.

## Hard constraints

- No backend service, database, or live market feed.
- No browser-side provider calls, API keys, or secrets — not in Vite, frontend code, public JSON, logs, docs, or env.
- All external data ingestion runs in `scripts/ingest/...` or GitHub Actions only.
- Frontend reads only static JSON under `public/data/`.
- Output is descriptive. No financial advice, forecasts, trade recommendations, or buy/sell/short/target/stop language. Match the tone in `docs/LIMITATIONS.md`.
- Charts: existing views use Recharts; new heavy charts (heatmap, waterfall, multi-axis, data-zoom, brush) should use ECharts via a local wrapper using `echarts/core` modular imports + `CanvasRenderer`. Do not add Plotly, Highcharts, or `echarts-for-react`.

## Source gating

A source moves from `terms_review_needed` to `free_public` only after `docs/source_reviews/<name>.md` documents access, automation, attribution, redistribution, and cadence — and a corresponding promotion PR. Until then, the source may surface in readiness UI but must NOT enter active scores, regime labels, checklists, or confidence.

Currently gated, do not promote without an updated review: ICE MOVE, Cboe SKEW, Cboe put/call, Cboe/CFE VX futures curve, NY Fed ACM term premium. See `docs/source_reviews/`.

## Verification before claiming done

```bash
npm test
npm run build
python -m pytest tests/python -v
python -m scripts.validate.validate_schema
python -m scripts.validate.validate_freshness
```

For data-only changes, also run `python -m scripts.update_data` to confirm the safe-update path (it preserves prior good JSON and records failures in `public/data/status/data_status.json`).

## Layout

- Specs and plans: `docs/superpowers/specs/`, `docs/superpowers/plans/` (filenames dated `YYYY-MM-DD-...`).
- Source reviews: `docs/source_reviews/<source>.md`.
- Generated JSON: `public/data/{catalog,derived,events,series,status}/`.
- Frontend: routes in `src/routes/`, components in `src/components/`.
- Python: `scripts/{ingest,transform,validate,shared}/`.
- Methodology and limits: `docs/METHODOLOGY.md`, `docs/LIMITATIONS.md`.
- Next-phase playbook: `.claude/skills/market-weather-map-next-phase/SKILL.md`.

## Style

- Plain English. No emojis in UI, code, or docs unless explicitly requested.
- Every new `public/data/...` file needs a schema check in `scripts/validate/validate_schema.py` and a freshness expectation in `validate_freshness.py`.
- Every new candidate or active source needs a `docs/source_reviews/<name>.md` entry first.
