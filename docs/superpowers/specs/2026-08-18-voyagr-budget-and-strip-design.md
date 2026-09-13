# Voyagr — trip budget, photo fixes, and the n8n strip

_Design doc. Written 2026-08-18._

Four pieces of work, independent enough to land separately but sharing one
theme: make the editor read as a travel planner rather than an automation tool.

1. **Place photos** — cards render a broken-image glyph; three defects behind it.
2. **Trip budget** — every stop shows what it costs and what share of the trip
   budget that is, with a running total on the canvas.
3. **The n8n strip** — remove the editor tabs, Insights, the Help menu, What's
   New, and most of Settings.
4. **Feedback form** — a sidebar entry where Help used to be, submitting nowhere
   for now.

---

## 1. Place photos

### 1.1 The 401 (root cause)

`server.log` records the actual failure:

```
browserId check failed on /rest/voyagr/places/photo
```

`AuthService.validateBrowserId` rejects any request whose JWT carries a
`browserId` unless the request repeats it in a `browser-id` header. An `<img>`
tag cannot set headers, so every photo request 401s and the browser draws its
broken-image glyph. Nothing about the Google integration is wrong — the photo
proxy never gets to run.

n8n already has a list for precisely this class of route:
`AuthService.skipBrowserIdCheckEndpoints`, holding `/rest/push` (websockets),
`/rest/binary-data/` (`<embed>` tags), the OAuth callbacks, and the Instance AI
SSE endpoint. All share one property: the browser issues the request itself, so
no JS can decorate it.

**Change:** add `` `/${restEndpoint}/voyagr/places/photo` `` to that list, with a
comment in the surrounding style naming the reason (`<img>` tags can't carry
custom headers).

**Why this is safe, precisely:**

- `validateBrowserId` skips only when `method === 'GET' && skip.includes(endpoint)`.
  The photo route is GET-only, so no other verb is affected.
- `getEndpoint()` returns `req.baseUrl + req.route.path` → `/rest/voyagr/places/photo`.
  `includes()` is an exact string match, so the entry cannot widen to sibling
  routes; `/rest/voyagr/places` (the search endpoint) keeps its check.
- Skipping the browser-id check does **not** skip authentication. The session
  cookie is still required and still validated. This drops one binding of the
  session to a single browser, for one read-only GET that returns a redirect to
  a public image URL and takes a regex-validated parameter.

**Test:** in `packages/cli/src/auth/__tests__/auth.service.test.ts`, alongside
the existing skip-list cases — a GET to the photo endpoint with a mismatched
browser id resolves; a POST to it, and a GET to `/rest/voyagr/places`, still
throw.

### 1.2 The broken-image glyph

`PlaceCard.vue` renders `<img v-if="place.photoUrl">` and leaves the element in
place whatever happens to the request. Any miss — a 404 from the proxy, spent
quota, a dead Google link — leaves the glyph plus alt text, which is what the
screenshot shows.

`places.controller.ts` already documents the intent: "a broken card image is the
worst acceptable outcome for a decorative asset." A card with no photo is
cleaner than a card with a broken one.

**Change:** track a local `photoFailed` ref, set it from the `<img>` `@error`
handler, and include it in the render condition. Reset it when `place.photoUrl`
changes so a recycled card retries.

### 1.3 The overlapping panel heading

`.title` in `PlacesPanel.vue` is `position: sticky; top: 0` with no background.
Scrolled content slides underneath it and both paint, which is the doubled
"Suggestions near Bali" / search-placeholder text in the screenshot.

**Change:** make the heading and the search input one sticky header block with
`background-color: var(--background--surface)` and vertical padding, so content
scrolls behind an opaque surface. The panel already uses that token for its own
background, so the block matches.

---

## 2. Trip budget

### 2.1 What the traveller sees

- **On each stop:** a chip under the node name — `₹24,000 · 20%` — the node's own
  cost and its share of the trip budget.
- **On the canvas:** a pill in the header bar — `₹84,200 of ₹120,000 · 70% ·
  ₹35,800 left` — with a progress bar.
- **Over budget:** the pill segment for that branch turns `--color--danger`.
  Chips stay neutral. A chip states one node's own cost, and a node reachable
  from two branches could be in one that fits and one that doesn't — colouring it
  would have to pick a branch, which the chip deliberately doesn't know about
  (§2.4). Overspend is a property of an itinerary, not of a stop.
- **No budget set** (Start Trip `budget` is 0): chips show the amount only, no
  percentage; the pill shows the planned total and says no budget is set.
- **Zero-cost stop** (a Free Time block, or a price nobody filled in): no chip.
  An absent chip reads as "nothing to account for"; a `₹0 · 0%` chip reads as a
  bug.

### 2.2 The cost model

`packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.ts` — one pure
function, `nodeCost(nodeType, parameters, travellers): number`, with a lookup
table per node type. No store access, no Vue, fully unit-testable.

| Node | Formula | Multiplied by travellers |
|---|---|---|
| Hotel | `pricePerNight × nights` | no — a room, not a seat |
| Car Rental | `pricePerDay × days` | no — a vehicle |
| Shopping | `budget` | no — already a lump sum |
| Flight | `price` | yes |
| Train | `price` | yes |
| Bus | `price` | yes |
| Ferry | `price` | yes |
| Restaurant | `avgCost` | yes |
| Cafe | `avgCost` | yes |
| Tourist Destination | `entryFee` | yes |
| Activity | `price` | yes |
| Free Time | `0` | — |
| Start Trip, Sticky Note | `0` | — |

Unknown node types cost 0, so a node added later shows no chip rather than
throwing.

Non-finite, negative, or missing values read as 0 — matching how
`trip-summary.ts` already treats a non-positive budget as unset.

**Labels.** The per-person rows are ambiguous today: Flight's field is just
"Price". Their `displayName`s change to name the unit — "Price per Person" on
Flight, Train, Bus, Ferry and Activity. Parameter **names** are untouched, so
this is a label change with no stored-data migration. Hotel keeps "Price per
Night" and Car Rental "Price per Day", both already unambiguous.

### 2.3 Travellers

No node holds a party size today, so per-person costs would silently mean "one
person" — which quietly breaks the feature for every real trip.

- **Start Trip** gains `travellers` (number, default 1, minimum 1), placed after
  Budget/Currency, and emits it with the rest of the trip context so downstream
  nodes receive it.
- **Plan with AI** gains a matching input, threaded through
  `trip-generation-request.dto.ts` → `TripWorkflowParams` → the Start Trip node
  that `buildTripWorkflow` writes. Without this, every generated trip would
  assume a solo traveller.
- A missing or invalid value reads as 1.

### 2.4 Branch walking

`buildTripWorkflow` fans the trigger out to one branch per generated option, so
summing every node on the canvas would treat three alternative itineraries as
one trip and read as instantly over budget.

`features/voyagr/budget/useTripBudget.ts` computes, from the workflow document's
nodes and connections:

- `travellers` and `budget`/`currency`, read off the Start Trip node.
- `branches` — one per main-output connection from Start Trip, in connection
  order (which `buildTripWorkflow` lays out top-to-bottom via `BRANCH_SPACING`,
  so the order is stable and matches the canvas). Each branch carries its member
  node ids and its total.
- `costByNodeId` — every node's own cost, so a chip never depends on which
  branch it landed in.

Traversal follows `main` connections downstream from each branch root, tracking
visited ids so a cycle or a diamond cannot loop or double-count. A node
reachable from two branches counts in both totals — correct, since each branch
is a complete alternative itinerary.

With no Start Trip node, or one branch, this degenerates cleanly: a single total
over everything downstream.

### 2.5 Components

Two small components in `features/voyagr/budget/components/`, both assembled
from existing n8n UI rather than new visual design:

- **`NodeBudgetChip.vue`** — `N8nBadge` / `N8nText`, rendered from the
  `.description` block of `CanvasNodeDefault.vue` under the existing subtitle.
- **`TripBudgetPill.vue`** — `CanvasPill` from the design system (n8n's own
  floating-canvas pill, currently unused in editor-ui) wrapping the native
  `<progress>` element styled with n8n tokens, the pattern
  `TrialBanner.vue` already uses for "X of Y used". One segment per branch when
  there is more than one, labelled `Option 1`, `Option 2`, … Single-branch trips
  get no label.

Money formatting reuses the existing `formatTripMoney` from
`features/voyagr/tripFormatting.ts`, so the canvas matches the trip cards.

### 2.6 Where it plugs into n8n

Deliberately two touch points, both one-liners, with all logic in
`features/voyagr/`:

- `CanvasNodeDefault.vue` — render `NodeBudgetChip` inside `.description`.
- `MainHeader.vue` — render `TripBudgetPill` in the bar vacated by the tabs
  (§3.1).

The chip reads through `useTripBudget()` against the workflow document store
rather than being threaded through `useWorkflowDocumentRenderData`'s
`*ByNodeId` maps. The maps are the established path for per-node projections,
but they live in a core n8n store, and a Voyagr-specific budget projection there
is a fork edit we would carry forever. A composable keeps the concept in our own
feature folder at the cost of one extra store read per node.

### 2.7 Explicitly out of scope

The My Trips page keeps showing the trip's **planned** budget, not its spend.
`computeTripSummary` runs server-side in `packages/cli/src/workflows/`, so
adding spend means either duplicating the cost model or moving it to a package
both sides import. Worth doing — as a follow-up, deliberately, not smuggled in
here.

The AI generator is not taught to respect the budget it already receives.
Separate concern, separate change.

---

## 3. The n8n strip

### 3.1 Editor tabs

`MainHeader.vue` loses `tabBarItems`, the `<TabBar>` render, `onTabSelected`,
and the three `navigateTo*View` functions, plus the route arrays and
`syncTabsWithRoute` machinery that exist only to highlight a tab. The bar itself
stays and holds the budget pill.

`TabBar.vue` and `MAIN_HEADER_TABS` stay in the tree — other code
(`useHistoryHelper`, `nodeViewUtils.getNodeViewTab`) still references the enum,
and removing it is a wider refactor with no user-visible payoff.

### 3.2 Insights

The sidebar entry is gated on `settingsStore.isModuleActive('insights')`, so
disabling the backend module removes the nav item, the route, and the REST
surface in one move: add `insights` to the default `disabledModules` in
`ModulesConfig` (`packages/@n8n/backend-common/src/modules/modules.config.ts`).
`ModuleRegistry` computes `defaultModules + enabled - disabled`, so this holds
without touching the registry.

Then drop `InsightsModule` from `app/modules.manifest.ts` so the frontend stops
importing the dashboard chunk it can no longer reach.

The `insights` sidebar item, its `handleSelect` telemetry case, and the feature
folder are left alone — a disabled module renders nothing, and leaving the code
intact keeps future upstream merges clean.

### 3.3 Help menu

The whole `help` item in `MainSidebar.vue` goes: quickstart video, docs, forum,
course, report bug, and About n8n — every entry points at an n8n.io resource
that means nothing to a traveller. Its slot is taken by the feedback item (§4).

The About modal itself stays registered; only the link to it is removed.

### 3.4 What's New

`showWhatsNewNotification`, the `notification` binding on the help item, and the
`whats-new-article-*` branch of `handleSelect` are removed with the help item.

### 3.5 Settings

`useSettingsItems` keeps **Personal** (password, theme, personal details) and
**Users** (this is a multi-user-capable instance). Everything else goes: usage &
plan, AI, n8n connect, roles, public API, external secrets, credential
resolvers, source control, SSO, encryption keys, security, LDAP, workers view,
log streaming, OpenTelemetry, community nodes, migration report.

Most are already invisible on an unlicensed local instance; removing them means
they stay invisible if the instance ever gains a license.

### 3.6 Templates — kept on purpose

The Templates entry stays. It is reserved for Voyagr's own use: preset vacation
packages, suggested from a budget alone — the travel-agency-brochure equivalent
of a workflow template. **Do not strip it as leftover n8n.**

Untouched by this change, with one known rough edge: with no custom templates
host configured, the link resolves to
`templatesStore.websiteTemplateRepositoryURL` — n8n.io's automation-template
gallery. Gating that is a one-liner whenever the Voyagr packages work starts.

---

## 4. Feedback form

A sidebar item where Help used to be, opening a modal with a free-text box.

- `VOYAGR_FEEDBACK_MODAL_KEY` in `app/constants/modals.ts`, registered in
  `Modals.vue` under a `ModalRoot` and in `ui.store.ts`'s modal state, following
  the `NPS_SURVEY_MODAL_KEY` wiring exactly.
- `features/voyagr/feedback/components/FeedbackModal.vue` — n8n's `Modal.vue`
  with `N8nInput` (`type="textarea"`) and `N8nButton`, shaped after
  `NpsSurvey.vue`. Borrowed UI only; nothing bespoke.
- Submit calls `features/voyagr/feedback/feedback.api.ts`, whose endpoint
  constant is intentionally empty with a `TODO`. The function resolves without
  making a request; the modal then shows the standard success toast and closes.
  **Nothing leaves the browser and no feedback is stored.** The button is
  honest about the outcome — it thanks the user — but a comment in the API
  module records that the submission is discarded, so nobody later assumes a
  backlog exists.
- All strings via `@n8n/i18n` (`en.json`), per frontend conventions. Renaming or
  adding keys needs `pnpm --filter @n8n/i18n build` before typecheck sees them.

---

## Testing

- **Unit, backend:** the browser-id skip cases (§1.1).
- **Unit, frontend:** `tripCost.ts` per node type — including travellers
  multiplication, the non-multiplied trio, missing and negative values, unknown
  node types. `useTripBudget()` — single branch, three branches, no Start Trip,
  a shared downstream node, a cycle.
- **Component:** `PlaceCard.vue` hides the photo after an `@error`.
- **Manual, against `localhost:5678`:** photos render in the suggestions panel;
  the panel heading no longer overlaps; chips and the pill update live as prices
  are typed; the pill goes red past budget; a generated three-option canvas
  shows three separate totals; Insights, the tabs, Help, What's New and the
  trimmed Settings entries are gone; Templates is still there; the feedback
  modal opens, accepts text, and closes.

Editor-ui tests that touch `localStorage` need
`NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"` on Node 26.

## Risks

- **Auth change.** §1.1 loosens one binding on one GET route. Scoped by exact
  path match and the GET guard; session auth unchanged.
- **Core-file edits.** `auth.service.ts`, `MainHeader.vue`,
  `CanvasNodeDefault.vue`, `MainSidebar.vue`, `useSettingsItems.ts` and
  `modules.config.ts` are upstream n8n files, so each edit is merge surface.
  Kept minimal and additive where possible for that reason.
- **Node label changes** (§2.2) alter what existing saved trips display, though
  not what they store.
