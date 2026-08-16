# Voyagr — Project Status & Handoff

_Last updated: 2026-07-22. Read this first when picking the project back up._

Voyagr is a **travel itinerary planner built as a fork of n8n**. It is the real,
unmodified n8n **editor**, rebranded to Voyagr, with n8n's automation nodes
removed and replaced by **custom travel nodes**. An itinerary is built the same
way you'd build an n8n workflow: drag travel "nodes" (hotels, flights,
attractions…) onto the canvas and connect them.

The repo at `~/Documents/Code/Voyagr` **is** the n8n fork (the whole n8n
monorepo, vendored). Our design/spec docs live under `docs/`.

---

## 1. How to build & run

```bash
# from repo root
CI=1 pnpm build:n8n                          # production build (~2 min)
N8N_DIAGNOSTICS_ENABLED=false pnpm start     # start server
# open http://localhost:5678
```

- **Login (owner account, in local sqlite ~/.n8n):** `owner@voyagr.local` / `Voyagr1234`
- **Toolchain:** Node ≥22 (works on 26), **pnpm 10** (`npm i -g pnpm@10.32.1`), Docker not required.
- **`CI=1` is required** on any `pnpm install`/`pnpm build:n8n` — it skips the `lefthook`
  git-hook prepare step that otherwise fails.
- **Do NOT use `pnpm dev` on a fresh tree** — turbo `--parallel` skips dependency
  build order, so packages can't find each other's `dist/` ("Cannot find module 'n8n-core'").
  Always `build:n8n` first; use `pnpm dev` only for watch after an initial build.
- **Verify visually (headless):** the bundled Playwright chromium is mismatched — use
  system Chrome: `chromium.launch({ headless: true, channel: 'chrome' })` from
  `packages/testing/playwright`, against `http://localhost:5678`.

---

## 2. What's done

**Running:** vanilla n8n editor from source on Node 26. (n8n's `isolated-vm` native
module doesn't compile on Node 26, but it's only lazily loaded by the AI-agents
feature, so the server boots fine; we also removed it from `pnpm.onlyBuiltDependencies`.)

**Rebrand → Voyagr:**
- Browser title "Voyagr - Travel Planner"; app suffix "Voyagr".
- Logo swapped (Voyagr wordmark + travel-pin mark).
- Run button "Execute workflow" → **"Plan trip"**.
- Trigger "Manual Trigger / When clicking Execute workflow" → **"Start Trip"** (custom node).

**Travel nodes (13) in 7 palette categories:**
| Category | Nodes |
|---|---|
| Hotels | Hotel |
| Tourist Destinations | Tourist Destination |
| Food & Dining | Restaurant, Cafe |
| Travel Modes | Flight, Train, Car Rental, Bus, Ferry |
| Experiences | Activity |
| Shopping | Shopping |
| Rest & Free Time | Free Time |
Plus **Start Trip** (trigger) and **Sticky Note** (annotations).

**Travel-only palette (n8n content removed):**
- Node whitelist so only the travel nodes + Start Trip + Sticky Note load (14 node types).
- Emptied nodes-base **credentials** (they were generating "HTTP-with-<credential>"
  discovery pseudo-nodes like Gmail in search).
- Removed the **AI** discovery tile and the **"Add another trigger"** tile from the node creator.
- Verified: search "Gmail"/"Anthropic" → 0 results; only the 7 travel categories show.

**Trips page & Start Trip inputs:**
- Overview page is now "My Trips": trip wording, no tab row, trip stats strip
  (trips / stops / budget / next departure) instead of the executions insights.
- Trip cards show itinerary details — dates, length in nights, stop count,
  origin, budget. Same-day trips show a single date; undated trips show an
  "Add dates" nudge.
- Start Trip holds Starting From, Trip Starts, Trip Ends, Budget and Currency,
  and emits them so downstream travel nodes receive trip context.
- The summary is derived server-side from each trip's nodes
  (`packages/cli/src/workflows/trip-summary.ts`) and attached in
  `WorkflowService.getMany()` via `workflowRepository.findNodesByIds()`; the
  list query itself still omits `nodes`.

**Place connectors:**
- Travel nodes suggest real places in a left panel — photo, rating, price tier,
  neighbourhood — and fill themselves in when one is picked.
- Foursquare behind a `PlaceSearchProvider` interface
  (`packages/cli/src/voyagr/places/`), with keyless Nominatim for geocoding and
  Wikipedia for landmark photos. Results are cached in-memory with a TTL,
  because one operator key on a free tier serves every user.
- Key is `VOYAGR_PLACES_KEY` in deployment env. Users never see it — Voyagr is
  a consumer product, not a developer tool.
- Start Trip gained `destination`; the six place nodes gained hidden
  `placeId` / `rating` / `priceTier` / `photoUrl` fields.

**AI trip generator:**
- "Plan with AI" on My Trips opens a short form — where to, travelling from,
  dates, budget, and two sliders (how busy, mountains-to-beaches). Submitting
  draws three complete itineraries as parallel branches on one canvas.
- The connector layer picks a pool of *real* places first; the model then only
  selects and sequences them **by provider id** and never writes a place name,
  so a hallucinated hotel is structurally impossible. A pure materialiser
  (`packages/cli/src/voyagr/generator/build-trip-workflow.ts`) turns the result
  into workflow JSON.
- `openai/gpt-oss-120b` on Groq's free tier via the `openai` SDK against
  `https://api.groq.com/openai/v1`, using strict JSON-schema structured output.
  Key is `VOYAGR_GROQ_KEY` in deployment env, never shown to users.
- Strict mode is load-bearing, not a nicety: it is what forces a provider id
  instead of free text. Only Groq's `gpt-oss` family supports it — every other
  free model there is loose JSON mode at best.

---

## 3. Where things live (key files)

- **Travel nodes:** `packages/nodes-base/nodes/Voyagr/<Name>/` — each has
  `<Name>.node.ts` (the node), `<Name>.node.json` (codex: category/subcategory),
  and `<icon>.svg`.
- **Node registration + credentials:** `packages/nodes-base/package.json`
  (`n8n.nodes` array lists `dist/nodes/Voyagr/.../*.node.js`; `n8n.credentials` is `[]`).
- **Node whitelist (which nodes load):** `packages/@n8n/config/src/configs/nodes.config.ts`
  → `NodesConfig.include` default (overridable with the `NODES_INCLUDE` env var, JSON array).
- **Palette categories/tiles + trigger tile + AI-tile removal:**
  `packages/frontend/editor-ui/src/features/shared/nodeCreator/views/viewsData.ts`
  (`RegularView` = the travel category tiles; `TriggerView` = Start Trip only).
- **Category labels + "Plan trip" text:** `packages/frontend/@n8n/i18n/src/locales/en.json`
  (keys `nodeCreator.subcategoryNames.*`, `nodeCreator.subcategoryDescriptions.*`,
  `nodeView.runButtonText.executeWorkflow`).
- **Browser title:** `packages/frontend/editor-ui/index.html` +
  `packages/frontend/@n8n/composables/src/useDocumentTitle.ts` (`DEFAULT_TITLE`/`DEFAULT_TAGLINE`).
- **Logo:** `packages/frontend/@n8n/design-system/src/components/N8nLogo/logo-text.svg`
  (wordmark) + `logo-icon.svg` (mark, also reused as favicon).

---

## 4. How to add a new travel node

1. `mkdir packages/nodes-base/nodes/Voyagr/<Name>/` and create:
   - `<Name>.node.ts` — an `INodeType` class with `description` (displayName, name,
     `icon: 'file:<icon>.svg'`, `group: ['transform']`, `inputs`/`outputs`: `[NodeConnectionTypes.Main]`,
     `properties: [...]`) and an `execute()` that returns the params as JSON. Copy an
     existing one (e.g. `Hotel/Hotel.node.ts`).
   - `<Name>.node.json` — codex: `"categories": ["Core Nodes"]`,
     `"subcategories": { "Core Nodes": ["<Category>"] }`. `<Category>` must match a
     palette tile key.
   - `<icon>.svg` — a small (24×24) SVG.
2. Register the compiled path in `packages/nodes-base/package.json` `n8n.nodes`:
   `"dist/nodes/Voyagr/<Name>/<Name>.node.js"`.
3. Add the node type to the whitelist in `nodes.config.ts` `include` (`n8n-nodes-base.<name>`).
4. If it's a **new category**: add a tile in `viewsData.ts` `RegularView.items`
   (`type: 'subcategory'`, `key: '<Category>'`, `category: CORE_NODES_CATEGORY`,
   `properties: { title: '<Category>', icon: '<lucide-name>' }`) AND i18n entries
   `nodeCreator.subcategoryNames.<camelKey>` + `...subcategoryDescriptions.<camelKey>`
   in `en.json` (camelKey = lodash camelCase of the category, e.g. "Food & Dining"→`foodDining`).
   Palette tile icons must be names from `updatedIconSet` in
   `packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`.
5. `CI=1 pnpm build:n8n` then `pnpm start`. (The build regenerates `dist/known/nodes.json`
   + `dist/types/nodes.json`; a bare `.js` in dist is not enough.)

---

## 5. Gotchas (things that bit us)

- **Lockfile / frozen install:** `build:n8n` runs `pnpm install --frozen-lockfile`. A
  stray `pnpm install --no-frozen-lockfile` once corrupted several `package.json`
  files (stripped deps, truncated root `patchedDependencies`) and broke builds. Fix
  was `git restore <package.json>` (HEAD is intact, lockfile unchanged). Avoid bare
  `pnpm install`; if you must, `git restore` package.json/lockfile after.
- **Palette grouping** only honors subcategories under whitelisted categories
  (`Core Nodes`, `AI`, `HITL`) — put travel nodes under `Core Nodes`.
- **`NODES_INCLUDE` filters nodes, not credentials** — empty `n8n.credentials` to stop
  credential "HTTP-with-X" pseudo-nodes appearing in search.
- **Release channel `dev`** adds a `[DEV]` browser-title suffix and greys the logo icon
  (see `Logo.vue` onMounted) — cosmetic.
- **`dateTime` node params are local-time strings.** `ParameterInput.vue` stores them as `YYYY-MM-DDTHH:mm:ss` with no offset, which `new Date()` parses as local time. Setting `typeOptions.dateOnly` switches the format to `YYYY-MM-DD`, which parses as **UTC** midnight and shifts the calendar day in negative-offset timezones. Start Trip deliberately does not set it.
- **Renaming an i18n key needs a rebuild.** `BaseTextKey` is derived from `@n8n/i18n`'s built `dist`, so run `pnpm --filter @n8n/i18n build` after editing `en.json` or typecheck won't see the change.
- **Node 26 shadows jsdom's `localStorage`.** `globalThis.localStorage` is native and undefined without a flag, so editor-ui tests that touch it need `NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"`.
- **Place suggestions degrade silently.** No key, spent quota, or an unreachable
  provider all return `[]` from `/rest/voyagr/places` and render one quiet empty
  state. Never surface a provider error to a traveller.
- **`@Query` needs a zod DTO class, not a TS type.** `controller.registry.ts` only injects a `query`/`body` argument when its `design:paramtypes` metadata has a `safeParse`. A bare inline object type has no runtime representation, so the argument arrives `undefined` and destructuring it throws on the first request. Declare a `Z.class` DTO (see `places-query.dto.ts`).
- **Undefined CSS variables fail silently.** The spacing scale is `--spacing--sm`, not `--spacing--s`; a typo'd token collapses the property to nothing with no build or lint error. Check names against `@n8n/design-system/src/css/_primitives.scss`.
- **Groq free tier is 8,000 tokens/min, input and output combined.** That is the real constraint on trip generation, not context size. The prompt sends a trimmed place list (id, name, kind, rating, price tier — no blurbs or URLs) and caps completion tokens; worst case measures ~6.4k.
- **Groq strict mode accepts only a subset of JSON Schema.** Every object needs `additionalProperties: false` and every property in `required`; `minItems`/`maxItems` are rejected, so array cardinality is enforced in code after parsing, not in the schema.
- **Playwright's `getByTestId` defaults to `data-testid`, but n8n uses `data-test-id`.** Call `selectors.setTestIdAttribute('data-test-id')` in throwaway scripts, or match `[data-test-id="..."]` directly. Also: element-plus components (`ElDatePicker`) swallow the attribute rather than forwarding it.

---

## 6. Git history (this project)

```
8c323dad Start Trip trigger, Plan trip rebrand, more travel nodes, fully travel-only
f4f8c987 travel-only palette (remove all n8n nodes)
ab7f8a7e Voyagr rebrand + travel node palette
1731c620 remove custom frontend; use n8n editor as-is
a7f7bafb (earlier custom-Vue approach — superseded)
75252a8f (earlier custom-Vue approach — superseded)
082d361d (earlier custom-Vue approach — superseded)
54927791 (earlier custom-Vue approach — superseded)
892f6b39 Vendor n8n editor-ui fork
d2f53f6e pivot to non-commercial n8n fork
6af398df / 21952fd7 original React design spec + plan (historical)
```

### Approach history (why the repo looks the way it does)
1. Original idea: an AI-native, node-based travel planner in **React + React Flow**
   (see `docs/superpowers/specs/2026-07-20-voyagr-design.md` and the Phase 1 plan —
   both **historical/superseded**).
2. Pivoted to reuse n8n's frontend → went **non-commercial** (n8n's Sustainable Use
   License forbids commercial reuse).
3. Built a custom Vue app reusing n8n's canvas + NodeSettings modal + a budget bar
   — **removed** (commit 1731c620) because the goal became "use n8n as-is".
4. **Current approach:** run the real n8n editor unchanged; do everything in the
   backend/config — custom travel nodes, whitelist, rebrand.

---

## 7. Licensing

n8n is under the **Sustainable Use License** (`LICENSE.md`). Voyagr must stay
**non-commercial** (free), keep n8n's license/copyright notices, and not use `.ee.`
(Enterprise) files.

---

## 8. Next steps / open items

- **AI itinerary generation** (planned next) — generate a trip (a graph of travel
  nodes) from inputs like destination/budget/dates.
- **Deeper terminology rebrand** — "workflow"/"execution" wording still appears in
  breadcrumbs, menus, and the editor itself; swap to trip/itinerary language.
- **Node execution semantics / budget** — nodes currently just pass their data
  through on execute; a "Plan trip" run could compute totals (budget), build a
  day-by-day summary, etc.
- **Trim the vendored n8n** to a lighter, frontend-focused repo (optional; the repo
  currently carries the full n8n monorepo).
- Real per-node travel icons (SVGs are simple line icons today).
