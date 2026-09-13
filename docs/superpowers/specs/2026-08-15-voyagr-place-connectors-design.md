# Voyagr — Place Connectors

_Design spec. Date: 2026-08-15. Build this BEFORE the AI trip generator
(`2026-08-15-voyagr-ai-trip-generator-design.md`), which depends on it._

**This spec is self-contained.** It assumes no prior conversation.

---

## 1. What Voyagr is

Voyagr is a **travel itinerary planner built as a fork of the n8n monorepo**.
The repo at `~/Documents/Code/Voyagr` **is** the n8n monorepo, vendored and
rebranded. An "itinerary" IS an n8n workflow; the nodes on the canvas are travel
steps (hotels, flights, restaurants). n8n's own automation nodes have been
removed and replaced with custom travel nodes.

**Voyagr is a consumer product, not a developer tool.** The people using it do
not know what an API key is and must never be asked for one. Every third-party
key is *ours*, set in deployment environment variables. There is no credentials
UI, no "connect your account" flow, and no technical concept exposed anywhere in
the interface. This framing governs every decision below.

Read `docs/VOYAGR.md` for full project background before starting.

### Build and run

```bash
CI=1 pnpm build:n8n > build.log 2>&1     # production build (~2 min); tail the log
N8N_DIAGNOSTICS_ENABLED=false pnpm start # serves http://localhost:5678
```

Login: `owner@voyagr.local` / `Voyagr1234`

### Gotchas that will bite you

- `CI=1` is required on any install/build — it skips a `lefthook` step that fails.
- Never run a bare `pnpm install`; it has corrupted `package.json` files here.
- After editing `packages/frontend/@n8n/i18n/src/locales/en.json`, run
  `pnpm --filter @n8n/i18n build` — the `BaseTextKey` type comes from that
  package's built `dist`, so typecheck won't see new keys until you rebuild.
- After adding an exported type to `packages/@n8n/api-types`, run
  `pnpm --filter @n8n/api-types build` before typechecking consumers.
- Node 26's native `globalThis.localStorage` shadows jsdom's. editor-ui tests
  that touch it need `NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"`.
- `packages/frontend/editor-ui/src/features/shared/nodeCreator/views/viewsData.ts`
  has ~34 pre-existing typecheck/lint errors. Out of scope. Do not fix them, and
  do not treat them as a regression.
- Verify visually with **system Chrome**, not the bundled chromium:
  `chromium.launch({ headless: true, channel: 'chrome' })` from
  `packages/testing/playwright`.

### Existing travel nodes

`packages/nodes-base/nodes/Voyagr/` contains: `TripStart` (the trigger),
`Hotel`, `Restaurant`, `Cafe`, `TouristDestination`, `Activity`, `Shopping`,
`Flight`, `Train`, `Bus`, `Ferry`, `CarRental`, `FreeTime`.

`TripStart` currently holds `startLocation`, `startDate`, `endDate`, `budget`,
`currency` and emits them as its output JSON. Place nodes hold free-text fields
(e.g. `Hotel` has `hotelName`, `location`, `checkIn`, `nights`, `pricePerNight`,
`starRating`).

Nodes are registered in `packages/nodes-base/package.json` (`n8n.nodes`) and
whitelisted in `packages/@n8n/config/src/configs/nodes.config.ts`
(`NodesConfig.include`). `n8n.credentials` is deliberately `[]` — populating it
makes n8n's credential pseudo-nodes reappear in the node palette. **Leave it
empty.** This is why the API key below is an env var, not a credential.

---

## 2. What this feature does

Today a traveller types every place by hand. This feature suggests **real
places** — with photos, ratings and price tiers — in the left sidebar, and fills
the node in when one is picked.

The interaction: open a place node → the sidebar (the same panel the node
palette uses) fills with scrollable cards showing photo, name, rating, price
tier, neighbourhood and a one-line tip → pick one → the node is populated.

---

## 3. Provider layer

### The interface

Backend-only, in `packages/cli/src/voyagr/places/`. The panel never knows which
provider answered.

```ts
type PlaceKind = 'hotel' | 'restaurant' | 'cafe' | 'attraction' | 'activity' | 'shopping';

type PlaceResult = {
  providerId: string;      // e.g. "fsq:4b0588..."
  name: string;
  address?: string;
  lat: number;
  lon: number;
  rating?: number;         // normalised to 0-5
  ratingCount?: number;
  priceTier?: 1 | 2 | 3 | 4;
  photoUrl?: string;
  blurb?: string;          // a tip snippet or wiki extract
  website?: string;
};

interface PlaceSearchProvider {
  search(opts: { kind: PlaceKind; near: string; query?: string; limit: number }):
    Promise<PlaceResult[]>;
}
```

### Implementations, all free

| Provider | Role | Key? |
|---|---|---|
| **Foursquare Places** | Primary. All six kinds, with ratings, photos, price tier, tips. Normalise its 0–10 rating to 0–5. | Free key, no billing card. `VOYAGR_PLACES_KEY` |
| **Nominatim (OSM)** | Geocode the destination string to lat/lon. | None |
| **Wikipedia REST** | Photo + blurb for landmarks Foursquare is thin on. | None |

Nominatim's usage policy requires a descriptive `User-Agent` and roughly one
request per second. Cache geocodes aggressively (below) and you will stay far
inside it.

**No free API returns real nightly hotel rates.** Foursquare gives a price
*tier* (`$`–`$$$$`), not "$180/night". Cards show the tier; the node's
`pricePerNight` is left for the traveller to fill from wherever they book.
Never invent a number.

---

## 4. Caching is load-bearing

One operator-owned key on a free tier serves every user, so caching is not an
optimisation — it is what keeps the feature viable.

- A DB table keyed on `(provider, kind, normalisedNear, query)` storing the
  result list with a TTL.
- Geocodes cached separately with a much longer TTL — cities do not move.
- When the provider is unreachable or the quota is spent, **serve stale cache**
  rather than showing an error.

**Verify Foursquare's current caching terms before deploying** and set the TTL to
match; do not hardcode a number this spec invented.

---

## 5. The endpoint

```
GET /rest/voyagr/places?kind=hotel&near=Kyoto&q=<optional>
→ PlaceResult[]
```

Behind n8n's existing session auth, rate-limited per user. Searches run
server-side so `VOYAGR_PLACES_KEY` never reaches a browser.

---

## 6. Frontend

New code in `packages/frontend/editor-ui/src/features/voyagr/places/`.

Follow `packages/frontend/AGENTS.md`: reuse `@n8n/design-system` components,
semantic CSS tokens only (never hardcoded px), icon names from `updatedIconSet`
in `packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`,
`data-test-id` a single value. **Invoke the `n8n:design-system` skill before
writing any Vue or SCSS** — the repo mandates it.

The left sidebar gains a places mode, rendering a scrollable list of cards:
photo, name, rating and count, price tier, neighbourhood, one-line blurb, and an
**Add to trip** action.

### Where the search context comes from

`TripStart` gains a **`destination`** field alongside `Starting From`. Every
place node inherits it, so opening a Hotel node in a Kyoto trip immediately
shows Kyoto hotels with no typing. A node can override it.

`destination` uses the same `dateTime`-adjacent conventions as the other string
params — plain string, no `typeOptions`.

### What a pick writes

All six place nodes gain the same four provider fields — `placeId`, `rating`,
`priceTier`, `photoUrl` — alongside the name/location fields they already have.
One uniform mapping, one card component. `pricePerNight` and equivalents stay
empty for the traveller.

This shape is also the **output format of the AI trip generator** (Spec B), so
keep the field names exactly as written here.

### Failure states

No key configured, quota exhausted, provider down, and zero results all render a
quiet empty state — never a raw API error, never a stack trace. Typing a place
by hand always works, with or without the panel.

---

## 7. Testing

Deliberately light, by explicit instruction:

- Unit-test the Foursquare response → `PlaceResult` normaliser (rating scale,
  missing photo, missing rating) and the cache key builder.
- Keep existing suites green.
- One end-to-end visual check at the very end of the build, not per task.

---

## 8. Not in scope

Real nightly rates, availability, or booking. Flight and train search (no free
source). Per-node dates. Multi-city trips. Anything requiring a billing card.

---

## 9. Files this touches

| Path | Change |
|---|---|
| `packages/cli/src/voyagr/places/` | New: provider interface, Foursquare, geocoder, Wikipedia enricher, cache, service |
| `packages/cli/src/voyagr/places/places.controller.ts` | New: the REST endpoint |
| `packages/@n8n/db` | New table + repository for the place cache |
| `packages/@n8n/api-types` | `PlaceResult`, `PlaceKind` shared types |
| `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts` | Add `destination` |
| `packages/nodes-base/nodes/Voyagr/{Hotel,Restaurant,Cafe,TouristDestination,Activity,Shopping}/` | Add the four provider fields |
| `packages/@n8n/config` | `VOYAGR_PLACES_KEY` |
| `packages/frontend/editor-ui/src/features/voyagr/places/` | New: panel, card, composable |
| `packages/frontend/@n8n/i18n/src/locales/en.json` | Panel and empty-state strings |
