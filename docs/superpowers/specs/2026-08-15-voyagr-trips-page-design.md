# Voyagr — Trips page & Start Trip inputs

_Design spec. Date: 2026-08-15._

Turn the Overview page (`/home/workflows`) into a trips list, and give the Start
Trip node the inputs a trip actually needs: where you leave from, when, and for
how much.

Prerequisite reading: `docs/VOYAGR.md`.

---

## 1. Goals

- The Overview page reads as an itinerary list, not an automation dashboard.
- Each trip card shows real itinerary info derived from the trip's own nodes.
- The Start Trip node holds the trip's origin, dates and budget.

**Non-goals (explicitly out of scope):**

- Sorting trips by departure date. List sorting is server-side and cannot order
  a derived field without further plumbing.
- Destination imagery, upcoming/past grouping, timeline previews on cards.
- Per-node dates (each hotel/flight having its own date). Only the trip-level
  dates on Start Trip exist for now.

---

## 2. Start Trip node

File: `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts`

Keep the existing `notice` property, add five fields:

| Field | `name` | Type | Default |
|---|---|---|---|
| Starting From | `startLocation` | string | `Home` |
| Trip Starts | `startDate` | dateTime | `''` |
| Trip Ends | `endDate` | dateTime | `''` |
| Budget | `budget` | number | `0` |
| Currency | `currency` | options | `USD` |

Currency options: USD, EUR, GBP, INR, JPY, AUD, CAD, AED.

`trigger()` currently emits `[{}]`. It instead emits the trip context:

```ts
{ startLocation, startDate, endDate, budget, currency }
```

so downstream travel nodes receive it. This is the groundwork for the
AI-generation and budget-total items listed in `docs/VOYAGR.md` §8.

Parameters are read via `this.getNodeParameter(name, fallback)` — note the
`ITriggerFunctions` signature takes a fallback, not an item index.

---

## 3. Trip summary (backend)

### The shape

Defined in `@n8n/api-types` (shared FE/BE, per AGENTS.md):

```ts
export type TripSummary = {
  startLocation?: string;
  startDate?: string;   // ISO
  endDate?: string;     // ISO
  budget?: number;
  currency?: string;
  stopCount: number;
};
```

`stopCount` counts the trip's nodes excluding `n8n-nodes-base.tripStart` and
`n8n-nodes-base.stickyNote`.

### Where it is computed

A pure function, no I/O, easy to test:

```ts
computeTripSummary(nodes: INode[]): TripSummary
```

If there is no Start Trip node, or its fields are blank, the corresponding
summary fields are `undefined` — `stopCount` is still returned.

### How it reaches the list response

The workflows list deliberately omits the `nodes` column, and the
folders/workflows union query builds its column list from the select keys — so
widening that select is the risky path. Instead, attach summaries after the
fact in `WorkflowService.getMany()`:

```
getMany()
  → workflows (existing query, no nodes)
  → workflowRepository.findNodesByIds([...ids])   ← new repository method
  → computeTripSummary(nodes) per workflow
  → workflows[i].tripSummary
```

One extra primary-key-indexed query per page load. The TypeORM boundary rule
holds: `findNodesByIds` is a use-case-named repository method returning
`Array<{ id: string; nodes: INode[] }>`; the summary logic itself is business
logic and lives outside the repository.

Frontend types: `WorkflowListItem` and `WorkflowResource` in
`packages/frontend/editor-ui/src/Interface.ts` gain `tripSummary?: TripSummary`.

---

## 4. The page

All frontend work follows `packages/frontend/AGENTS.md`: reuse existing
`@n8n/design-system` components, semantic tokens only (no hardcoded px), icon
names from `updatedIconSet`. Run the `n8n:design-system` skill before writing
Vue/SCSS.

### 4.1 Wording (i18n only)

`packages/frontend/@n8n/i18n/src/locales/en.json`:

| Key | New value |
|---|---|
| `projects.menu.overview` | `My Trips` |
| `projects.header.overview.subtitle` | `All the trips you're planning` |
| `projects.header.create.workflow` | `Plan a trip` |

`projects.menu.overview` also labels the sidebar item — relabelling both is
intended and consistent.

### 4.2 Tab row

`ProjectHeader.vue` renders `ProjectTabs` (Workflows / Credentials / Executions
/ module tabs). Voyagr is travel-only, so the row is suppressed and only the
trips list remains.

### 4.3 Stat strip

`WorkflowsView.vue` passes `InsightsSummary` into the `ProjectHeader` default
slot. Replace it with a new `TripStats.vue`.

New component is justified: the design system has no stat/summary component
(checked — only Callout/Card/EmptyState/InfoTip/etc.), and `InsightsSummary.vue`
is coupled to insights types, routes and telemetry. `TripStats.vue` therefore
mirrors InsightsSummary's markup and CSS structure — same visual language, same
slot — built from `N8nText` and `N8nIcon`.

Four stats, aggregated client-side from the loaded page of trips:

| Stat | Value |
|---|---|
| Trips | count |
| Stops | sum of `stopCount` |
| Budget | sum of `budget` |
| Next | time until the soonest future `startDate`; `—` when no trip has a future start date |

Money is formatted with `Intl.NumberFormat` using the trip's currency.

**Known limitation:** stats reflect the loaded page (default page size 50), not
the entire instance. Acceptable for a personal planner; noted rather than
solved.

**Mixed currencies:** budgets are summed per currency and joined
(`$12,400 · €900`) rather than summed across currencies.

### 4.4 Trip cards

`packages/frontend/editor-ui/src/app/components/WorkflowCard.vue` already
renders a meta line (`N8nText` + `TimeAgo`, around line 627). Edit it in place —
no new component. It becomes:

```
Tokyo & Kyoto
12–19 Sep · 7 days · 9 stops · from Home · $3,000
```

Icons from `updatedIconSet`: `calendar` (dates), `pin` (origin),
`circle-dollar-sign` (budget).

Segments are omitted when their data is absent. A trip with no dates shows the
nudge instead:

```
Add dates · 3 stops
```

Dates are formatted client-side; the year is shown only when the trip does not
fall in the current year (matching the card's existing `createdAt` handling).

---

## 5. Testing

Light, per instruction:

- One Vitest file for `computeTripSummary`: no Start Trip node; Start Trip with
  all fields; blank date fields; sticky notes and the trigger excluded from
  `stopCount`.
- Existing suites (`WorkflowCard.test.ts`, `WorkflowsView.test.ts`, cli workflow
  service tests) must stay green.
- `pnpm typecheck` and `pnpm lint` in each touched package.
- Visual check against `http://localhost:5678` with headless **system** Chrome
  (`chromium.launch({ headless: true, channel: 'chrome' })`) — the bundled
  chromium is mismatched, per `docs/VOYAGR.md` §1.

---

## 6. Cleanup

The 8 existing "My workflow N" entries are mock data and get deleted once the
new page renders.

---

## 7. Files touched

| File | Change |
|---|---|
| `nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts` | 5 properties, emit trip context |
| `@n8n/api-types` | `TripSummary` type |
| `cli/src/workflows/…` | `computeTripSummary` + wire into `getMany` |
| `@n8n/db` workflow repository | `findNodesByIds` |
| `editor-ui/src/Interface.ts` | `tripSummary?` on list types |
| `editor-ui/.../ProjectHeader.vue` | suppress tab row |
| `editor-ui/.../WorkflowsView.vue` | swap InsightsSummary → TripStats |
| `editor-ui/.../TripStats.vue` | new |
| `editor-ui/.../WorkflowCard.vue` | trip meta line |
| `@n8n/i18n/.../en.json` | 3 strings + trip card/stat strings |

Build and run per `docs/VOYAGR.md` §1 (`CI=1 pnpm build:n8n`, then
`N8N_DIAGNOSTICS_ENABLED=false pnpm start`).
