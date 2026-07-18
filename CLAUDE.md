# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A two-part system for tracking Korean national/local land-development plans (국토종합계획,
수도권정비계획, 도시정비사업 등) and scoring individual redevelopment projects by feasibility:

1. **Python data pipeline** (`db/`, `tools/`, `sources/`) — the source of truth. A hand-curated
   CSV of tracked projects, plus scripts that turn it into GeoJSON/KML.
2. **React app** (`app/`) — a ranking-table-first UI (map is secondary) that reads the generated
   GeoJSON and lets the user re-weight the feasibility score live in the browser.

Current pilot scope is 인천 부평구 (Incheon Bupyeong-gu) redevelopment projects. Real-transaction
price data and gap-investment (갭투자) calculation are deliberately **not** built here — 호갱노노
already does that well; this project's differentiation is scoring feasibility against the
historical hierarchy of national/regional plans (see `db/schema.md`'s "우선순위 판단의 2단 구조").

## Commands

### Data pipeline (Python, stdlib only — no venv/pip install needed)
```bash
python3 tools/build_geo.py        # db/plans.csv -> geo/plans.geojson + geo/plans.kml
python3 tools/test_build_geo.py   # smoke test (unittest); run after every plans.csv edit
```
Run `build_geo.py` after any edit to `db/plans.csv` or `db/stage_sequences.json` — the GeoJSON
is a build artifact, not hand-edited.

### React app (`app/`)
```bash
cd app
npm install
npm run dev      # runs sync-data first, then vite
npm run build    # sync-data -> tsc -b -> vite build
npm run lint      # oxlint
npm run sync-data # manually copy geo/plans.geojson -> app/public/data/plans.geojson
```
`app/public/data/` is gitignored — it's always regenerated from `geo/plans.geojson` via
`npm run sync-data` (see `app/scripts/sync-data.mjs`). If the app shows a fetch error, the data
just hasn't been synced yet.

No test runner is configured in `app/` yet.

### Environment note
Sandboxed dev environments here may not have Node.js/Homebrew preinstalled. If missing, download
the official macOS arm64 tarball from nodejs.org and unpack it under `~/.local/node` (no sudo),
then add `~/.local/node/bin` to `PATH`.

## Architecture

### Data flow (one direction, never reverse)
```
db/plans.csv (hand-edited source of truth)
  + db/stage_sequences.json (per-사업유형 stage order, for progress calc)
        │
        ▼  tools/feasibility.py (computes A–E raw factors + human-readable "basis" text per plan)
        │
        ▼  tools/build_geo.py (merges feasibility output into GeoJSON properties)
        │
   geo/plans.geojson / geo/plans.kml  (committed build artifacts)
        │
        ▼  app/scripts/sync-data.mjs (plain file copy, run before dev/build)
        │
   app/public/data/plans.geojson  (gitignored)
        │
        ▼  app/src/hooks/usePlansData.ts (react-query fetch)
        │
   React components
```

### Feasibility scoring: raw factors vs. weighted score are split across languages, on purpose
`tools/feasibility.py` computes five factors per plan — `A_stage_progress`, `B_pretest`,
`C_delay`, `D_infra`, `E_price_attractiveness` — each as a `{value, basis}` pair, and writes them
into GeoJSON properties **unweighted**. The weighted sum (`score = 100 × Σ(factor × weight) /
Σ(weights)`) is computed only in `app/src/lib/computeScore.ts`, using weights that live in
`app/src/store/rankingStore.ts` (Zustand) and are adjustable live via `WeightPanel.tsx`. This
means weight tuning never requires re-running the Python pipeline or touching committed data —
don't reintroduce a Python-side weighted score.

`D_infra` (infrastructure linkage) depends on other plans' A/B/C scores, so `feasibility.py`
computes it in two passes: first A/B/C for every row, then D/E using that lookup
(`compute_all()` in `tools/feasibility.py`).

`E_price_attractiveness` is derived from the manually-entered `대략가격대` column (no real-
transaction API integration) — see `db/schema.md`'s "대략가격대 작성 원칙" for the tier mapping
and why it's an estimate, not real market data.

### Stage sequences are per-사업유형, and there are two different vocabularies for "정비사업"
`db/stage_sequences.json` maps each `사업유형` value to an ordered array of stage names; a
plan's progress (`A_stage_progress`) is just its current stage's index into that array. Two
entries both cover "정비사업" but use different terminology:
- `재개발` / `재건축(도시정비법)` / `주거환경개선` use the **Incheon 추정분담금정보시스템**
  stage vocabulary (주민대표단구성 → … → 준공) because that's the real system the Bupyeong-gu
  data was scraped from — see `db/schema.md`'s 단계코드 section for why this diverges from the
  generic 도시정비법 sequence.
- Other 사업유형 values (신도시/택지개발, 광역교통, 재건축(노후계획도시)) use their own
  sequences matching how `현재단계` values are actually written in `db/plans.csv`.

If `현재단계` in a CSV row doesn't exactly match a string in that 사업유형's sequence array,
`compute_stage_progress()` silently falls back to 0.5 — check spelling first when scores look off.

### `id` numbering convention in `db/plans.csv`
IDs are never reused or renumbered (map/log data links by id). Ranges by 사업유형/batch:
`P001–P008` 3기 신도시, `P101–P103` GTX, `P201–P205` 1기 신도시 선도지구, `P301–P333` 부평구
정비사업. Add new plans with the next unused number in the relevant range, or start a new range.

### React app structure
- `App.tsx` filters `usePlansData()`'s features down to `시군구 === "부평구"` before passing them
  to `RankingTable`/`MapView` — `geo/plans.geojson` still carries the earlier 수도권 pilot rows
  (3기 신도시/GTX/1기 신도시 선도지구, `P001`–`P205`) alongside the 부평구 rows, since `db/plans.csv`
  is a shared source of truth across pilots, not a per-app dataset. If you add another region's
  app, filter here rather than trimming the CSV.
- `components/map/MapView.tsx` deliberately isolates all Leaflet/react-leaflet-specific code.
  Filtering, scoring, and state live outside it (`lib/`, `store/`) so swapping the map library
  later (e.g. to Kakao Maps for better Korean address precision) only means rewriting this one
  file.
- `components/ranking/RankingTable.tsx` is the primary UI (not the map) — it always renders the
  full ranked list, not a top-N slice.
- `lib/computeScore.ts` is the single place weighted scores and grades are computed; both
  `RankingTable` and `MapView`/`PlanDetailPanel` call it independently with the same weights from
  the store, rather than passing a pre-computed score down — keep it that way so re-weighting
  stays consistent everywhere.
- `lib/hogangnonoLink.ts` and `lib/naverLandLink.ts` both generate `site:<domain>` Google-search
  deep links rather than a guessed internal search URL — neither 호갱노노 nor 네이버부동산 has a
  public API and both search UIs are SPA-routed (호갱노노's is also signup-gated), so this is the
  only reliably-working link format. Both call the shared `lib/planSearchName.ts` first, which
  strips plans.csv's internal classification suffixes (`" / 정비구역후보지(23년 2차)"`,
  `"(현지개량)"`) from `사업명` — leaving them in the query returns zero Google results even for
  plans that do have real listings.
- `lib/types.ts` mirrors `geo/plans.geojson`'s `properties` shape field-for-field (Korean field
  names included). This exists specifically to catch schema drift between `db/plans.csv` and the
  frontend at compile time — a real bug (mismatched `lat`/`lon` vs `lat`/`lng` column names) once
  silently emptied the map. When you add/rename a `plans.csv` column that flows through to
  GeoJSON, update this file too.

### Deployment
`.github/workflows/deploy.yml` builds `app/` and deploys `app/dist` to GitHub Pages on push to
`main`. `vite.config.ts`'s `base: '/region-notes/'` must match the actual repo name if this repo
is ever renamed or forked. GitHub Pages source must be set to "GitHub Actions" in repo settings
(not done by the workflow itself).

## Data principles (from README.md, load-bearing for how you should edit data)
- **Never commit original PDFs.** Only source links (`sources/links_db.csv`) and short markdown
  summaries (`docs/plans/*.md`) belong in git — GitHub hard-blocks files over 100MB and the repo
  is meant to stay well under ~1GB. Original PDFs stay on the user's local/cloud storage.
- `db/plans.csv`'s `id` is permanent once assigned.
- Every state change to a plan needs a source URL in `출처URL`.
- Git commit history on `db/plans.csv` *is* the project timeline — `git log -p db/plans.csv` or
  GitHub's blame view is how you reconstruct a project's history, not a separate changelog table.
