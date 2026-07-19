# Voyagr — Design Specification

**Date:** 2026-07-20
**Status:** Approved design, pre-implementation
**Reference:** n8n editor UI (local clone at `../n8n`) for canvas visual language and interaction patterns

---

## 1. Product Vision

Voyagr is an AI-native travel planning platform where itineraries are **interactive node-based workflows**, not static text. Users describe a trip; the AI generates complete itinerary graphs they can inspect, edit, branch, and re-optimize on an n8n-style canvas. Every node is editable; every ripple-causing edit produces a reviewable AI proposal rather than a silent rewrite.

This is a real startup MVP, not a demo. The product must be honest about data (real places, clearly-labeled cost estimates), controlled in AI spend (metering from day one), and usable by everyone from spreadsheet-owning trip planners to people saving a dream trip they revisit occasionally.

**What Voyagr is not:** another chatbot itinerary generator. The canvas is the conversation.

### Personas

- **The Planner** — owns the trip logistics for a group/family. Wants control, comparison, and confidence. Desktop power user.
- **The Dreamer** — plans aspirationally, no fixed dates. Saves a trip, checks back on it (often from a phone), adjusts budget over time. Retention driver.

---

## 2. Locked Product Decisions

| Decision | Choice |
|---|---|
| Purpose | Startup MVP / real product |
| Data strategy | Hybrid: AI plans + real POI grounding (Google Places); costs are AI-estimated ranges, clearly labeled |
| Audience | Everyone; canvas is the primary UI, n8n visual language |
| Multi-itinerary | Fast lightweight variant previews → full graph generated only for picked variant(s) |
| Recompute UX | Reviewable ghost-diff proposals with accept/reject; never silent auto-apply |
| Branching | V1: alternatives drawer per node (swap-in options). No visual forked paths until v2 |
| Optimization modes | Merged with variants into one **trip style profile**; changing it triggers standard recompute |
| Trip shape | Multi-city from day one, with inter-city transport nodes |
| Views (v1) | Canvas, Timeline, Map, Split-screen (canvas+map, synced) |
| Version history | Undo/redo only in v1; named snapshots deferred (server keeps periodic snapshots as foundation) |
| Platform | Desktop-first web editing; mobile gets polished read-mostly view (notes + alternative swaps allowed) |
| Auth/sharing | Accounts (email + Google) + public read-only share links |
| Business model | Freemium with usage limits; affiliate booking links from day one; Stripe billing UI may land late in v1, metering must not |
| App architecture | Next.js full-stack monolith |
| AI architecture | Staged pipeline: Scaffold → Fill → Ground → Assemble, stages reused for scoped recompute |
| Frontend | React + React Flow (xyflow) |
| Team | Solo + AI assistance, no hard deadline; quality over speed |

---

## 3. Domain Model

### 3.1 Trip

Root object owning:

- **Inputs:** ordered destination list; dates (fixed) or flexible duration + target month; traveler count and composition (adults/kids/elderly); total budget + currency; constraints (dietary, accessibility, visa nationality, traveling-with-kids, etc.)
- **Style profile:** the unified variant/optimization concept. A small set of weights/toggles:
  - budget ↔ luxury slider
  - relaxed ↔ packed pace slider
  - interest weights: food, culture/museums, nature, nightlife, shopping, adventure, photography
  - toggles: family-friendly, minimal walking, eco-friendly, hidden-gems bias
- **Variant previews:** lightweight cards produced at creation (see §4.1)
- **Itineraries:** 1–3 fully expanded graphs (usually one; more only when the user expands a second variant to compare). Expanded itineraries appear as tabs within the trip; comparing means switching tabs with the budget bar reflecting each. Side-by-side comparison is post-v1.
- **Visa checklist:** trip-level property (not nodes) derived from nationality + destinations, shown as a trip panel

### 3.2 Itinerary graph

A directed graph with two levels of grouping:

```
Itinerary
└── City Segment (Rome, days 1–3)
    ├── Stay node (one per segment, spans its days)
    └── Day Group (Day 1)
        └── nodes connected in sequence
└── City Segment (Florence, days 4–5)
    ...
```

- Within a day, nodes form a linear sequence connected by edges.
- **Edges carry local transit metadata** — mode, duration, distance, est. cost (walk 12 min / metro €2.10) — rendered as edge labels, n8n-style. Routine local transport is *never* a node.
- Only significant transport is a node: flights, inter-city trains/buses/drives, airport transfers.
- No cross-day edges. Day ordering is implied by day group sequence; inter-city transport nodes sit between segments.

### 3.3 Node types (v1)

| Type | Notes |
|---|---|
| `flight` | Arrival/departure/inter-city. Estimated cost + deep link (Skyscanner); no live inventory search in v1 |
| `intercity_transport` | Train/bus/car legs between city segments |
| `stay` | One per city segment, spanning its days. Nightly rate × nights in budget |
| `attraction` | Sights, museums, landmarks |
| `food` | Restaurants, cafés, food tours, markets |
| `shopping` | Shops, markets, districts |
| `experience` | Tours, classes, nightlife, adventure activities |
| `free_time` | Deliberate rest/unscheduled blocks; has duration, no cost/place |
| `note` | User annotation node; no logistics |

Explicitly **not** nodes (properties/engine concerns instead): weather checks (weather-sensitivity flag on outdoor nodes), visa/documentation (trip-level checklist), budget allocation (budget engine), alternative options (per-node drawer).

### 3.4 Node properties

Grouped as shown in the node detail drawer:

- **Identity:** name, description, category, tags
- **Logistics:** place reference (`place_id`), coordinates, address, time slot (start/end), duration, opening hours, weather-sensitive flag
- **Money:** estimated cost range (low–high), per-person vs per-group, currency, confidence label (`grounded` / `estimated` / `rough`)
- **AI metadata:** interest score (fit to user's profile), AI confidence, adventurousness/temperature (how far off the beaten path this pick is), priority
- **Control:** `locked` flag — locked nodes are hard constraints; recompute never modifies or removes them
- **Links:** booking/affiliate URL, place page URL, photo
- **User:** notes (free text)
- **Alternatives:** 2–3 swappable AI-generated options (generated on demand, cached on the node). One click swaps; budget and edges update instantly.

### 3.5 Graph operations (client-side command set)

All canvas edits are expressed as typed commands (basis for undo/redo and edit classification): `addNode`, `removeNode`, `updateNodeProps`, `swapAlternative`, `moveNodeWithinDay`, `moveNodeAcrossDays`, `toggleLock`, `reorderDays`, `updateStyleProfile`, `updateTripInputs`, `acceptProposal`, `rejectProposal`.

---

## 4. AI Pipeline

### 4.1 Creation flow

1. **Wizard** collects trip inputs (destination(s) geocode-validated as you type; unresolvable destinations blocked at input time).
2. **Preview stage** — one fast, cheap model call (Haiku-tier) returns 3–5 variant cards: theme name (e.g. Budget Explorer, Food Lover), tagline, 3–4 signature activities, estimated total vs budget, one-line-per-day sketch. Target: < 10 s.
3. User picks a variant (optionally expands a second later for comparison).
4. **Full pipeline** runs as a background job; the canvas materializes day by day via streamed progress.

### 4.2 Pipeline stages

Typed JSON contracts (zod schemas) between every stage. Stages are pure functions of (inputs, context) → validated output, individually retryable.

1. **Scaffold** (Sonnet-tier) — allocates days across cities; assigns each day a theme; splits total budget into envelopes (stay / food / activities / transport, per segment); picks stay area per city; positions flights/inter-city transport.
2. **Fill** (Sonnet-tier, parallel per day-slice) — generates candidate nodes with all properties for one day (or one stay/transport slot), honoring scaffold theme, budget envelope, pace, constraints, style profile. Over-generates candidates (~1.5×) so grounding drops don't leave sparse days.
3. **Ground** — matches each candidate against Google Places (name + locality text search). Match → attach `place_id`, coordinates, opening hours, rating, photo, links; cost stays AI-estimated but confidence upgrades to `grounded`. No match → one retry with feedback → drop. Low-confidence matches flagged "verify this place."
4. **Assemble** — orders nodes within days (opening hours + geography), computes edge transit legs (Mapbox Directions; haversine-based estimate fallback), rolls up budget, runs validation (hours conflicts, overpacked days, envelope overruns) attaching warnings, emits final graph document.

### 4.3 Recompute engine

Every command from §3.5 is classified:

- **Local** — rename, notes, manual cost override, lock toggle, moving a node within a day. No AI. Budget re-rolls client-side instantly.
- **Structural** — remove node: edges heal instantly, transit legs recompute; optional "fill this gap?" affordance. Add node from palette: user fills or asks AI to suggest. Move node across days / reorder days: edges heal and transit legs recompute instantly; affected days gain an optional "re-balance this day?" affordance (no automatic AI).
- **Ripple** — style profile change, budget change, pace change, date/duration change, destination add/remove, "Ask AI" free-text requests. Triggers scoped recompute:
  1. **Dependency analysis** marks affected day-slices dirty (e.g. hotel budget cut → all `stay` nodes dirty; +1 day in Rome → Rome segment re-scaffolded, other segments untouched; pace change → all days dirty but locked nodes pinned).
  2. Re-run **Fill + Ground** on dirty slices only. Locked nodes are passed as immutable constraints; unchanged neighbors and untouched days are passed as context.
  3. Output is a **Proposal**: sets of added / removed / modified nodes + updated budget projection.

**Proposal UX:** dirty regions highlight; proposed changes render as a ghost-diff overlay (translucent green = added, red = removed, amber = modified) with a floating panel offering accept-all, reject-all, and per-change accept/reject. The real graph mutates only on accept. Accepting is one undo-able command.

### 4.4 "Ask AI" entry points

One mechanism, three scopes — node, day group, trip — each offering a free-text box ("make this evening cheaper", "add something for kids near the hotel"). Requests run the recompute pipeline scoped accordingly and return standard proposals. There is no separate chat UI.

### 4.5 Model strategy

Anthropic API. Haiku-tier: previews, edit classification assistance, alternative generation. Sonnet-tier: scaffold, fill, Ask-AI recompute. Model IDs behind a config layer so tiers can be swapped without code changes. All prompts produce structured output validated by zod; failures retry with the validation error appended.

---

## 5. Frontend

### 5.1 Canvas

React Flow (xyflow). Visual grammar borrowed from n8n (reference the local clone for spacing, node card anatomy, edge styling, group container treatment):

- Node card: category icon, color-coded left border, name, cost chip, duration chip; lock badge and warning badge when present.
- Edge label: transit mode icon + duration (+ cost when nonzero).
- Day groups as labeled containers (React Flow sub-flows); city segments as header bands.
- Auto-layout with dagre on generation and on "tidy up"; user drag positions persist and are respected until the user re-tidies.
- Zoom/pan, minimap, fit-view — standard React Flow.
- Node palette (sidebar) for manual node creation; manual edge connection allowed with validation (same-day only, no cycles).

### 5.2 Node detail drawer

Right-side drawer (n8n NDV analog), tabs: **Details / Cost / Schedule / AI / Notes**, mapping to property groups in §3.4. Alternatives drawer accessible from the node card and the drawer.

### 5.3 Views

Tab switcher: **Canvas / Timeline / Map / Split**.

- **Timeline:** clean day-by-day agenda list; the render used by share links, mobile, and print.
- **Map:** Mapbox GL; grounded nodes as numbered pins colored by day; per-day route polylines; stay nodes get a distinct marker.
- **Split:** canvas + map side by side; selection and hover sync bidirectionally.

### 5.4 Budget bar

Persistent header widget: total estimate range vs budget with green→amber→red state; expands to per-category and per-city-segment breakdowns. Implemented as a pure function over the graph document — recomputes synchronously on every command. Carries an "estimates, not quotes" disclaimer.

### 5.5 State & undo

- Graph document in a Zustand store; all mutations flow through the command set (§3.5).
- Undo/redo = client-side command stack (commands are invertible).
- Debounced save (~2 s idle) of the full document with optimistic-lock version; conflict (second tab) → reload prompt.

### 5.6 Mobile read view

Responsive Timeline + Map + Budget bar. Editing limited to notes and alternative swaps. Canvas hidden behind a "best on desktop" hint.

---

## 6. Backend

### 6.1 Stack

- Next.js App Router, TypeScript throughout, deployed on Vercel initially.
- Postgres + Drizzle ORM.
- Better Auth: email (magic link) + Google OAuth.
- Trigger.dev for pipeline jobs (retries, queues, no serverless timeout limits); progress streamed to client via SSE.

### 6.2 Data model (core tables)

- `users` — auth, plan tier
- `trips` — inputs, style profile, visa checklist, owner
- `variant_previews` — preview cards per trip
- `itineraries` — **graph as versioned JSONB document**, plus extracted columns (destinations, dates, total estimate) for listing; periodic snapshots table for crash recovery / future version history
- `share_links` — token → itinerary, read-only
- `usage_events` — every AI action: type, model, tokens, trip, timestamp
- `cached_places` — Places responses: `place_id` stored permanently; details cached within Google's ToS refresh window
- `jobs` — pipeline run status/progress

Rationale for document storage: the canvas always loads/edits the graph as a whole; a document matches the access pattern and avoids join-heavy graph reconstruction. Normalization can come later if cross-trip queries demand it.

### 6.3 External services

| Service | Use | Notes |
|---|---|---|
| Anthropic API | All generation | Tiered models per §4.5 |
| Google Places | POI grounding | Cached per ToS; quality > alternatives |
| Mapbox | Map render + Directions for transit legs | One vendor; haversine fallback when quota-constrained |
| Skyscanner / Booking.com / GetYourGuide affiliate links | Booking deep links on flight/stay/experience nodes | Revenue from day one |
| Stripe | Subscriptions | Plumbing spec'd in v1; UI may land in Phase 5 |

### 6.4 Metering & plans

- Every AI call writes a `usage_event` before/after execution.
- Free tier: N active trips, M ripple-recomputes + Ask-AI calls per month, previews cheap enough to be generous. (Exact N/M tuned at launch; enforcement layer takes them from config.)
- Enforcement at the API layer with clear limit-reached UX and upgrade path.
- Failed generations do not consume quota.

---

## 7. Error Handling

- **Schema validation everywhere:** all AI outputs validated with zod; retry with error feedback; hard failure surfaces a retriable, un-charged error state.
- **Partial delivery:** a failed day-slice doesn't sink the itinerary — deliver the rest, mark the slice "regenerate?".
- **Grounding honesty:** unmatched candidates dropped after one retry; low-confidence matches badged; costs always ranges with confidence labels.
- **Warnings never block:** hours conflicts, overpacked days, budget overruns are amber badges with proposal-based fix suggestions. Users may keep a "broken" plan.
- **Input validation:** destinations geocode-validated in the wizard; trip length capped at 21 days; past dates blocked.
- **Concurrency:** optimistic-lock version on the document; stale write → reload prompt.
- **Quota degradation:** Places/Mapbox exhaustion degrades to cached data and distance-based estimates; generation never hard-fails on third-party quota.

---

## 8. Testing

- **Pure logic (densest coverage):** budget engine, graph command set + inversion (undo), dependency analysis/dirty-marking. The dirty-marking logic is correctness-critical and gets exhaustive unit tests.
- **Pipeline stages:** contract tests with recorded fixtures; Places and Anthropic mocked; schema-conformance tests per stage.
- **E2E (Playwright):** wizard → previews → pick → generation completes → edit node → ripple edit → ghost-diff accept → share link renders.
- **Quality evals:** a fixed suite of reference trips (varied destinations, budgets, constraints) scored on grounding rate, budget adherence, constraint adherence, and day-packing sanity. Run on every prompt change; this is the "did the AI get worse?" regression net.

---

## 9. Build Phases

Each phase ends runnable and testable.

1. **Graph core, no AI** — scaffold app, auth, DB; graph document model, command set, budget engine; React Flow canvas rendering a hardcoded sample itinerary with day groups, node drawer, drag/lock/delete, undo/redo. *De-risks the hardest UX before spending a token.*
2. **Generation** — wizard, preview stage, Scaffold→Fill→Ground→Assemble, Trigger.dev + SSE streaming onto canvas, Places grounding + cache.
3. **Editing intelligence** — edit classification, dependency analysis, scoped recompute, ghost-diff proposals, alternatives drawer, Ask-AI entry points, locks. *The differentiator; gets the most slack.*
4. **Views & sharing** — Timeline, Map, Split with sync, share links, mobile read view.
5. **Productization** — metering enforcement UX, Stripe, affiliate wiring, eval hardening, onboarding polish, landing page.

### Post-v1 parking lot

Visual branch paths (weather/alternative forks), multi-user collaboration, live weather adaptation, flight-delay handling, booking integrations with live inventory, expense tracking, offline mode, packing lists, currency conversion UX, AI daily summaries, named version history, public transport optimization, in-trip AI companion.

---

## 10. Open Items (deliberately deferred to implementation planning)

- Exact free-tier limits (config-driven; tune at launch)
- Prompt engineering details per stage (developed against the eval suite)
- Precise Places ToS caching windows (verify current policy during Phase 2)
- Vercel vs VPS revisit if SSE/job patterns fight the platform
