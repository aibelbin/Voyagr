# Voyagr

Node-based travel itinerary planner. Build a trip the same way you'd build a
workflow: drag travel stops onto a canvas, connect them, and plan against a
budget.

Voyagr is a **non-commercial fork of [n8n](https://n8n.io)** — it reuses n8n's
visual editor, with automation nodes removed and replaced by travel nodes
(hotels, flights, restaurants, activities, and more).

## Features

- **My Trips** — list and open itineraries with dates, stops, origin, and budget
- **Travel canvas** — Start Trip plus hotels, destinations, food, transport,
  experiences, shopping, and free time
- **Place search** — real places via Google Places (photos, ratings, price tier)
- **Plan with AI** — generate three complete itinerary options from destination,
  dates, budget, and preferences
- **Budget bar** — per-stop costs and per-option totals against your trip budget

## Quick start

```bash
# from repo root
CI=1 pnpm build:n8n                          # production build (~2 min)
N8N_DIAGNOSTICS_ENABLED=false pnpm start     # start server
# open http://localhost:5678
```

- **Node** ≥22, **pnpm** 10
- Set `CI=1` on install/build so the lefthook prepare step is skipped
- Prefer `build:n8n` before first run; use `pnpm dev` only after an initial build
- Local owner account (sqlite): `owner@voyagr.local` / `Voyagr1234`

Env keys (never shown in the UI): `VOYAGR_GOOGLE_PLACES_KEY`, `VOYAGR_GROQ_KEY`.
Put `.env` where the server reads it — see [docs/VOYAGR.md](docs/VOYAGR.md).

## Docs

- **[docs/VOYAGR.md](docs/VOYAGR.md)** — project status, how to run, key files, gotchas
- Design specs and plans: `docs/superpowers/`

## License

This project inherits n8n's [Sustainable Use License](LICENSE.md). Voyagr must
remain **non-commercial** (free), keep upstream copyright notices, and not use
Enterprise (`.ee.`) files. See [docs/VOYAGR.md](docs/VOYAGR.md#7-licensing).
