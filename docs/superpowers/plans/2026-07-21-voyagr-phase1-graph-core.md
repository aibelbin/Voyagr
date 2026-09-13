# Voyagr Phase 1 — Graph Core (No AI) Implementation Plan

> ⚠️ **SUPERSEDED (2026-07-22).** This plan targets a React + React Flow build. The project pivoted to **forking n8n's editor-ui (Vue 3 + Vue Flow) as the frontend** and going **non-commercial** (see the design spec's decision table). The pure-domain design here — the itinerary model, budget engine, invertible command set, transit/edge rules, undo/redo semantics — remains valid and portable to the Vue fork; the React-specific tasks (9–15) do not apply. Kept for reference and for its domain logic.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, persistent, n8n-style itinerary canvas — the graph document model, invertible command set, budget engine, React Flow canvas, node drawer, undo/redo, auth, and persistence — with a hardcoded multi-city sample itinerary and zero AI.

**Architecture:** A single Next.js (App Router) full-stack app. The editable trip lives client-side in a Zustand store as a `TripState` (trip metadata + itinerary document). Every semantic edit is a typed, invertible `Command` applied by a pure reducer; the store keeps undo/redo stacks. The budget engine and canvas layout are pure functions of state. Postgres (via Drizzle) persists trips and their itinerary documents as versioned JSONB; Better Auth handles sign-in. This phase deliberately renders a seeded sample itinerary so the hardest UX (canvas + editing + undo) is de-risked before any token is spent.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · @xyflow/react 12 (React Flow) · Zustand 5 · Zod 3 · Drizzle ORM + postgres.js · Better Auth · Tailwind CSS 4 · Biome (lint+format) · Vitest + @testing-library/react (unit/component) · Playwright (E2E) · Docker Compose (local Postgres).

## Global Constraints

- **Node.js** ≥ 22 (dev machine is on 26). **Package manager: npm** (no monorepo — single app).
- **TypeScript strict mode on**; no `any` in committed code (use `unknown` + narrowing).
- **All persisted/AI-facing data validated with Zod.** The Zod schemas in Task 2 are the single source of truth; TS types are inferred from them (`z.infer`), never hand-duplicated.
- **Costs are always ranges** (`low`/`high`) with a `confidence` label (`'grounded' | 'estimated' | 'rough'`). Never render a single-point cost as authoritative. Budget UI carries an "estimates, not quotes" disclaimer.
- **Undo/redo covers semantic edits only** (the Command set). Canvas pixel positions and camera/zoom are view state — persisted opportunistically, never pushed onto the command stack.
- **Every command is invertible.** `applyCommand` returns `{ state, inverse }`; the inverse is itself a valid `Command`.
- **Edges within a day are derived, not hand-authored.** After any structural change, intra-day edges are rebuilt deterministically by `rebuildDayEdges`. Edges are never directly user-editable in Phase 1.
- **Currency:** every `Money`/`CostRange` carries an explicit ISO-4217 `currency` string. No implicit currency. No cross-currency conversion in Phase 1 (single trip currency assumed; mixing is a later phase).
- **Trip length cap: 21 days.** Past start dates are rejected at input validation.
- **File responsibility:** keep pure domain logic (`src/domain/**`) free of React, Next, and DB imports so it stays unit-testable in isolation.
- **Commit after every task** (each task ends with a green test run + commit).

---

## File Structure

```
voyagr/
├── docker-compose.yml                  # local Postgres
├── biome.json                          # lint + format
├── vitest.config.ts
├── playwright.config.ts
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
├── .env.example                        # documented env vars
├── src/
│   ├── domain/                         # PURE — no React/Next/DB imports
│   │   ├── types.ts                    # Zod schemas + inferred TS types (Task 2)
│   │   ├── sample-itinerary.ts         # hardcoded Rome→Florence seed (Task 3)
│   │   ├── budget.ts                   # computeBudget (Task 4)
│   │   ├── transit.ts                  # estimateTransit + rebuildDayEdges (Task 5)
│   │   ├── commands.ts                 # Command union + applyCommand (Tasks 6–7)
│   │   └── layout.ts                   # computeLayout (Task 9)
│   ├── store/
│   │   └── trip-store.ts               # Zustand store + undo/redo (Task 8)
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── TripCanvas.tsx           # React Flow wrapper (Task 9)
│   │   │   ├── ItineraryNodeCard.tsx    # custom node (Task 9)
│   │   │   ├── DayGroupNode.tsx         # day container node (Task 9)
│   │   │   └── TransitEdge.tsx          # custom edge w/ label (Task 9)
│   │   ├── drawer/
│   │   │   └── NodeDrawer.tsx           # right-side detail drawer (Task 11)
│   │   ├── BudgetBar.tsx                # header budget widget (Task 12)
│   │   └── EditorToolbar.tsx            # undo/redo + tidy buttons (Task 13)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # landing/redirect
│   │   ├── login/page.tsx               # Task 15
│   │   ├── trips/page.tsx               # trip list (Task 16)
│   │   ├── trips/[id]/page.tsx          # editor shell (Tasks 9–13, 16)
│   │   └── api/
│   │       ├── auth/[...all]/route.ts   # Better Auth handler (Task 15)
│   │       └── trips/[id]/route.ts      # load/save document (Task 16)
│   ├── db/
│   │   ├── schema.ts                    # Drizzle tables (Task 14)
│   │   └── client.ts                    # db connection (Task 14)
│   └── lib/
│       └── auth.ts                      # Better Auth server config (Task 15)
└── tests/
    ├── domain/                          # unit tests mirror src/domain
    └── e2e/                             # Playwright specs
```

---

## Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `vitest.config.ts`, `playwright.config.ts`, `docker-compose.yml`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/domain/smoke.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable app skeleton; npm scripts `dev`, `build`, `lint`, `test`, `test:e2e`, `db:push`, `db:studio`; Tailwind + Biome configured. Everything downstream assumes these scripts exist.

- [ ] **Step 1: Create the Next.js app non-interactively**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
npx create-next-app@latest voyagr-app --ts --app --tailwind --eslint=false --src-dir --import-alias "@/*" --no-turbopack --use-npm
# create-next-app runs `git init` inside voyagr-app; drop it so it can't clash with the repo's .git
rm -rf voyagr-app/.git
# Move the generated app into the repo root (repo already has docs/ and .git)
shopt -s dotglob && mv voyagr-app/* . && rmdir voyagr-app && shopt -u dotglob
```

If any file collides with existing repo files (e.g. `README.md`), keep the repo's version.

- [ ] **Step 2: Add remaining dependencies**

```bash
npm install @xyflow/react@^12 zustand@^5 zod@^3.23 drizzle-orm@^0.36 postgres@^3.4 better-auth@^1
npm install -D @biomejs/biome@^1.9 vitest@^2 @vitejs/plugin-react@^4 @testing-library/react@^16 @testing-library/jest-dom@^6 jsdom@^25 @playwright/test@^1.48 drizzle-kit@^0.28
npx playwright install chromium
```

- [ ] **Step 3: Write `biome.json`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json` (strict), `docker-compose.yml`, `.env.example`**

`biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "files": { "ignore": ["src/db/migrations/**", ".next/**", "node_modules/**"] }
}
```

`vitest.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

`tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`tsconfig.json` — ensure `"strict": true` and `"noUncheckedIndexedAccess": true` are set (add the latter to the create-next-app default).

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: voyagr
      POSTGRES_PASSWORD: voyagr
      POSTGRES_DB: voyagr
    volumes: ["voyagr_pgdata:/var/lib/postgresql/data"]
volumes:
  voyagr_pgdata:
```

`.env.example`:
```
DATABASE_URL=postgres://voyagr:voyagr@localhost:5432/voyagr
BETTER_AUTH_SECRET=dev-secret-change-me
BETTER_AUTH_URL=http://localhost:3000
# Optional — Google OAuth is only enabled when both are set:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Then create a real local env file so Next.js, drizzle-kit, and the integration tests pick up these values:
```bash
cp .env.example .env
```
Add `.env` to `.gitignore` (create-next-app's `.gitignore` already ignores `.env*`; confirm it does).

- [ ] **Step 4: Add npm scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check src tests",
    "lint:fix": "biome check --write src tests",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 5: Write the smoke tests**

`tests/domain/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

`tests/e2e/smoke.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
```

- [ ] **Step 6: Replace `src/app/page.tsx` with a minimal placeholder**

```tsx
export default function Home() {
  return <main className="p-8 text-2xl font-semibold">Voyagr</main>;
}
```

- [ ] **Step 7: Run everything green**

```bash
npm run lint        # expect: no errors
npm test            # expect: smoke.test.ts PASS
npx tsc --noEmit    # expect: no type errors
docker compose up -d db && npm run test:e2e   # expect: smoke.spec.ts PASS
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with tooling (biome, vitest, playwright, docker db)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Domain types & Zod schemas

**Files:**
- Create: `src/domain/types.ts`
- Test: `tests/domain/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the single source of truth for the data model. Zod schemas and inferred types used by every later task:
  - Types: `Money`, `CostRange`, `Confidence`, `NodeType`, `NodePlace`, `NodeSchedule`, `NodeAI`, `NodeLinks`, `AlternativeOption`, `ItineraryNode`, `CitySegment`, `DayGroup`, `TransitMode`, `TransitEdge`, `LayoutOverrides`, `ItineraryDocument`, `InterestKey`, `StyleProfile`, `TripInputs`, `VisaItem`, `TripMeta`, `TripState`.
  - Schemas (same names + `Schema` suffix): `TripStateSchema`, `ItineraryDocumentSchema`, `TripMetaSchema`, etc.
  - Const: `NODE_TYPES: readonly NodeType[]`, `INTEREST_KEYS: readonly InterestKey[]`.

- [ ] **Step 1: Write the failing test**

`tests/domain/types.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ItineraryNodeSchema, TripStateSchema, NODE_TYPES } from "@/domain/types";

const minimalNode = {
  id: "n1",
  type: "attraction",
  name: "Colosseum",
  tags: [],
  locked: false,
};

describe("ItineraryNodeSchema", () => {
  it("accepts a minimal node and defaults tags/locked", () => {
    const parsed = ItineraryNodeSchema.parse(minimalNode);
    expect(parsed.name).toBe("Colosseum");
    expect(parsed.locked).toBe(false);
  });

  it("rejects an unknown node type", () => {
    expect(() => ItineraryNodeSchema.parse({ ...minimalNode, type: "spaceship" })).toThrow();
  });

  it("rejects a cost range where high < low", () => {
    const bad = {
      ...minimalNode,
      cost: { low: 100, high: 10, currency: "EUR", perPerson: true, confidence: "estimated" },
    };
    expect(() => ItineraryNodeSchema.parse(bad)).toThrow();
  });

  it("exposes all nine node types", () => {
    expect(NODE_TYPES).toHaveLength(9);
  });
});

describe("TripStateSchema", () => {
  it("round-trips a minimal trip state", () => {
    const state = {
      trip: {
        id: "t1",
        title: "Italy",
        inputs: {
          destinations: ["Rome"],
          dates: { mode: "flexible", month: "2026-09", durationDays: 5 },
          travelers: { adults: 2, kids: 0, elderly: 0 },
          budget: { amount: 3000, currency: "EUR" },
          constraints: [],
        },
        styleProfile: {
          budgetLuxury: 0.5,
          pace: 0.5,
          interests: { food: 0.5, culture: 0.5, nature: 0.5, nightlife: 0, shopping: 0, adventure: 0, photography: 0 },
          flags: { familyFriendly: false, minimalWalking: false, ecoFriendly: false, hiddenGems: false },
        },
      },
      document: { id: "d1", version: 1, cities: [], days: [], nodes: [], edges: [] },
    };
    expect(() => TripStateSchema.parse(state)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- types`
Expected: FAIL — `Cannot find module '@/domain/types'`.

- [ ] **Step 3: Implement `src/domain/types.ts`**

```ts
import { z } from "zod";

export const NODE_TYPES = [
  "flight",
  "intercity_transport",
  "stay",
  "attraction",
  "food",
  "shopping",
  "experience",
  "free_time",
  "note",
] as const;
export const NodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const INTEREST_KEYS = [
  "food",
  "culture",
  "nature",
  "nightlife",
  "shopping",
  "adventure",
  "photography",
] as const;
export const InterestKeySchema = z.enum(INTEREST_KEYS);
export type InterestKey = z.infer<typeof InterestKeySchema>;

export const ConfidenceSchema = z.enum(["grounded", "estimated", "rough"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof MoneySchema>;

export const CostRangeSchema = z
  .object({
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    currency: z.string().length(3),
    perPerson: z.boolean(),
    confidence: ConfidenceSchema,
  })
  .refine((c) => c.high >= c.low, { message: "cost.high must be >= cost.low" });
export type CostRange = z.infer<typeof CostRangeSchema>;

export const NodePlaceSchema = z.object({
  placeId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
});
export type NodePlace = z.infer<typeof NodePlaceSchema>;

export const NodeScheduleSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  durationMin: z.number().nonnegative().optional(),
  openingHours: z.string().optional(),
  weatherSensitive: z.boolean().default(false),
});
export type NodeSchedule = z.infer<typeof NodeScheduleSchema>;

export const NodeAISchema = z.object({
  interestScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  adventurousness: z.number().min(0).max(1),
  priority: z.number().min(0).max(1),
});
export type NodeAI = z.infer<typeof NodeAISchema>;

export const NodeLinksSchema = z.object({
  booking: z.string().url().optional(),
  place: z.string().url().optional(),
  photo: z.string().url().optional(),
});
export type NodeLinks = z.infer<typeof NodeLinksSchema>;

export const AlternativeOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  place: NodePlaceSchema.optional(),
  cost: CostRangeSchema.optional(),
});
export type AlternativeOption = z.infer<typeof AlternativeOptionSchema>;

export const ItineraryNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  place: NodePlaceSchema.optional(),
  schedule: NodeScheduleSchema.optional(),
  cost: CostRangeSchema.optional(),
  ai: NodeAISchema.optional(),
  locked: z.boolean().default(false),
  links: NodeLinksSchema.optional(),
  notes: z.string().optional(),
  alternatives: z.array(AlternativeOptionSchema).optional(),
});
export type ItineraryNode = z.infer<typeof ItineraryNodeSchema>;

export const CitySegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int().nonnegative(),
});
export type CitySegment = z.infer<typeof CitySegmentSchema>;

export const DayGroupSchema = z.object({
  id: z.string(),
  dayNumber: z.number().int().positive(),
  cityId: z.string(),
  theme: z.string().optional(),
  nodeIds: z.array(z.string()).default([]),
});
export type DayGroup = z.infer<typeof DayGroupSchema>;

export const TransitModeSchema = z.enum([
  "walk",
  "transit",
  "taxi",
  "drive",
  "flight",
  "train",
  "bus",
]);
export type TransitMode = z.infer<typeof TransitModeSchema>;

export const TransitEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  mode: TransitModeSchema,
  durationMin: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  cost: CostRangeSchema.optional(),
});
export type TransitEdge = z.infer<typeof TransitEdgeSchema>;

export const LayoutOverridesSchema = z.object({
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
});
export type LayoutOverrides = z.infer<typeof LayoutOverridesSchema>;

export const ItineraryDocumentSchema = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
  cities: z.array(CitySegmentSchema).default([]),
  days: z.array(DayGroupSchema).default([]),
  nodes: z.array(ItineraryNodeSchema).default([]),
  edges: z.array(TransitEdgeSchema).default([]),
  layout: LayoutOverridesSchema.optional(),
});
export type ItineraryDocument = z.infer<typeof ItineraryDocumentSchema>;

export const TripInputsSchema = z.object({
  destinations: z.array(z.string()).min(1),
  dates: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fixed"), start: z.string(), end: z.string() }),
    z.object({ mode: z.literal("flexible"), month: z.string(), durationDays: z.number().int().min(1).max(21) }),
  ]),
  travelers: z.object({
    adults: z.number().int().min(1),
    kids: z.number().int().min(0),
    elderly: z.number().int().min(0),
  }),
  budget: MoneySchema,
  constraints: z.array(z.string()).default([]),
});
export type TripInputs = z.infer<typeof TripInputsSchema>;

export const StyleProfileSchema = z.object({
  budgetLuxury: z.number().min(0).max(1),
  pace: z.number().min(0).max(1),
  interests: z.record(InterestKeySchema, z.number().min(0).max(1)),
  flags: z.object({
    familyFriendly: z.boolean(),
    minimalWalking: z.boolean(),
    ecoFriendly: z.boolean(),
    hiddenGems: z.boolean(),
  }),
});
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const VisaItemSchema = z.object({
  destination: z.string(),
  requirement: z.string(),
  resolved: z.boolean().default(false),
});
export type VisaItem = z.infer<typeof VisaItemSchema>;

export const TripMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  inputs: TripInputsSchema,
  styleProfile: StyleProfileSchema,
  visaChecklist: z.array(VisaItemSchema).optional(),
});
export type TripMeta = z.infer<typeof TripMetaSchema>;

export const TripStateSchema = z.object({
  trip: TripMetaSchema,
  document: ItineraryDocumentSchema,
});
export type TripState = z.infer<typeof TripStateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- types`
Expected: PASS (all four `describe` blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts tests/domain/types.test.ts
git commit -m "feat: domain types and zod schemas for trip/itinerary model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Sample itinerary fixture

**Files:**
- Create: `src/domain/sample-itinerary.ts`
- Test: `tests/domain/sample-itinerary.test.ts`

**Interfaces:**
- Consumes: `TripState`, `TripStateSchema` from Task 2.
- Produces: `buildSampleTripState(): TripState` — a fresh, schema-valid Rome(3d)→Florence(2d) trip with arrival flight, intercity train, 2 stays, and attraction/food nodes; at least one node with `alternatives`; at least one `locked` node. Used by the store default, the seed (Task 16), and many tests.

- [ ] **Step 1: Write the failing test**

`tests/domain/sample-itinerary.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { TripStateSchema } from "@/domain/types";

describe("buildSampleTripState", () => {
  it("returns a schema-valid trip state", () => {
    expect(() => TripStateSchema.parse(buildSampleTripState())).not.toThrow();
  });

  it("is multi-city (Rome + Florence) with 5 days", () => {
    const { document } = buildSampleTripState();
    expect(document.cities).toHaveLength(2);
    expect(document.days).toHaveLength(5);
  });

  it("every day's nodeIds reference nodes that exist", () => {
    const { document } = buildSampleTripState();
    const ids = new Set(document.nodes.map((n) => n.id));
    for (const day of document.days) {
      for (const nid of day.nodeIds) expect(ids.has(nid)).toBe(true);
    }
  });

  it("returns a fresh object each call (no shared mutation)", () => {
    const a = buildSampleTripState();
    a.document.nodes[0]!.name = "MUTATED";
    const b = buildSampleTripState();
    expect(b.document.nodes[0]!.name).not.toBe("MUTATED");
  });

  it("includes at least one locked node and one node with alternatives", () => {
    const { document } = buildSampleTripState();
    expect(document.nodes.some((n) => n.locked)).toBe(true);
    expect(document.nodes.some((n) => (n.alternatives?.length ?? 0) > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sample-itinerary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/sample-itinerary.ts`**

Build the object with a factory function (so every call returns a fresh deep object). Use real Rome/Florence coordinates so transit estimates (Task 6) and the map (Task 9) look sensible. Keep it compact but valid.

```ts
import type { TripState } from "@/domain/types";

const EUR = "EUR" as const;

export function buildSampleTripState(): TripState {
  return {
    trip: {
      id: "sample-trip",
      title: "Rome & Florence — 5 Days",
      inputs: {
        destinations: ["Rome, Italy", "Florence, Italy"],
        dates: { mode: "flexible", month: "2026-09", durationDays: 5 },
        travelers: { adults: 2, kids: 0, elderly: 0 },
        budget: { amount: 3500, currency: EUR },
        constraints: [],
      },
      styleProfile: {
        budgetLuxury: 0.45,
        pace: 0.5,
        interests: {
          food: 0.8,
          culture: 0.9,
          nature: 0.3,
          nightlife: 0.2,
          shopping: 0.3,
          adventure: 0.2,
          photography: 0.6,
        },
        flags: { familyFriendly: false, minimalWalking: false, ecoFriendly: false, hiddenGems: true },
      },
    },
    document: {
      id: "sample-doc",
      version: 1,
      cities: [
        { id: "rome", name: "Rome", order: 0 },
        { id: "florence", name: "Florence", order: 1 },
      ],
      days: [
        { id: "d1", dayNumber: 1, cityId: "rome", theme: "Ancient Rome", nodeIds: ["arrival", "hotel-rome", "colosseum", "dinner-rome"] },
        { id: "d2", dayNumber: 2, cityId: "rome", theme: "Vatican & art", nodeIds: ["vatican", "lunch-rome", "trevi"] },
        { id: "d3", dayNumber: 3, cityId: "rome", theme: "Trastevere", nodeIds: ["pantheon", "train-to-florence"] },
        { id: "d4", dayNumber: 4, cityId: "florence", theme: "Renaissance", nodeIds: ["hotel-florence", "uffizi", "dinner-florence"] },
        { id: "d5", dayNumber: 5, cityId: "florence", theme: "Duomo & depart", nodeIds: ["duomo", "departure"] },
      ],
      nodes: [
        { id: "arrival", type: "flight", name: "Arrive FCO (Rome Fiumicino)", tags: ["arrival"], locked: true,
          place: { lat: 41.8003, lng: 12.2389, address: "Fiumicino Airport" },
          cost: { low: 380, high: 520, currency: EUR, perPerson: true, confidence: "estimated" } },
        { id: "hotel-rome", type: "stay", name: "Hotel near Termini", tags: ["hotel"], locked: false,
          place: { lat: 41.9009, lng: 12.5018, address: "Rome centre" },
          cost: { low: 110, high: 160, currency: EUR, perPerson: false, confidence: "estimated" },
          alternatives: [
            { id: "alt-hostel", name: "Boutique hostel", tags: ["budget"], cost: { low: 45, high: 70, currency: EUR, perPerson: false, confidence: "rough" } },
            { id: "alt-luxury", name: "5★ near Spanish Steps", tags: ["luxury"], cost: { low: 380, high: 520, currency: EUR, perPerson: false, confidence: "rough" } },
          ] },
        { id: "colosseum", type: "attraction", name: "Colosseum & Roman Forum", tags: ["landmark", "history"], locked: false,
          place: { lat: 41.8902, lng: 12.4922, address: "Piazza del Colosseo" },
          schedule: { durationMin: 180, weatherSensitive: false },
          cost: { low: 18, high: 32, currency: EUR, perPerson: true, confidence: "grounded" } },
        { id: "dinner-rome", type: "food", name: "Trattoria in Monti", tags: ["dinner", "italian"], locked: false,
          place: { lat: 41.8946, lng: 12.4939 },
          cost: { low: 25, high: 45, currency: EUR, perPerson: true, confidence: "estimated" } },
        { id: "vatican", type: "attraction", name: "Vatican Museums & Sistine Chapel", tags: ["art", "must-see"], locked: false,
          place: { lat: 41.9065, lng: 12.4536 }, schedule: { durationMin: 210, weatherSensitive: false },
          cost: { low: 20, high: 40, currency: EUR, perPerson: true, confidence: "grounded" } },
        { id: "lunch-rome", type: "food", name: "Pizza al taglio", tags: ["lunch"], locked: false,
          place: { lat: 41.9038, lng: 12.4573 },
          cost: { low: 8, high: 15, currency: EUR, perPerson: true, confidence: "estimated" } },
        { id: "trevi", type: "attraction", name: "Trevi Fountain", tags: ["landmark"], locked: false,
          place: { lat: 41.9009, lng: 12.4833 }, schedule: { durationMin: 40, weatherSensitive: true },
          cost: { low: 0, high: 0, currency: EUR, perPerson: false, confidence: "grounded" } },
        { id: "pantheon", type: "attraction", name: "Pantheon", tags: ["landmark"], locked: false,
          place: { lat: 41.8986, lng: 12.4769 }, schedule: { durationMin: 45, weatherSensitive: false },
          cost: { low: 5, high: 5, currency: EUR, perPerson: true, confidence: "grounded" } },
        { id: "train-to-florence", type: "intercity_transport", name: "Frecciarossa Rome → Florence", tags: ["train"], locked: false,
          place: { lat: 41.9010, lng: 12.5015 }, schedule: { durationMin: 95, weatherSensitive: false },
          cost: { low: 25, high: 60, currency: EUR, perPerson: true, confidence: "estimated" } },
        { id: "hotel-florence", type: "stay", name: "Hotel near Santa Maria Novella", tags: ["hotel"], locked: false,
          place: { lat: 43.7764, lng: 11.2480 },
          cost: { low: 120, high: 170, currency: EUR, perPerson: false, confidence: "estimated" } },
        { id: "uffizi", type: "attraction", name: "Uffizi Gallery", tags: ["art", "must-see"], locked: false,
          place: { lat: 43.7687, lng: 11.2559 }, schedule: { durationMin: 150, weatherSensitive: false },
          cost: { low: 26, high: 40, currency: EUR, perPerson: true, confidence: "grounded" } },
        { id: "dinner-florence", type: "food", name: "Bistecca alla Fiorentina", tags: ["dinner", "steak"], locked: false,
          place: { lat: 43.7700, lng: 11.2560 },
          cost: { low: 40, high: 70, currency: EUR, perPerson: true, confidence: "estimated" } },
        { id: "duomo", type: "attraction", name: "Duomo & Brunelleschi's Dome", tags: ["landmark"], locked: false,
          place: { lat: 43.7731, lng: 11.2560 }, schedule: { durationMin: 90, weatherSensitive: false },
          cost: { low: 20, high: 30, currency: EUR, perPerson: true, confidence: "grounded" } },
        { id: "departure", type: "flight", name: "Depart FLR (Florence)", tags: ["departure"], locked: true,
          place: { lat: 43.8100, lng: 11.2051 },
          cost: { low: 380, high: 520, currency: EUR, perPerson: true, confidence: "estimated" } },
      ],
      edges: [],
      layout: { positions: {} },
    },
  };
}
```

Note: `edges` starts empty; Task 6's `rebuildDayEdges` populates it (and the store calls it on load).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sample-itinerary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/sample-itinerary.ts tests/domain/sample-itinerary.test.ts
git commit -m "feat: hardcoded Rome-Florence sample itinerary fixture

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Budget engine

**Files:**
- Create: `src/domain/budget.ts`
- Test: `tests/domain/budget.test.ts`

**Interfaces:**
- Consumes: `TripState`, `NodeType`, `CostRange`, `NODE_TYPES` from Task 2.
- Produces:
  - `computeBudget(state: TripState): BudgetSummary`
  - `type BudgetSummary = { total: { low: number; high: number; currency: string }; byCategory: Record<NodeType, { low: number; high: number }>; bySegment: Record<string, { low: number; high: number }>; target: number; state: 'under' | 'near' | 'over' }`
  - `const NEAR_THRESHOLD = 0.9` (≥90% of target and ≤100% → `near`; >100% → `over`; else `under`; compared on the `high` estimate).
- Rules: a node's contribution = `perPerson ? cost * travelerCount : cost`, where `travelerCount = adults + kids + elderly`. Nodes without a cost contribute 0. Segment attribution: each node belongs to the city of the day that lists it in `nodeIds`; a node not referenced by any day contributes to totals/categories but no segment.

- [ ] **Step 1: Write the failing test**

`tests/domain/budget.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { computeBudget } from "@/domain/budget";
import type { TripState } from "@/domain/types";

describe("computeBudget", () => {
  it("multiplies per-person costs by traveler count", () => {
    const state: TripState = {
      trip: {
        id: "t", title: "t",
        inputs: {
          destinations: ["X"], dates: { mode: "flexible", month: "2026-09", durationDays: 1 },
          travelers: { adults: 2, kids: 1, elderly: 0 }, budget: { amount: 1000, currency: "EUR" }, constraints: [],
        },
        styleProfile: { budgetLuxury: 0.5, pace: 0.5, interests: { food: 0, culture: 0, nature: 0, nightlife: 0, shopping: 0, adventure: 0, photography: 0 }, flags: { familyFriendly: false, minimalWalking: false, ecoFriendly: false, hiddenGems: false } },
      },
      document: {
        id: "d", version: 1,
        cities: [{ id: "c", name: "X", order: 0 }],
        days: [{ id: "day1", dayNumber: 1, cityId: "c", nodeIds: ["a", "b"] }],
        nodes: [
          { id: "a", type: "attraction", name: "PP", tags: [], locked: false, cost: { low: 10, high: 20, currency: "EUR", perPerson: true, confidence: "estimated" } },
          { id: "b", type: "stay", name: "Group", tags: [], locked: false, cost: { low: 100, high: 100, currency: "EUR", perPerson: false, confidence: "estimated" } },
        ],
        edges: [],
      },
    };
    const b = computeBudget(state);
    // a: 3 travelers × (10..20) = 30..60 ; b: 100..100 (group)
    expect(b.total.low).toBe(130);
    expect(b.total.high).toBe(160);
    expect(b.byCategory.attraction).toEqual({ low: 30, high: 60 });
    expect(b.bySegment.c).toEqual({ low: 130, high: 160 });
  });

  it("classifies budget state on the high estimate", () => {
    const base = buildSampleTripState();
    const b = computeBudget(base);
    expect(["under", "near", "over"]).toContain(b.state);
    expect(b.target).toBe(3500);
  });

  it("treats nodes without cost as zero", () => {
    const state = buildSampleTripState();
    state.document.nodes = state.document.nodes.map((n) => ({ ...n, cost: undefined }));
    const b = computeBudget(state);
    expect(b.total).toEqual({ low: 0, high: 0, currency: "EUR" });
    expect(b.state).toBe("under");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- budget`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/budget.ts`**

```ts
import { NODE_TYPES, type NodeType, type TripState } from "@/domain/types";

export const NEAR_THRESHOLD = 0.9;

export type BudgetSummary = {
  total: { low: number; high: number; currency: string };
  byCategory: Record<NodeType, { low: number; high: number }>;
  bySegment: Record<string, { low: number; high: number }>;
  target: number;
  state: "under" | "near" | "over";
};

function emptyByCategory(): Record<NodeType, { low: number; high: number }> {
  return Object.fromEntries(NODE_TYPES.map((t) => [t, { low: 0, high: 0 }])) as Record<
    NodeType,
    { low: number; high: number }
  >;
}

export function computeBudget(state: TripState): BudgetSummary {
  const { document, trip } = state;
  const currency = trip.inputs.budget.currency;
  const travelers =
    trip.inputs.travelers.adults + trip.inputs.travelers.kids + trip.inputs.travelers.elderly;

  const cityByNode = new Map<string, string>();
  for (const day of document.days) {
    for (const nid of day.nodeIds) cityByNode.set(nid, day.cityId);
  }

  const byCategory = emptyByCategory();
  const bySegment: Record<string, { low: number; high: number }> = {};
  let low = 0;
  let high = 0;

  for (const node of document.nodes) {
    if (!node.cost) continue;
    const mult = node.cost.perPerson ? travelers : 1;
    const nLow = node.cost.low * mult;
    const nHigh = node.cost.high * mult;
    low += nLow;
    high += nHigh;
    byCategory[node.type].low += nLow;
    byCategory[node.type].high += nHigh;
    const city = cityByNode.get(node.id);
    if (city) {
      bySegment[city] ??= { low: 0, high: 0 };
      bySegment[city].low += nLow;
      bySegment[city].high += nHigh;
    }
  }

  const target = trip.inputs.budget.amount;
  let budgetState: BudgetSummary["state"] = "under";
  if (high > target) budgetState = "over";
  else if (high >= target * NEAR_THRESHOLD) budgetState = "near";

  return { total: { low, high, currency }, byCategory, bySegment, target, state: budgetState };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- budget`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/budget.ts tests/domain/budget.test.ts
git commit -m "feat: pure budget engine (per-person, per-category, per-segment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Transit estimation & edge rebuild

**Files:**
- Create: `src/domain/transit.ts`
- Test: `tests/domain/transit.test.ts`

**Interfaces:**
- Consumes: `ItineraryDocument`, `ItineraryNode`, `TransitEdge`, `TransitMode` from Task 2.
- Produces:
  - `haversineMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number`
  - `estimateTransit(from: ItineraryNode, to: ItineraryNode): { mode: TransitMode; durationMin: number; distanceMeters: number }` — deterministic. If either node lacks coords → `{ mode: 'transit', durationMin: 15, distanceMeters: 0 }`. If `to.type` is `intercity_transport`/`flight` → mode matches (`train`/`flight`). Else walking speed 80 m/min under 1.2 km (`walk`), otherwise `transit` at 400 m/min.
  - `rebuildDayEdges(doc: ItineraryDocument): ItineraryDocument` — returns a new document whose `edges` are exactly the consecutive-node chains within each day (no cross-day edges), edge id = `${sourceId}->${targetId}`, **and whose `nodes` array is canonicalized to (day order → within-day position → orphans last)**. Canonicalizing node order makes the array a pure function of graph structure, so `addNode`/`removeNode`/`moveNode*`/`reorderDays` round-trip exactly under undo/redo. Deterministic; pure.

- [ ] **Step 1: Write the failing test**

`tests/domain/transit.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { estimateTransit, haversineMeters, rebuildDayEdges } from "@/domain/transit";
import type { ItineraryNode } from "@/domain/types";

const node = (over: Partial<ItineraryNode>): ItineraryNode => ({
  id: "x", type: "attraction", name: "x", tags: [], locked: false, ...over,
});

describe("haversineMeters", () => {
  it("is ~0 for identical points and positive otherwise", () => {
    expect(haversineMeters({ lat: 41.9, lng: 12.5 }, { lat: 41.9, lng: 12.5 })).toBeCloseTo(0, 1);
    expect(haversineMeters({ lat: 41.89, lng: 12.49 }, { lat: 43.77, lng: 11.25 })).toBeGreaterThan(100_000);
  });
});

describe("estimateTransit", () => {
  it("defaults to transit/15min when coords are missing", () => {
    expect(estimateTransit(node({}), node({}))).toEqual({ mode: "transit", durationMin: 15, distanceMeters: 0 });
  });

  it("walks for short hops", () => {
    const a = node({ place: { lat: 41.8902, lng: 12.4922 } });
    const b = node({ place: { lat: 41.8946, lng: 12.4939 } });
    expect(estimateTransit(a, b).mode).toBe("walk");
  });

  it("uses train mode for intercity transport targets", () => {
    const a = node({ place: { lat: 41.9, lng: 12.5 } });
    const b = node({ type: "intercity_transport", place: { lat: 43.77, lng: 11.25 } });
    expect(estimateTransit(a, b).mode).toBe("train");
  });
});

describe("rebuildDayEdges", () => {
  it("creates n-1 edges per day and no cross-day edges", () => {
    const { document } = buildSampleTripState();
    const rebuilt = rebuildDayEdges(document);
    const expected = document.days.reduce((sum, d) => sum + Math.max(0, d.nodeIds.length - 1), 0);
    expect(rebuilt.edges).toHaveLength(expected);
    // every edge's source & target share a day
    const dayOf = new Map<string, string>();
    for (const d of document.days) for (const nid of d.nodeIds) dayOf.set(nid, d.id);
    for (const e of rebuilt.edges) expect(dayOf.get(e.source)).toBe(dayOf.get(e.target));
  });

  it("is idempotent", () => {
    const { document } = buildSampleTripState();
    const once = rebuildDayEdges(document);
    const twice = rebuildDayEdges(once);
    expect(twice.edges).toEqual(once.edges);
    expect(twice.nodes).toEqual(once.nodes);
  });

  it("canonicalizes node order to day/position regardless of input order", () => {
    const { document } = buildSampleTripState();
    const shuffled = { ...document, nodes: [...document.nodes].reverse() };
    const rebuilt = rebuildDayEdges(shuffled);
    expect(rebuilt.nodes.map((n) => n.id)[0]).toBe("arrival");
    expect(rebuilt.nodes.map((n) => n.id)[3]).toBe("dinner-rome");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- transit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/transit.ts`**

```ts
import type { ItineraryDocument, ItineraryNode, TransitEdge, TransitMode } from "@/domain/types";

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function coords(n: ItineraryNode): { lat: number; lng: number } | null {
  if (n.place?.lat === undefined || n.place?.lng === undefined) return null;
  return { lat: n.place.lat, lng: n.place.lng };
}

export function estimateTransit(
  from: ItineraryNode,
  to: ItineraryNode,
): { mode: TransitMode; durationMin: number; distanceMeters: number } {
  const a = coords(from);
  const b = coords(to);
  if (!a || !b) return { mode: "transit", durationMin: 15, distanceMeters: 0 };
  const distanceMeters = Math.round(haversineMeters(a, b));
  if (to.type === "intercity_transport")
    return { mode: "train", durationMin: Math.max(30, Math.round(distanceMeters / 3000)), distanceMeters };
  if (to.type === "flight")
    return { mode: "flight", durationMin: Math.max(60, Math.round(distanceMeters / 12000)), distanceMeters };
  if (distanceMeters <= 1200)
    return { mode: "walk", durationMin: Math.max(1, Math.round(distanceMeters / 80)), distanceMeters };
  return { mode: "transit", durationMin: Math.max(5, Math.round(distanceMeters / 400)), distanceMeters };
}

export function rebuildDayEdges(doc: ItineraryDocument): ItineraryDocument {
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));

  // Canonical node ordering: day order, then within-day position; any node not
  // referenced by a day (orphan) keeps its relative order at the end. Making the
  // nodes array a pure function of structure is what lets structural commands
  // round-trip exactly under undo/redo (addNode always re-lands in the same slot).
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const day of doc.days) {
    for (const id of day.nodeIds) {
      if (nodeById.has(id) && !seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }
  for (const n of doc.nodes) if (!seen.has(n.id)) orderedIds.push(n.id);
  const nodes = orderedIds.map((id) => nodeById.get(id)!);

  const edges: TransitEdge[] = [];
  for (const day of doc.days) {
    for (let i = 0; i < day.nodeIds.length - 1; i++) {
      const from = nodeById.get(day.nodeIds[i]!);
      const to = nodeById.get(day.nodeIds[i + 1]!);
      if (!from || !to) continue;
      const est = estimateTransit(from, to);
      edges.push({ id: `${from.id}->${to.id}`, source: from.id, target: to.id, ...est });
    }
  }
  return { ...doc, nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- transit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/transit.ts tests/domain/transit.test.ts
git commit -m "feat: deterministic transit estimation and intra-day edge rebuild

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Command infrastructure & node commands

**Files:**
- Create: `src/domain/commands.ts`
- Test: `tests/domain/commands.test.ts`

**Interfaces:**
- Consumes: `TripState`, `ItineraryNode`, `ItineraryDocument`, `StyleProfile`, `TripInputs` from Task 2; `rebuildDayEdges` from Task 5.
- Produces (used by Task 7 which extends the switch, and Task 8 which calls it):
  - The full `Command` discriminated union (all 10 variants — node & alternative variants implemented here; ordering & trip variants implemented in Task 7).
  - `applyCommand(state: TripState, cmd: Command): CommandResult` where `type CommandResult = { state: TripState; inverse: Command }`.
  - Every `apply` is pure (no mutation of the input) and returns an `inverse` that is itself a valid `Command`; applying a command then its inverse yields a state deep-equal to the input.

- [ ] **Step 1: Write the failing test**

`tests/domain/commands.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "@/domain/commands";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { rebuildDayEdges } from "@/domain/transit";
import type { ItineraryNode, TripState } from "@/domain/types";

function sample(): TripState {
  const s = buildSampleTripState();
  return { ...s, document: rebuildDayEdges(s.document) };
}

function roundTrips(state: TripState, cmd: Command) {
  const { state: after, inverse } = applyCommand(state, cmd);
  const { state: back } = applyCommand(after, inverse);
  expect(back).toEqual(state);
  return after;
}

const newNode: ItineraryNode = {
  id: "gelato", type: "food", name: "Gelato stop", tags: ["dessert"], locked: false,
  place: { lat: 41.8995, lng: 12.4763 },
  cost: { low: 4, high: 8, currency: "EUR", perPerson: true, confidence: "estimated" },
};

describe("addNode / removeNode", () => {
  it("adds a node at an index and inverts cleanly", () => {
    const s = sample();
    const after = roundTrips(s, { type: "addNode", dayId: "d2", node: newNode, index: 1 });
    const d2 = after.document.days.find((d) => d.id === "d2")!;
    expect(d2.nodeIds[1]).toBe("gelato");
    expect(after.document.nodes.some((n) => n.id === "gelato")).toBe(true);
  });

  it("removes a node and inverts cleanly (restores position + edges)", () => {
    const s = sample();
    const after = roundTrips(s, { type: "removeNode", nodeId: "trevi" });
    expect(after.document.nodes.some((n) => n.id === "trevi")).toBe(false);
    expect(after.document.days.find((d) => d.id === "d2")!.nodeIds).not.toContain("trevi");
  });
});

describe("updateNodeProps", () => {
  it("applies a patch and inverts (including previously-absent keys)", () => {
    const s = sample();
    roundTrips(s, { type: "updateNodeProps", nodeId: "colosseum", patch: { name: "Colosseum (guided)", notes: "book ahead" } });
  });
});

describe("toggleLock", () => {
  it("is self-inverse", () => {
    const s = sample();
    const after = roundTrips(s, { type: "toggleLock", nodeId: "colosseum" });
    expect(after.document.nodes.find((n) => n.id === "colosseum")!.locked).toBe(true);
  });
});

describe("swapAlternative", () => {
  it("swaps the node's cost/name with the chosen alternative and inverts", () => {
    const s = sample();
    const after = roundTrips(s, { type: "swapAlternative", nodeId: "hotel-rome", alternativeId: "alt-hostel" });
    const hotel = after.document.nodes.find((n) => n.id === "hotel-rome")!;
    expect(hotel.name).toBe("Boutique hostel");
    expect(hotel.cost!.low).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commands`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/commands.ts`**

```ts
import { rebuildDayEdges } from "@/domain/transit";
import type {
  AlternativeOption,
  ItineraryDocument,
  ItineraryNode,
  StyleProfile,
  TripInputs,
  TripState,
} from "@/domain/types";

export type Command =
  | { type: "addNode"; dayId: string; node: ItineraryNode; index: number }
  | { type: "removeNode"; nodeId: string }
  | { type: "updateNodeProps"; nodeId: string; patch: Partial<ItineraryNode> }
  | { type: "toggleLock"; nodeId: string }
  | { type: "swapAlternative"; nodeId: string; alternativeId: string }
  | { type: "moveNodeWithinDay"; nodeId: string; toIndex: number }
  | { type: "moveNodeAcrossDays"; nodeId: string; toDayId: string; toIndex: number }
  | { type: "reorderDays"; orderedDayIds: string[] }
  | { type: "updateStyleProfile"; patch: Partial<StyleProfile> }
  | { type: "updateTripInputs"; patch: Partial<TripInputs> };

export type CommandResult = { state: TripState; inverse: Command };

const clone = <T>(v: T): T => structuredClone(v);

function withDoc(state: TripState, doc: ItineraryDocument): TripState {
  return { ...state, document: rebuildDayEdges(doc) };
}

function findDayOf(doc: ItineraryDocument, nodeId: string): { dayId: string; index: number } {
  for (const day of doc.days) {
    const index = day.nodeIds.indexOf(nodeId);
    if (index !== -1) return { dayId: day.id, index };
  }
  throw new Error(`node ${nodeId} is not in any day`);
}

const SWAP_KEYS = ["name", "description", "category", "tags", "place", "cost"] as const;
type SwapKey = (typeof SWAP_KEYS)[number];

export function applyCommand(state: TripState, cmd: Command): CommandResult {
  const doc = clone(state.document);

  switch (cmd.type) {
    case "addNode": {
      const day = doc.days.find((d) => d.id === cmd.dayId);
      if (!day) throw new Error(`day ${cmd.dayId} not found`);
      doc.nodes.push(clone(cmd.node));
      day.nodeIds.splice(cmd.index, 0, cmd.node.id);
      return { state: withDoc(state, doc), inverse: { type: "removeNode", nodeId: cmd.node.id } };
    }
    case "removeNode": {
      const node = doc.nodes.find((n) => n.id === cmd.nodeId);
      if (!node) throw new Error(`node ${cmd.nodeId} not found`);
      const { dayId, index } = findDayOf(doc, cmd.nodeId);
      doc.nodes = doc.nodes.filter((n) => n.id !== cmd.nodeId);
      const day = doc.days.find((d) => d.id === dayId)!;
      day.nodeIds = day.nodeIds.filter((id) => id !== cmd.nodeId);
      return {
        state: withDoc(state, doc),
        inverse: { type: "addNode", dayId, node: clone(node), index },
      };
    }
    case "updateNodeProps": {
      const node = doc.nodes.find((n) => n.id === cmd.nodeId);
      if (!node) throw new Error(`node ${cmd.nodeId} not found`);
      const prev: Partial<ItineraryNode> = {};
      for (const key of Object.keys(cmd.patch) as (keyof ItineraryNode)[]) {
        (prev as Record<string, unknown>)[key] = clone(node[key]);
      }
      Object.assign(node, clone(cmd.patch));
      return {
        state: withDoc(state, doc),
        inverse: { type: "updateNodeProps", nodeId: cmd.nodeId, patch: prev },
      };
    }
    case "toggleLock": {
      const node = doc.nodes.find((n) => n.id === cmd.nodeId);
      if (!node) throw new Error(`node ${cmd.nodeId} not found`);
      node.locked = !node.locked;
      // edges unaffected by lock; skip rebuild for a cheap, exact inverse round-trip
      return { state: { ...state, document: doc }, inverse: { type: "toggleLock", nodeId: cmd.nodeId } };
    }
    case "swapAlternative": {
      const node = doc.nodes.find((n) => n.id === cmd.nodeId);
      if (!node) throw new Error(`node ${cmd.nodeId} not found`);
      const alt = node.alternatives?.find((a) => a.id === cmd.alternativeId);
      if (!alt) throw new Error(`alternative ${cmd.alternativeId} not found on ${cmd.nodeId}`);
      const prevPatch: Partial<ItineraryNode> = {};
      for (const key of SWAP_KEYS) (prevPatch as Record<string, unknown>)[key] = clone(node[key]);
      prevPatch.alternatives = clone(node.alternatives);
      const displaced: AlternativeOption = {
        id: `prev:${node.id}:${cmd.alternativeId}`,
        name: node.name,
        description: node.description,
        category: node.category,
        tags: clone(node.tags),
        place: clone(node.place),
        cost: clone(node.cost),
      };
      node.name = alt.name;
      node.description = alt.description;
      node.category = alt.category;
      node.tags = clone(alt.tags);
      node.place = clone(alt.place);
      node.cost = clone(alt.cost);
      node.alternatives = [
        ...(node.alternatives ?? []).filter((a) => a.id !== cmd.alternativeId),
        displaced,
      ];
      return {
        state: withDoc(state, doc),
        inverse: { type: "updateNodeProps", nodeId: cmd.nodeId, patch: prevPatch },
      };
    }
    default:
      throw new Error(`unhandled command: ${(cmd as Command).type}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commands`
Expected: PASS (all round-trips deep-equal the original).

- [ ] **Step 5: Commit**

```bash
git add src/domain/commands.ts tests/domain/commands.test.ts
git commit -m "feat: invertible command core (add/remove/update/lock/swap)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Ordering & trip-level commands

**Files:**
- Modify: `src/domain/commands.ts` (add cases before the `default` branch)
- Test: `tests/domain/commands-ordering.test.ts`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces: implementations for `moveNodeWithinDay`, `moveNodeAcrossDays`, `reorderDays`, `updateStyleProfile`, `updateTripInputs` — completing the `Command` union. `reorderDays` recomputes each `DayGroup.dayNumber` from its new position (1-based). Trip-level commands mutate `trip` only and do **not** rebuild edges or trigger any AI (no AI in Phase 1).

- [ ] **Step 1: Write the failing test**

`tests/domain/commands-ordering.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "@/domain/commands";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { rebuildDayEdges } from "@/domain/transit";
import type { TripState } from "@/domain/types";

function sample(): TripState {
  const s = buildSampleTripState();
  return { ...s, document: rebuildDayEdges(s.document) };
}
function roundTrips(state: TripState, cmd: Command) {
  const { state: after, inverse } = applyCommand(state, cmd);
  const { state: back } = applyCommand(after, inverse);
  expect(back).toEqual(state);
  return after;
}

describe("moveNodeWithinDay", () => {
  it("reorders within a day and inverts", () => {
    const s = sample();
    const after = roundTrips(s, { type: "moveNodeWithinDay", nodeId: "colosseum", toIndex: 0 });
    expect(after.document.days.find((d) => d.id === "d1")!.nodeIds[0]).toBe("colosseum");
  });
});

describe("moveNodeAcrossDays", () => {
  it("moves a node to another day and inverts", () => {
    const s = sample();
    const after = roundTrips(s, { type: "moveNodeAcrossDays", nodeId: "trevi", toDayId: "d1", toIndex: 0 });
    expect(after.document.days.find((d) => d.id === "d1")!.nodeIds).toContain("trevi");
    expect(after.document.days.find((d) => d.id === "d2")!.nodeIds).not.toContain("trevi");
  });
});

describe("reorderDays", () => {
  it("reorders days, recomputes dayNumber, and inverts", () => {
    const s = sample();
    const order = ["d2", "d1", "d3", "d4", "d5"];
    const after = roundTrips(s, { type: "reorderDays", orderedDayIds: order });
    expect(after.document.days.map((d) => d.id)).toEqual(order);
    expect(after.document.days[0]!.dayNumber).toBe(1);
    expect(after.document.days[1]!.dayNumber).toBe(2);
  });

  it("throws when orderedDayIds is not a permutation", () => {
    const s = sample();
    expect(() => applyCommand(s, { type: "reorderDays", orderedDayIds: ["d1", "d2"] })).toThrow();
  });
});

describe("trip-level commands", () => {
  it("updateStyleProfile applies and inverts", () => {
    const s = sample();
    const after = roundTrips(s, { type: "updateStyleProfile", patch: { pace: 0.9 } });
    expect(after.trip.styleProfile.pace).toBe(0.9);
  });
  it("updateTripInputs applies and inverts", () => {
    const s = sample();
    const after = roundTrips(s, { type: "updateTripInputs", patch: { budget: { amount: 5000, currency: "EUR" } } });
    expect(after.trip.inputs.budget.amount).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commands-ordering`
Expected: FAIL — cases hit the `default` branch and throw `unhandled command`.

- [ ] **Step 3: Add the cases to `src/domain/commands.ts` (immediately before `default:`)**

```ts
    case "moveNodeWithinDay": {
      const { dayId, index } = findDayOf(doc, cmd.nodeId);
      const day = doc.days.find((d) => d.id === dayId)!;
      day.nodeIds.splice(index, 1);
      day.nodeIds.splice(cmd.toIndex, 0, cmd.nodeId);
      return {
        state: withDoc(state, doc),
        inverse: { type: "moveNodeWithinDay", nodeId: cmd.nodeId, toIndex: index },
      };
    }
    case "moveNodeAcrossDays": {
      const { dayId: fromDayId, index: fromIndex } = findDayOf(doc, cmd.nodeId);
      const fromDay = doc.days.find((d) => d.id === fromDayId)!;
      const toDay = doc.days.find((d) => d.id === cmd.toDayId);
      if (!toDay) throw new Error(`day ${cmd.toDayId} not found`);
      fromDay.nodeIds.splice(fromIndex, 1);
      toDay.nodeIds.splice(cmd.toIndex, 0, cmd.nodeId);
      return {
        state: withDoc(state, doc),
        inverse: {
          type: "moveNodeAcrossDays",
          nodeId: cmd.nodeId,
          toDayId: fromDayId,
          toIndex: fromIndex,
        },
      };
    }
    case "reorderDays": {
      const prevOrder = doc.days.map((d) => d.id);
      const same =
        cmd.orderedDayIds.length === prevOrder.length &&
        [...cmd.orderedDayIds].sort().join() === [...prevOrder].sort().join();
      if (!same) throw new Error("reorderDays requires a permutation of existing day ids");
      const byId = new Map(doc.days.map((d) => [d.id, d]));
      doc.days = cmd.orderedDayIds.map((id, i) => ({ ...byId.get(id)!, dayNumber: i + 1 }));
      return {
        state: withDoc(state, doc),
        inverse: { type: "reorderDays", orderedDayIds: prevOrder },
      };
    }
    case "updateStyleProfile": {
      const trip = clone(state.trip);
      const prev: Partial<StyleProfile> = {};
      for (const key of Object.keys(cmd.patch) as (keyof StyleProfile)[]) {
        (prev as Record<string, unknown>)[key] = clone(trip.styleProfile[key]);
      }
      trip.styleProfile = { ...trip.styleProfile, ...clone(cmd.patch) };
      return {
        state: { ...state, trip },
        inverse: { type: "updateStyleProfile", patch: prev },
      };
    }
    case "updateTripInputs": {
      const trip = clone(state.trip);
      const prev: Partial<TripInputs> = {};
      for (const key of Object.keys(cmd.patch) as (keyof TripInputs)[]) {
        (prev as Record<string, unknown>)[key] = clone(trip.inputs[key]);
      }
      trip.inputs = { ...trip.inputs, ...clone(cmd.patch) };
      return {
        state: { ...state, trip },
        inverse: { type: "updateTripInputs", patch: prev },
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commands-ordering`
Expected: PASS. Also run `npm test -- commands` to confirm no regression.

- [ ] **Step 5: Commit**

```bash
git add src/domain/commands.ts tests/domain/commands-ordering.test.ts
git commit -m "feat: ordering and trip-level commands complete the command set

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Trip store (Zustand) with undo/redo

**Files:**
- Create: `src/store/trip-store.ts`
- Test: `tests/domain/trip-store.test.ts`

**Interfaces:**
- Consumes: `applyCommand`, `Command` (Tasks 6–7); `rebuildDayEdges` (Task 5); `TripState` (Task 2).
- Produces: `useTripStore` (Zustand hook, also usable via `.getState()`), with fields:
  - `state: TripState`, `undoStack: Command[]`, `redoStack: Command[]`, `selectedNodeId: string | null`, `dirty: boolean`
  - `dispatch(cmd: Command): void`, `undo(): void`, `redo(): void`, `canUndo(): boolean`, `canRedo(): boolean`
  - `selectNode(id: string | null): void`, `setNodePosition(id: string, pos: { x: number; y: number }): void`
  - `loadTripState(s: TripState): void` (rebuilds edges, resets stacks, `dirty=false`), `markSaved(): void`
- Budget is **not** stored — consumers derive it with `computeBudget(store.state)` in a selector.
- `setNodePosition` mutates `document.layout.positions` and sets `dirty` but never touches the undo/redo stacks (view state, per Global Constraints).

- [ ] **Step 1: Write the failing test**

`tests/domain/trip-store.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { computeBudget } from "@/domain/budget";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { useTripStore } from "@/store/trip-store";

const S = () => useTripStore.getState();

beforeEach(() => {
  S().loadTripState(buildSampleTripState());
});

describe("trip store", () => {
  it("rebuilds edges on load", () => {
    expect(S().state.document.edges.length).toBeGreaterThan(0);
  });

  it("dispatch updates state, enables undo, clears redo, marks dirty", () => {
    S().dispatch({ type: "toggleLock", nodeId: "colosseum" });
    expect(S().state.document.nodes.find((n) => n.id === "colosseum")!.locked).toBe(true);
    expect(S().canUndo()).toBe(true);
    expect(S().canRedo()).toBe(false);
    expect(S().dirty).toBe(true);
  });

  it("undo then redo round-trips", () => {
    const before = structuredClone(S().state);
    S().dispatch({ type: "removeNode", nodeId: "trevi" });
    S().undo();
    expect(S().state).toEqual(before);
    S().redo();
    expect(S().state.document.nodes.some((n) => n.id === "trevi")).toBe(false);
  });

  it("a new dispatch clears the redo stack", () => {
    S().dispatch({ type: "toggleLock", nodeId: "colosseum" });
    S().undo();
    expect(S().canRedo()).toBe(true);
    S().dispatch({ type: "toggleLock", nodeId: "vatican" });
    expect(S().canRedo()).toBe(false);
  });

  it("setNodePosition marks dirty but does not affect undo", () => {
    S().setNodePosition("colosseum", { x: 10, y: 20 });
    expect(S().canUndo()).toBe(false);
    expect(S().state.document.layout!.positions.colosseum).toEqual({ x: 10, y: 20 });
    expect(S().dirty).toBe(true);
  });

  it("budget reflects dispatched edits", () => {
    const before = computeBudget(S().state).total.high;
    S().dispatch({ type: "removeNode", nodeId: "arrival" });
    expect(computeBudget(S().state).total.high).toBeLessThan(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- trip-store`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/trip-store.ts`**

```ts
import { create } from "zustand";
import { applyCommand, type Command } from "@/domain/commands";
import { rebuildDayEdges } from "@/domain/transit";
import type { TripState } from "@/domain/types";
import { buildSampleTripState } from "@/domain/sample-itinerary";

type TripStore = {
  state: TripState;
  undoStack: Command[];
  redoStack: Command[];
  selectedNodeId: string | null;
  dirty: boolean;
  dispatch: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selectNode: (id: string | null) => void;
  setNodePosition: (id: string, pos: { x: number; y: number }) => void;
  loadTripState: (s: TripState) => void;
  markSaved: () => void;
};

function normalized(s: TripState): TripState {
  const document = rebuildDayEdges(s.document);
  if (!document.layout) document.layout = { positions: {} };
  return { ...s, document };
}

export const useTripStore = create<TripStore>((set, get) => ({
  state: normalized(buildSampleTripState()),
  undoStack: [],
  redoStack: [],
  selectedNodeId: null,
  dirty: false,

  dispatch: (cmd) => {
    const { state, inverse } = applyCommand(get().state, cmd);
    set((s) => ({ state, undoStack: [...s.undoStack, inverse], redoStack: [], dirty: true }));
  },

  undo: () => {
    const { undoStack, state } = get();
    const inv = undoStack[undoStack.length - 1];
    if (!inv) return;
    const { state: next, inverse } = applyCommand(state, inv);
    set((s) => ({
      state: next,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, inverse],
      dirty: true,
    }));
  },

  redo: () => {
    const { redoStack, state } = get();
    const cmd = redoStack[redoStack.length - 1];
    if (!cmd) return;
    const { state: next, inverse } = applyCommand(state, cmd);
    set((s) => ({
      state: next,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, inverse],
      dirty: true,
    }));
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  selectNode: (id) => set({ selectedNodeId: id }),

  setNodePosition: (id, pos) =>
    set((s) => {
      const document = structuredClone(s.state.document);
      document.layout ??= { positions: {} };
      document.layout.positions[id] = pos;
      return { state: { ...s.state, document }, dirty: true };
    }),

  loadTripState: (s) =>
    set({ state: normalized(s), undoStack: [], redoStack: [], selectedNodeId: null, dirty: false }),

  markSaved: () => set({ dirty: false }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- trip-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/trip-store.ts tests/domain/trip-store.test.ts
git commit -m "feat: zustand trip store with invertible undo/redo stacks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Canvas layout & React Flow rendering

**Files:**
- Create: `src/domain/layout.ts`, `src/components/canvas/TripCanvas.tsx`, `src/components/canvas/ItineraryNodeCard.tsx`, `src/components/canvas/DayGroupNode.tsx`, `src/components/canvas/TransitEdge.tsx`, `src/components/canvas/node-visuals.ts`
- Modify: `tests/setup.ts` (add ResizeObserver/matchMedia mocks)
- Test: `tests/domain/layout.test.ts`, `tests/domain/trip-canvas.test.tsx`

**Interfaces:**
- Consumes: `TripState`, `NodeType` (Task 2); `useTripStore` (Task 8).
- Produces:
  - `computeLayout(state: TripState): LayoutResult` — pure. `type PositionedNode = { id: string; x: number; y: number; dayId: string }`; `type DayBox = { id: string; x: number; y: number; width: number; height: number; dayNumber: number; theme?: string; cityName: string; isCityStart: boolean }`; `type LayoutResult = { nodes: PositionedNode[]; dayBoxes: DayBox[] }`. Column layout: day index → x; node index → y; `document.layout.positions[id]` overrides a node's x/y when present.
  - Layout constants exported: `COL_W=320`, `ROW_H=140`, `NODE_W=260`, `HEADER_H=72`.
  - `nodeColor(type)`, `nodeIcon(type)`, `nodeTypeLabel(type)` from `node-visuals.ts`.
  - `<TripCanvas />` — a React Flow canvas (Background, Controls, MiniMap) that reads `useTripStore`, renders day boxes + itinerary nodes + transit edges. Selection and drag wire to the store (drag → `setNodePosition`, click → `selectNode`). Deeper interactions land in Task 10.

- [ ] **Step 1: Write the failing layout test**

`tests/domain/layout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { COL_W, computeLayout, HEADER_H, ROW_H } from "@/domain/layout";
import { buildSampleTripState } from "@/domain/sample-itinerary";

describe("computeLayout", () => {
  it("positions each node in its day's column", () => {
    const { nodes, dayBoxes } = computeLayout(buildSampleTripState());
    expect(nodes).toHaveLength(14);
    expect(dayBoxes).toHaveLength(5);
    const arrival = nodes.find((n) => n.id === "arrival")!;
    expect(arrival.x).toBe(0);
    expect(arrival.y).toBe(HEADER_H);
    const colosseum = nodes.find((n) => n.id === "colosseum")!;
    expect(colosseum.y).toBe(HEADER_H + 2 * ROW_H); // third node in d1
  });

  it("places day 2 in the next column", () => {
    const { dayBoxes } = computeLayout(buildSampleTripState());
    expect(dayBoxes.find((d) => d.id === "d2")!.x).toBe(COL_W);
  });

  it("marks the first day of each city", () => {
    const { dayBoxes } = computeLayout(buildSampleTripState());
    expect(dayBoxes.find((d) => d.id === "d1")!.isCityStart).toBe(true);
    expect(dayBoxes.find((d) => d.id === "d2")!.isCityStart).toBe(false);
    expect(dayBoxes.find((d) => d.id === "d4")!.isCityStart).toBe(true);
  });

  it("respects manual position overrides", () => {
    const s = buildSampleTripState();
    s.document.layout = { positions: { colosseum: { x: 999, y: 111 } } };
    const { nodes } = computeLayout(s);
    const colosseum = nodes.find((n) => n.id === "colosseum")!;
    expect(colosseum).toMatchObject({ x: 999, y: 111 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- layout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/layout.ts`**

```ts
import type { TripState } from "@/domain/types";

export const COL_W = 320;
export const ROW_H = 140;
export const NODE_W = 260;
export const HEADER_H = 72;

export type PositionedNode = { id: string; x: number; y: number; dayId: string };
export type DayBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dayNumber: number;
  theme?: string;
  cityName: string;
  isCityStart: boolean;
};
export type LayoutResult = { nodes: PositionedNode[]; dayBoxes: DayBox[] };

export function computeLayout(state: TripState): LayoutResult {
  const { document } = state;
  const cityName = new Map(document.cities.map((c) => [c.id, c.name]));
  const overrides = document.layout?.positions ?? {};
  const nodes: PositionedNode[] = [];
  const dayBoxes: DayBox[] = [];
  let prevCity: string | null = null;

  document.days.forEach((day, dayIndex) => {
    const colX = dayIndex * COL_W;
    const count = Math.max(1, day.nodeIds.length);
    dayBoxes.push({
      id: day.id,
      x: colX,
      y: 0,
      width: NODE_W + 24,
      height: HEADER_H + count * ROW_H,
      dayNumber: day.dayNumber,
      theme: day.theme,
      cityName: cityName.get(day.cityId) ?? "",
      isCityStart: day.cityId !== prevCity,
    });
    prevCity = day.cityId;

    day.nodeIds.forEach((nid, nodeIndex) => {
      const base = { x: colX + 12, y: HEADER_H + nodeIndex * ROW_H };
      const override = overrides[nid];
      nodes.push({ id: nid, dayId: day.id, x: override?.x ?? base.x, y: override?.y ?? base.y });
    });
  });

  return { nodes, dayBoxes };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- layout`
Expected: PASS.

- [ ] **Step 5: Implement `src/components/canvas/node-visuals.ts`**

```ts
import type { NodeType } from "@/domain/types";

const COLORS: Record<NodeType, string> = {
  flight: "#2563eb",
  intercity_transport: "#0891b2",
  stay: "#7c3aed",
  attraction: "#db2777",
  food: "#ea580c",
  shopping: "#ca8a04",
  experience: "#16a34a",
  free_time: "#64748b",
  note: "#94a3b8",
};
const ICONS: Record<NodeType, string> = {
  flight: "✈️",
  intercity_transport: "🚆",
  stay: "🏨",
  attraction: "🏛️",
  food: "🍽️",
  shopping: "🛍️",
  experience: "🎭",
  free_time: "☕",
  note: "📝",
};
const LABELS: Record<NodeType, string> = {
  flight: "Flight",
  intercity_transport: "Transport",
  stay: "Stay",
  attraction: "Attraction",
  food: "Food",
  shopping: "Shopping",
  experience: "Experience",
  free_time: "Free time",
  note: "Note",
};

export const nodeColor = (t: NodeType) => COLORS[t];
export const nodeIcon = (t: NodeType) => ICONS[t];
export const nodeTypeLabel = (t: NodeType) => LABELS[t];
```

- [ ] **Step 6: Implement the node & edge components**

`src/components/canvas/ItineraryNodeCard.tsx`:
```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ItineraryNode } from "@/domain/types";
import { nodeColor, nodeIcon, nodeTypeLabel } from "@/components/canvas/node-visuals";
import { NODE_W } from "@/domain/layout";

export type ItineraryNodeData = { node: ItineraryNode; isSelected: boolean };

export function ItineraryNodeCard({ data }: NodeProps & { data: ItineraryNodeData }) {
  const { node, isSelected } = data;
  const cost = node.cost;
  return (
    <div
      style={{ width: NODE_W, borderLeftColor: nodeColor(node.type) }}
      className={`rounded-lg border border-l-4 bg-white shadow-sm px-3 py-2 text-sm ${
        isSelected ? "ring-2 ring-blue-500" : "border-slate-200"
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span aria-hidden>{nodeIcon(node.type)}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {nodeTypeLabel(node.type)}
        </span>
        {node.locked && <span title="Locked" className="ml-auto">🔒</span>}
      </div>
      <div className="font-medium text-slate-800 leading-tight">{node.name}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        {cost && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {cost.currency} {cost.low}–{cost.high}
            {cost.perPerson ? " pp" : ""}
          </span>
        )}
        {node.schedule?.durationMin != null && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {node.schedule.durationMin} min
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

`src/components/canvas/DayGroupNode.tsx`:
```tsx
import type { NodeProps } from "@xyflow/react";
import type { DayBox } from "@/domain/layout";

export type DayGroupData = { box: DayBox };

export function DayGroupNode({ data }: NodeProps & { data: DayGroupData }) {
  const { box } = data;
  return (
    <div
      style={{ width: box.width, height: box.height }}
      className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60"
    >
      {box.isCityStart && (
        <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
          {box.cityName}
        </div>
      )}
      <div className="px-3 pb-1 pt-1">
        <div className="text-sm font-semibold text-slate-700">Day {box.dayNumber}</div>
        {box.theme && <div className="text-xs text-slate-500">{box.theme}</div>}
      </div>
    </div>
  );
}
```

`src/components/canvas/TransitEdge.tsx`:
```tsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { TransitEdge as TransitEdgeModel } from "@/domain/types";

const MODE_ICON: Record<string, string> = {
  walk: "🚶",
  transit: "🚌",
  taxi: "🚕",
  drive: "🚗",
  flight: "✈️",
  train: "🚆",
  bus: "🚌",
};

export type TransitEdgeData = { edge: TransitEdgeModel };

export function TransitEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps & { data: TransitEdgeData }) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  const e = data.edge;
  return (
    <>
      <BaseEdge path={path} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          className="pointer-events-none absolute rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm"
        >
          {MODE_ICON[e.mode] ?? "→"} {e.durationMin} min
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

- [ ] **Step 7: Add test mocks and implement `TripCanvas`**

Append to `tests/setup.ts`:
```ts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom lacks ResizeObserver
globalThis.ResizeObserver = ResizeObserverMock;
// @ts-expect-error jsdom lacks matchMedia
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
```

`src/components/canvas/TripCanvas.tsx`:
```tsx
"use client";
import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import { DayGroupNode } from "@/components/canvas/DayGroupNode";
import { ItineraryNodeCard } from "@/components/canvas/ItineraryNodeCard";
import { TransitEdge } from "@/components/canvas/TransitEdge";
import { nodeColor } from "@/components/canvas/node-visuals";
import { computeLayout } from "@/domain/layout";
import type { NodeType } from "@/domain/types";
import { useTripStore } from "@/store/trip-store";

const nodeTypes = { itineraryNode: ItineraryNodeCard, dayGroup: DayGroupNode };
const edgeTypes = { transit: TransitEdge };

function Flow() {
  const state = useTripStore((s) => s.state);
  const selectedNodeId = useTripStore((s) => s.selectedNodeId);
  const selectNode = useTripStore((s) => s.selectNode);
  const setNodePosition = useTripStore((s) => s.setNodePosition);

  const nodeById = useMemo(() => new Map(state.document.nodes.map((n) => [n.id, n])), [state]);

  // Build the React Flow node array from the pure layout + store state.
  const buildNodes = useCallback((): Node[] => {
    const { nodes: positioned, dayBoxes } = computeLayout(state);
    const groups: Node[] = dayBoxes.map((box) => ({
      id: `day-${box.id}`,
      type: "dayGroup",
      position: { x: box.x, y: box.y },
      data: { box },
      draggable: false,
      selectable: false,
      zIndex: 0,
    }));
    const cards: Node[] = positioned.map((p) => ({
      id: p.id,
      type: "itineraryNode",
      position: { x: p.x, y: p.y },
      data: { node: nodeById.get(p.id)!, isSelected: p.id === selectedNodeId },
      zIndex: 1,
    }));
    return [...groups, ...cards];
  }, [state, nodeById, selectedNodeId]);

  // Controlled nodes so dragging is smooth; re-sync whenever state/selection changes.
  // A drag only touches local RF state until drop, so no store churn mid-drag.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  useEffect(() => {
    setRfNodes(buildNodes());
  }, [buildNodes, setRfNodes]);

  const rfEdges = useMemo<Edge[]>(
    () => state.document.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "transit", data: { edge: e } })),
    [state.document.edges],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (c.type === "position" && c.dragging === false && c.position) {
          setNodePosition(c.id, c.position);
        }
      }
    },
    [onNodesChange, setNodePosition],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onNodeClick={(_, n) => selectNode(n.id)}
      onPaneClick={() => selectNode(null)}
      onlyRenderVisibleElements={false}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const data = n.data as { node?: { type: NodeType } };
          return n.type === "itineraryNode" && data.node ? nodeColor(data.node.type) : "#e2e8f0";
        }}
      />
    </ReactFlow>
  );
}

export function TripCanvas() {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
```

- [ ] **Step 8: Write the component smoke test**

`tests/domain/trip-canvas.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TripCanvas } from "@/components/canvas/TripCanvas";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { useTripStore } from "@/store/trip-store";

beforeEach(() => useTripStore.getState().loadTripState(buildSampleTripState()));

describe("TripCanvas", () => {
  it("renders itinerary node cards and city labels", () => {
    render(<TripCanvas />);
    expect(screen.getByText("Colosseum & Roman Forum")).toBeInTheDocument();
    expect(screen.getAllByText("Rome").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 9: Run tests + typecheck**

Run: `npm test -- trip-canvas layout` then `npx tsc --noEmit` then `npm run lint`
Expected: all PASS / no errors.

- [ ] **Step 10: Commit**

```bash
git add src/domain/layout.ts src/components/canvas tests/setup.ts tests/domain/layout.test.ts tests/domain/trip-canvas.test.tsx
git commit -m "feat: canvas layout engine and React Flow rendering

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Node detail drawer (edit / lock / delete / swap)

**Files:**
- Create: `src/components/drawer/NodeDrawer.tsx`
- Test: `tests/domain/node-drawer.test.tsx`

**Interfaces:**
- Consumes: `useTripStore` (Task 8); `Confidence`, `ItineraryNode` (Task 2); `nodeTypeLabel` (Task 9).
- Produces: `<NodeDrawer />` — right-side panel bound to `selectedNodeId`. Renders nothing when no node is selected. Tabs: Details / Cost / Schedule / AI / Notes. Edits dispatch `updateNodeProps`; Lock dispatches `toggleLock`; Delete dispatches `removeNode` then `selectNode(null)`; each alternative offers "Use this" → `swapAlternative`.
- Phase 1 note: text fields dispatch on `change` for simplicity, so each keystroke is one undo step. Debounced text commits are a Phase 3 refinement — not a bug.

- [ ] **Step 1: Write the failing test**

`tests/domain/node-drawer.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NodeDrawer } from "@/components/drawer/NodeDrawer";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { useTripStore } from "@/store/trip-store";

const S = () => useTripStore.getState();
beforeEach(() => S().loadTripState(buildSampleTripState()));

describe("NodeDrawer", () => {
  it("renders nothing when no node is selected", () => {
    const { container } = render(<NodeDrawer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("edits the node name via the store", () => {
    S().selectNode("colosseum");
    render(<NodeDrawer />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Colosseum (skip-the-line)" } });
    expect(S().state.document.nodes.find((n) => n.id === "colosseum")!.name).toBe(
      "Colosseum (skip-the-line)",
    );
  });

  it("toggles lock", () => {
    S().selectNode("colosseum");
    render(<NodeDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /lock/i }));
    expect(S().state.document.nodes.find((n) => n.id === "colosseum")!.locked).toBe(true);
  });

  it("deletes the node and clears selection", () => {
    S().selectNode("trevi");
    render(<NodeDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(S().state.document.nodes.some((n) => n.id === "trevi")).toBe(false);
    expect(S().selectedNodeId).toBeNull();
  });

  it("swaps an alternative", () => {
    S().selectNode("hotel-rome");
    render(<NodeDrawer />);
    fireEvent.click(screen.getByText("Alternatives"));
    fireEvent.click(screen.getByRole("button", { name: /use boutique hostel/i }));
    expect(S().state.document.nodes.find((n) => n.id === "hotel-rome")!.name).toBe("Boutique hostel");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- node-drawer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/drawer/NodeDrawer.tsx`**

```tsx
"use client";
import { useState } from "react";
import { nodeTypeLabel } from "@/components/canvas/node-visuals";
import type { Confidence, ItineraryNode } from "@/domain/types";
import { useTripStore } from "@/store/trip-store";

type Tab = "Details" | "Cost" | "Schedule" | "AI" | "Notes" | "Alternatives";
const TABS: Tab[] = ["Details", "Cost", "Schedule", "AI", "Notes", "Alternatives"];
const CONFIDENCES: Confidence[] = ["grounded", "estimated", "rough"];

export function NodeDrawer() {
  const nodeId = useTripStore((s) => s.selectedNodeId);
  const node = useTripStore((s) => s.state.document.nodes.find((n) => n.id === s.selectedNodeId));
  const dispatch = useTripStore((s) => s.dispatch);
  const selectNode = useTripStore((s) => s.selectNode);
  const [tab, setTab] = useState<Tab>("Details");

  if (!nodeId || !node) return null;
  const patch = (p: Partial<ItineraryNode>) => dispatch({ type: "updateNodeProps", nodeId, patch: p });

  return (
    <aside className="flex h-full w-80 flex-col border-l border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-slate-400">{nodeTypeLabel(node.type)}</span>
        <button type="button" className="ml-auto text-sm" onClick={() => selectNode(null)}>✕</button>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-slate-100 px-2 py-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 ${tab === t ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {tab === "Details" && (
          <>
            <Field label="Name">
              <input className={inputCls} value={node.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className={inputCls} value={node.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label="Category">
              <input className={inputCls} value={node.category ?? ""} onChange={(e) => patch({ category: e.target.value })} />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                className={inputCls}
                value={node.tags.join(", ")}
                onChange={(e) => patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              />
            </Field>
          </>
        )}

        {tab === "Cost" && (
          <>
            <Field label="Low">
              <input type="number" className={inputCls} value={node.cost?.low ?? 0}
                onChange={(e) => patch({ cost: { ...costOf(node), low: Number(e.target.value) } })} />
            </Field>
            <Field label="High">
              <input type="number" className={inputCls} value={node.cost?.high ?? 0}
                onChange={(e) => patch({ cost: { ...costOf(node), high: Number(e.target.value) } })} />
            </Field>
            <Field label="Currency">
              <input className={inputCls} value={node.cost?.currency ?? "EUR"}
                onChange={(e) => patch({ cost: { ...costOf(node), currency: e.target.value } })} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={node.cost?.perPerson ?? false}
                onChange={(e) => patch({ cost: { ...costOf(node), perPerson: e.target.checked } })} />
              Per person
            </label>
            <Field label="Confidence">
              <select className={inputCls} value={node.cost?.confidence ?? "estimated"}
                onChange={(e) => patch({ cost: { ...costOf(node), confidence: e.target.value as Confidence } })}>
                {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <p className="text-[11px] text-slate-400">Estimates, not quotes.</p>
          </>
        )}

        {tab === "Schedule" && (
          <>
            <Field label="Duration (min)">
              <input type="number" className={inputCls} value={node.schedule?.durationMin ?? 0}
                onChange={(e) => patch({ schedule: { ...schedOf(node), durationMin: Number(e.target.value) } })} />
            </Field>
            <Field label="Opening hours">
              <input className={inputCls} value={node.schedule?.openingHours ?? ""}
                onChange={(e) => patch({ schedule: { ...schedOf(node), openingHours: e.target.value } })} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={node.schedule?.weatherSensitive ?? false}
                onChange={(e) => patch({ schedule: { ...schedOf(node), weatherSensitive: e.target.checked } })} />
              Weather sensitive
            </label>
          </>
        )}

        {tab === "AI" && (
          <div className="space-y-2">
            {node.ai ? (
              (["interestScore", "confidence", "adventurousness", "priority"] as const).map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{k}</span><span>{Math.round((node.ai![k]) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-slate-100">
                    <div className="h-1.5 rounded bg-blue-500" style={{ width: `${node.ai![k] * 100}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400">No AI metadata (added when generated).</p>
            )}
          </div>
        )}

        {tab === "Notes" && (
          <textarea className={`${inputCls} min-h-32`} value={node.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} />
        )}

        {tab === "Alternatives" && (
          <div className="space-y-2">
            {(node.alternatives ?? []).length === 0 && <p className="text-slate-400">No alternatives.</p>}
            {(node.alternatives ?? []).map((alt) => (
              <div key={alt.id} className="rounded border border-slate-200 p-2">
                <div className="font-medium">{alt.name}</div>
                {alt.cost && <div className="text-xs text-slate-500">{alt.cost.currency} {alt.cost.low}–{alt.cost.high}</div>}
                <button
                  type="button"
                  className="mt-1 rounded bg-slate-800 px-2 py-1 text-xs text-white"
                  onClick={() => dispatch({ type: "swapAlternative", nodeId, alternativeId: alt.id })}
                >
                  Use {alt.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => dispatch({ type: "toggleLock", nodeId })}>
          {node.locked ? "🔒 Unlock" : "🔓 Lock"}
        </button>
        <button
          type="button"
          className="ml-auto rounded bg-red-600 px-3 py-1.5 text-sm text-white"
          onClick={() => { dispatch({ type: "removeNode", nodeId }); selectNode(null); }}
        >
          Delete
        </button>
      </footer>
    </aside>
  );
}

const inputCls = "w-full rounded border border-slate-300 px-2 py-1";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function costOf(n: ItineraryNode) {
  return n.cost ?? { low: 0, high: 0, currency: "EUR", perPerson: false, confidence: "estimated" as Confidence };
}
function schedOf(n: ItineraryNode) {
  return n.schedule ?? { weatherSensitive: false };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- node-drawer` then `npx tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/drawer/NodeDrawer.tsx tests/domain/node-drawer.test.tsx
git commit -m "feat: editable node detail drawer with lock, delete, alternatives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Budget bar

**Files:**
- Create: `src/components/BudgetBar.tsx`
- Test: `tests/domain/budget-bar.test.tsx`

**Interfaces:**
- Consumes: `computeBudget` (Task 4); `useTripStore` (Task 8); `NODE_TYPES` (Task 2); `nodeTypeLabel` (Task 9).
- Produces: `<BudgetBar />` — header widget showing the total range vs target, colored by budget state (green under / amber near / red over), expandable into per-category and per-segment breakdowns. Recomputes on every store change (derived, not stored). Carries the "estimates, not quotes" disclaimer.

- [ ] **Step 1: Write the failing test**

`tests/domain/budget-bar.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BudgetBar } from "@/components/BudgetBar";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { useTripStore } from "@/store/trip-store";

const S = () => useTripStore.getState();
beforeEach(() => S().loadTripState(buildSampleTripState()));

describe("BudgetBar", () => {
  it("shows the target and a budget-state label", () => {
    render(<BudgetBar />);
    expect(screen.getByText(/3,500/)).toBeInTheDocument();
    expect(["under budget", "near budget", "over budget"]).toContain(
      screen.getByTestId("budget-state").textContent,
    );
  });

  it("expands to show a category breakdown", () => {
    render(<BudgetBar />);
    fireEvent.click(screen.getByRole("button", { name: /breakdown/i }));
    expect(screen.getByText("Attraction")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- budget-bar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/BudgetBar.tsx`**

```tsx
"use client";
import { useState } from "react";
import { nodeTypeLabel } from "@/components/canvas/node-visuals";
import { computeBudget } from "@/domain/budget";
import { NODE_TYPES } from "@/domain/types";
import { useTripStore } from "@/store/trip-store";

const STATE_LABEL = { under: "under budget", near: "near budget", over: "over budget" } as const;
const STATE_COLOR = { under: "text-green-600", near: "text-amber-600", over: "text-red-600" } as const;

export function BudgetBar() {
  const state = useTripStore((s) => s.state);
  const [open, setOpen] = useState(false);
  const budget = computeBudget(state);
  const cur = budget.total.currency;
  const cityName = new Map(state.document.cities.map((c) => [c.id, c.name]));

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-4">
        <div>
          <span className="font-semibold" data-testid="budget-total">
            {cur} {budget.total.low.toLocaleString()}–{budget.total.high.toLocaleString()}
          </span>
          <span className="text-slate-400"> / {cur} {budget.target.toLocaleString()}</span>
        </div>
        <span data-testid="budget-state" className={`font-medium ${STATE_COLOR[budget.state]}`}>
          {STATE_LABEL[budget.state]}
        </span>
        <button type="button" className="ml-auto text-xs text-blue-600" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide breakdown" : "Show breakdown"}
        </button>
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="mb-1 font-semibold text-slate-500">By category</div>
            {NODE_TYPES.filter((t) => budget.byCategory[t].high > 0).map((t) => (
              <div key={t} className="flex justify-between">
                <span>{nodeTypeLabel(t)}</span>
                <span>{cur} {budget.byCategory[t].low}–{budget.byCategory[t].high}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-500">By city</div>
            {Object.entries(budget.bySegment).map(([cityId, v]) => (
              <div key={cityId} className="flex justify-between">
                <span>{cityName.get(cityId) ?? cityId}</span>
                <span>{cur} {v.low}–{v.high}</span>
              </div>
            ))}
          </div>
          <p className="col-span-2 text-[11px] text-slate-400">Estimates, not quotes.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- budget-bar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetBar.tsx tests/domain/budget-bar.test.tsx
git commit -m "feat: live budget bar with category and city breakdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Editor toolbar, shell page & keyboard shortcuts

**Files:**
- Create: `src/components/EditorToolbar.tsx`, `src/components/TripEditor.tsx`, `src/app/editor/page.tsx`
- Modify: `src/store/trip-store.ts` (add `tidyLayout` action)
- Test: `tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `useTripStore`, `BudgetBar`, `TripCanvas`, `NodeDrawer`, `Command` types.
- Produces:
  - Store gains `tidyLayout(): void` (clears `document.layout.positions`; marks dirty; not undoable — view state).
  - `<EditorToolbar />` — Undo/Redo (disabled by `canUndo`/`canRedo`), Tidy, and an "Add node" type picker (adds to the selected node's day, else day 1, at the end).
  - `<TripEditor />` — assembles BudgetBar (top) + Toolbar + Canvas + NodeDrawer; installs global keyboard shortcuts (⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z redo, Delete/Backspace removes the selected node — ignored while typing in a field).
  - `/editor` route renders `<TripEditor />` full-screen against the default sample trip (no persistence yet).

- [ ] **Step 1: Add `tidyLayout` to the store**

In `src/store/trip-store.ts`, add to the `TripStore` type:
```ts
  tidyLayout: () => void;
```
and to the store body (next to `setNodePosition`):
```ts
  tidyLayout: () =>
    set((s) => {
      const document = structuredClone(s.state.document);
      document.layout = { positions: {} };
      return { state: { ...s.state, document }, dirty: true };
    }),
```

- [ ] **Step 2: Implement `src/components/EditorToolbar.tsx`**

```tsx
"use client";
import { NODE_TYPES, type NodeType } from "@/domain/types";
import { nodeTypeLabel } from "@/components/canvas/node-visuals";
import { useTripStore } from "@/store/trip-store";

export function EditorToolbar() {
  const canUndo = useTripStore((s) => s.canUndo());
  const canRedo = useTripStore((s) => s.canRedo());
  const undo = useTripStore((s) => s.undo);
  const redo = useTripStore((s) => s.redo);
  const tidy = useTripStore((s) => s.tidyLayout);

  const addNode = (type: NodeType) => {
    const st = useTripStore.getState();
    const doc = st.state.document;
    const selDay = doc.days.find((d) => d.nodeIds.includes(st.selectedNodeId ?? ""));
    const day = selDay ?? doc.days[0];
    if (!day) return;
    const id = crypto.randomUUID();
    st.dispatch({
      type: "addNode",
      dayId: day.id,
      index: day.nodeIds.length,
      node: { id, type, name: `New ${nodeTypeLabel(type)}`, tags: [], locked: false },
    });
    st.selectNode(id);
  };

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm">
      <button type="button" data-testid="undo" disabled={!canUndo} onClick={undo} className="rounded border px-2 py-1 disabled:opacity-40">
        Undo
      </button>
      <button type="button" data-testid="redo" disabled={!canRedo} onClick={redo} className="rounded border px-2 py-1 disabled:opacity-40">
        Redo
      </button>
      <button type="button" data-testid="tidy" onClick={tidy} className="rounded border px-2 py-1">Tidy</button>
      <select
        className="ml-2 rounded border px-2 py-1"
        value=""
        onChange={(e) => { if (e.target.value) addNode(e.target.value as NodeType); }}
      >
        <option value="">+ Add node…</option>
        {NODE_TYPES.map((t) => <option key={t} value={t}>{nodeTypeLabel(t)}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/components/TripEditor.tsx`**

```tsx
"use client";
import { useEffect } from "react";
import { BudgetBar } from "@/components/BudgetBar";
import { EditorToolbar } from "@/components/EditorToolbar";
import { TripCanvas } from "@/components/canvas/TripCanvas";
import { NodeDrawer } from "@/components/drawer/NodeDrawer";
import { useTripStore } from "@/store/trip-store";

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
}

export function TripEditor() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useTripStore.getState();
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !isTyping(e.target) && s.selectedNodeId) {
        e.preventDefault();
        s.dispatch({ type: "removeNode", nodeId: s.selectedNodeId });
        s.selectNode(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <BudgetBar />
      <EditorToolbar />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1"><TripCanvas /></div>
        <NodeDrawer />
      </div>
    </div>
  );
}
```

`src/app/editor/page.tsx`:
```tsx
import { TripEditor } from "@/components/TripEditor";

export default function EditorPage() {
  return <TripEditor />;
}
```

- [ ] **Step 4: Write the E2E test**

`tests/e2e/editor.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("edit a node and undo on the canvas", async ({ page }) => {
  await page.goto("/editor");
  const node = page.getByText("Colosseum & Roman Forum");
  await expect(node).toBeVisible();
  await node.click();

  const nameInput = page.getByLabel("Name");
  await expect(nameInput).toHaveValue("Colosseum & Roman Forum");
  await nameInput.fill("Colosseum guided tour");
  await expect(page.getByText("Colosseum guided tour")).toBeVisible();

  await page.keyboard.press("Escape"); // blur the field so the edit commits
  await page.getByTestId("undo").click();
  await expect(page.getByText("Colosseum & Roman Forum")).toBeVisible();
  // budget state pill is always present
  await expect(page.getByTestId("budget-state")).toBeVisible();
});
```

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `npx tsc --noEmit && npm run lint && docker compose up -d db && npm run test:e2e -- editor`
Expected: type-clean, lint-clean, E2E PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/EditorToolbar.tsx src/components/TripEditor.tsx src/app/editor/page.tsx src/store/trip-store.ts tests/e2e/editor.spec.ts
git commit -m "feat: editor shell, toolbar, keyboard shortcuts, and canvas E2E

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Database & auth foundation

**Files:**
- Create: `drizzle.config.ts`, `src/db/client.ts`, `src/db/auth-schema.ts`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`
- Test: `tests/integration/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (Task 1 `.env`).
- Produces:
  - `db` — Drizzle client (postgres.js) exported from `@/db/client`.
  - `auth` — Better Auth server instance (`@/lib/auth`) with email+password (dev/testing), magic-link (logs URL in dev), and Google OAuth (only when `GOOGLE_CLIENT_ID`/`SECRET` are set).
  - `authClient` — Better Auth React client (`@/lib/auth-client`) with `signIn`/`signUp`/`signOut`/`useSession`.
  - Auth Drizzle tables `user`, `session`, `account`, `verification` (`@/db/auth-schema`).
  - `GET`/`POST` auth route at `/api/auth/*`.

- [ ] **Step 1: Add dev deps and generate the auth schema**

```bash
npm install -D dotenv
docker compose up -d db
# Generate the Better Auth Drizzle schema (preferred). If offline, use the known-good file in Step 2.
npx @better-auth/cli@latest generate --output src/db/auth-schema.ts --y || true
```

- [ ] **Step 2: If generation did not produce `src/db/auth-schema.ts`, create it (known-good Better Auth pg schema)**

```ts
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 3: Create `drizzle.config.ts` and `src/db/client.ts`**

`drizzle.config.ts` (schema array holds only auth-schema for now; Task 14 appends the app schema):
```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/auth-schema.ts"],
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

`src/db/client.ts` (Task 14 will add the app schema to the spread):
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/db/auth-schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url);
export const db = drizzle(client, { schema: { ...authSchema } });
```

- [ ] **Step 4: Create `src/lib/auth.ts`, `src/lib/auth-client.ts`, and the route handler**

`src/lib/auth.ts`:
```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/db/client";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : undefined,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Phase 1 dev: log the link. Real email delivery is a later phase.
        console.log(`[magic-link] ${email}: ${url}`);
      },
    }),
  ],
});
```

`src/lib/auth-client.ts`:
```ts
"use client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
export const { signIn, signUp, signOut, useSession } = authClient;
```

`src/app/api/auth/[...all]/route.ts`:
```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Push the schema and write the integration test**

```bash
npm run db:push   # creates user/session/account/verification tables
```

`tests/integration/db.test.ts`:
```ts
// @vitest-environment node
import "dotenv/config";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";

describe("database", () => {
  it("connects and the auth user table exists", async () => {
    const rows = await db.execute(
      sql`select table_name from information_schema.tables where table_name = 'user'`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run the integration test + typecheck**

Run: `npm test -- integration/db` then `npx tsc --noEmit`
Expected: PASS (DB up + schema pushed) / no type errors.

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts src/db/client.ts src/db/auth-schema.ts src/lib/auth.ts src/lib/auth-client.ts "src/app/api/auth/[...all]/route.ts" tests/integration/db.test.ts package.json
git commit -m "feat: postgres + drizzle client and better-auth foundation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: App data model & persistence repository

**Files:**
- Create: `src/db/schema.ts`, `src/db/trips-repo.ts`
- Modify: `src/db/client.ts` (spread app schema), `drizzle.config.ts` (add schema path)
- Test: `tests/integration/trips-repo.test.ts`

**Interfaces:**
- Consumes: `db` (Task 13), `user` table (Task 13); `TripState`, `TripStateSchema`, `ItineraryDocument`, `TripMeta` (Task 2); `buildSampleTripState` (Task 3); `rebuildDayEdges` (Task 5).
- Produces (from `@/db/trips-repo`):
  - `class ConflictError extends Error` (thrown on stale-version save).
  - `createTripFromSample(userId: string): Promise<{ tripId: string; itineraryId: string }>`
  - `listTrips(userId: string): Promise<{ id: string; title: string; updatedAt: Date; destinations: string[] }[]>`
  - `loadTripState(tripId: string, userId: string): Promise<{ tripState: TripState; itineraryId: string; version: number } | null>`
  - `saveItinerary(itineraryId: string, userId: string, document: ItineraryDocument, expectedVersion: number): Promise<{ version: number }>` (optimistic lock; throws `ConflictError`)
  - `saveTripMeta(tripId: string, userId: string, trip: TripMeta): Promise<void>`
- Tables: `trips` (id, userId, title, inputs jsonb, styleProfile jsonb, visaChecklist jsonb, createdAt, updatedAt); `itineraries` (id, tripId, document jsonb, version int, updatedAt). Only these two app tables in Phase 1 — `usage_events`, `share_links`, `cached_places`, `jobs`, `variant_previews` arrive with the phases that need them (no AI in Phase 1).

- [ ] **Step 1: Create `src/db/schema.ts`**

```ts
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/auth-schema";
import type { ItineraryDocument, StyleProfile, TripInputs, VisaItem } from "@/domain/types";

export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  inputs: jsonb("inputs").$type<TripInputs>().notNull(),
  styleProfile: jsonb("style_profile").$type<StyleProfile>().notNull(),
  visaChecklist: jsonb("visa_checklist").$type<VisaItem[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const itineraries = pgTable("itineraries", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  document: jsonb("document").$type<ItineraryDocument>().notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Wire the app schema into the client and drizzle config**

In `src/db/client.ts`, add the import and spread:
```ts
import * as appSchema from "@/db/schema";
// ...
export const db = drizzle(client, { schema: { ...authSchema, ...appSchema } });
```

In `drizzle.config.ts`, extend the schema array:
```ts
  schema: ["./src/db/auth-schema.ts", "./src/db/schema.ts"],
```

Then push:
```bash
npm run db:push   # creates trips + itineraries tables
```

- [ ] **Step 3: Implement `src/db/trips-repo.ts`**

```ts
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { itineraries, trips } from "@/db/schema";
import { buildSampleTripState } from "@/domain/sample-itinerary";
import { rebuildDayEdges } from "@/domain/transit";
import {
  ItineraryDocumentSchema,
  StyleProfileSchema,
  type ItineraryDocument,
  type TripInputs,
  TripInputsSchema,
  type TripMeta,
  type TripState,
} from "@/domain/types";

export class ConflictError extends Error {
  constructor(public currentVersion: number) {
    super("version conflict");
    this.name = "ConflictError";
  }
}

export async function createTripFromSample(userId: string) {
  const sample = buildSampleTripState();
  const tripId = randomUUID();
  const itineraryId = randomUUID();
  const document = rebuildDayEdges({ ...sample.document, id: itineraryId });

  await db.insert(trips).values({
    id: tripId,
    userId,
    title: sample.trip.title,
    inputs: sample.trip.inputs,
    styleProfile: sample.trip.styleProfile,
    visaChecklist: sample.trip.visaChecklist ?? null,
  });
  await db.insert(itineraries).values({ id: itineraryId, tripId, document, version: 1 });
  return { tripId, itineraryId };
}

export async function listTrips(userId: string) {
  const rows = await db.select().from(trips).where(eq(trips.userId, userId));
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    updatedAt: t.updatedAt,
    destinations: (t.inputs as TripInputs).destinations,
  }));
}

export async function loadTripState(tripId: string, userId: string) {
  const trip = (await db.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId))))[0];
  if (!trip) return null;
  const itin = (await db.select().from(itineraries).where(eq(itineraries.tripId, tripId)))[0];
  if (!itin) return null;

  const tripState: TripState = {
    trip: {
      id: trip.id,
      title: trip.title,
      inputs: TripInputsSchema.parse(trip.inputs),
      styleProfile: StyleProfileSchema.parse(trip.styleProfile),
      visaChecklist: trip.visaChecklist ?? undefined,
    },
    document: ItineraryDocumentSchema.parse(itin.document),
  };
  return { tripState, itineraryId: itin.id, version: itin.version };
}

export async function saveItinerary(
  itineraryId: string,
  userId: string,
  document: ItineraryDocument,
  expectedVersion: number,
): Promise<{ version: number }> {
  // Ownership check via join to trips.
  const owned = (
    await db
      .select({ id: itineraries.id, version: itineraries.version })
      .from(itineraries)
      .innerJoin(trips, eq(itineraries.tripId, trips.id))
      .where(and(eq(itineraries.id, itineraryId), eq(trips.userId, userId)))
  )[0];
  if (!owned) throw new Error("itinerary not found");
  if (owned.version !== expectedVersion) throw new ConflictError(owned.version);

  const nextVersion = expectedVersion + 1;
  await db
    .update(itineraries)
    .set({ document, version: nextVersion, updatedAt: new Date() })
    .where(and(eq(itineraries.id, itineraryId), eq(itineraries.version, expectedVersion)));
  return { version: nextVersion };
}

export async function saveTripMeta(tripId: string, userId: string, trip: TripMeta) {
  await db
    .update(trips)
    .set({ title: trip.title, inputs: trip.inputs, styleProfile: trip.styleProfile, updatedAt: new Date() })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}
```

- [ ] **Step 4: Write the integration test**

`tests/integration/trips-repo.test.ts`:
```ts
// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  createTripFromSample,
  listTrips,
  loadTripState,
  saveItinerary,
} from "@/db/trips-repo";

const userId = randomUUID();

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Test",
    email: `${userId}@test.dev`,
    emailVerified: true,
  });
});
afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
});

describe("trips-repo", () => {
  it("creates, lists, loads, saves with optimistic locking", async () => {
    const { tripId, itineraryId } = await createTripFromSample(userId);

    const list = await listTrips(userId);
    expect(list.some((t) => t.id === tripId)).toBe(true);

    const loaded = await loadTripState(tripId, userId);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.tripState.document.nodes).toHaveLength(14);

    const saved = await saveItinerary(itineraryId, userId, loaded!.tripState.document, 1);
    expect(saved.version).toBe(2);

    await expect(saveItinerary(itineraryId, userId, loaded!.tripState.document, 1)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("returns null for another user's trip", async () => {
    const { tripId } = await createTripFromSample(userId);
    expect(await loadTripState(tripId, randomUUID())).toBeNull();
  });
});
```

- [ ] **Step 5: Run + typecheck**

Run: `npm test -- integration/trips-repo` then `npx tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/trips-repo.ts src/db/client.ts drizzle.config.ts tests/integration/trips-repo.test.ts
git commit -m "feat: trips/itineraries tables and persistence repo with optimistic locking

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Auth & persistence UI wiring

**Files:**
- Create: `src/lib/session.ts`, `src/lib/use-autosave.ts`, `src/app/login/page.tsx`, `src/app/trips/page.tsx`, `src/components/CreateSampleButton.tsx`, `src/components/SignOutButton.tsx`, `src/app/trips/[id]/page.tsx`, `src/components/TripPageClient.tsx`, `src/app/api/trips/route.ts`, `src/app/api/trips/[id]/route.ts`
- Modify: `src/app/page.tsx` (redirect based on session)
- Test: `tests/e2e/persistence.spec.ts`

**Interfaces:**
- Consumes: `auth`/`getSession`, `authClient` (Task 13); repo functions + `ConflictError` (Task 14); `ItineraryDocumentSchema` (Task 2); `useTripStore` (Task 8); `TripEditor` (Task 12).
- Produces: sign-up/sign-in at `/login`; `/trips` list (protected) with create-sample + sign-out; `/trips/[id]` editor (protected) that loads from DB and autosaves (2 s debounce, optimistic-version, 409 → reload banner); `POST /api/trips` (create sample) and `PUT /api/trips/[id]` (save document).
- Phase 1 note: autosave persists the **document only**. `updateStyleProfile`/`updateTripInputs` commands exist and are tested but have no Phase 1 UI trigger yet (they're consumed by Phase 3's style-profile editor), so trip-meta autosave is deferred.

- [ ] **Step 1: Session helper + home redirect**

`src/lib/session.ts`:
```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/trips" : "/login");
}
```

- [ ] **Step 2: Login page**

`src/app/login/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res =
      mode === "up"
        ? await signUp.email({ email, password, name: name || email })
        : await signIn.email({ email, password });
    if (res.error) setError(res.error.message ?? "Something went wrong");
    else router.push("/trips");
  };

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 px-4">
      <h1 className="text-2xl font-semibold">Voyagr</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && (
          <label className="block space-y-1">
            <span className="text-sm text-slate-500">Name</span>
            <input className="w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-sm text-slate-500">Email</span>
          <input type="email" className="w-full rounded border px-2 py-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-slate-500">Password</span>
          <input type="password" className="w-full rounded border px-2 py-1" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white">
          {mode === "up" ? "Sign up" : "Sign in"}
        </button>
      </form>
      <button type="button" className="text-sm text-blue-600" onClick={() => setMode(mode === "up" ? "in" : "up")}>
        {mode === "up" ? "Have an account? Sign in" : "New here? Sign up"}
      </button>
    </main>
  );
}
```

- [ ] **Step 3: API routes**

`src/app/api/trips/route.ts`:
```ts
import { createTripFromSample } from "@/db/trips-repo";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { tripId } = await createTripFromSample(session.user.id);
  return Response.json({ tripId });
}
```

`src/app/api/trips/[id]/route.ts`:
```ts
import { ConflictError, saveItinerary } from "@/db/trips-repo";
import { ItineraryDocumentSchema } from "@/domain/types";
import { getSession } from "@/lib/session";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const document = ItineraryDocumentSchema.parse(body.document);
  const expectedVersion = Number(body.expectedVersion);
  try {
    const { version } = await saveItinerary(id, session.user.id, document, expectedVersion);
    return Response.json({ version });
  } catch (e) {
    if (e instanceof ConflictError) {
      return Response.json({ error: "conflict", currentVersion: e.currentVersion }, { status: 409 });
    }
    throw e;
  }
}
```

- [ ] **Step 4: Trips list page + buttons**

`src/components/SignOutButton.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-slate-500"
      onClick={async () => { await signOut(); router.push("/login"); }}
    >
      Sign out
    </button>
  );
}
```

`src/components/CreateSampleButton.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateSampleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/trips", { method: "POST" });
        const { tripId } = await res.json();
        router.push(`/trips/${tripId}`);
      }}
    >
      Create sample trip
    </button>
  );
}
```

`src/app/trips/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listTrips } from "@/db/trips-repo";
import { CreateSampleButton } from "@/components/CreateSampleButton";
import { SignOutButton } from "@/components/SignOutButton";
import { getSession } from "@/lib/session";

export default async function TripsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const trips = await listTrips(session.user.id);

  return (
    <main className="mx-auto mt-12 max-w-2xl space-y-6 px-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold">Your trips</h1>
        <div className="ml-auto flex items-center gap-4">
          <CreateSampleButton />
          <SignOutButton />
        </div>
      </div>
      {trips.length === 0 ? (
        <p className="text-slate-500">No trips yet — create a sample to explore the canvas.</p>
      ) : (
        <ul className="divide-y rounded border">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`} className="block px-4 py-3 hover:bg-slate-50">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-slate-500">{t.destinations.join(" · ")}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Autosave hook + editor route**

`src/lib/use-autosave.ts`:
```ts
"use client";
import { useEffect, useRef, useState } from "react";
import { useTripStore } from "@/store/trip-store";

export function useAutosave(itineraryId: string, initialVersion: number) {
  const versionRef = useRef(initialVersion);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useTripStore.subscribe((s) => {
      if (!s.dirty || conflict) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const st = useTripStore.getState();
        const res = await fetch(`/api/trips/${itineraryId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ document: st.state.document, expectedVersion: versionRef.current }),
        });
        if (res.status === 409) {
          setConflict(true);
          return;
        }
        if (res.ok) {
          const { version } = (await res.json()) as { version: number };
          versionRef.current = version;
          useTripStore.getState().markSaved();
        }
      }, 2000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [itineraryId, conflict]);

  return { conflict };
}
```

`src/components/TripPageClient.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import { TripEditor } from "@/components/TripEditor";
import type { TripState } from "@/domain/types";
import { useAutosave } from "@/lib/use-autosave";
import { useTripStore } from "@/store/trip-store";

export function TripPageClient({
  tripState,
  itineraryId,
  version,
}: {
  tripState: TripState;
  itineraryId: string;
  version: number;
}) {
  useEffect(() => {
    useTripStore.getState().loadTripState(tripState);
  }, [tripState]);
  const { conflict } = useAutosave(itineraryId, version);

  return (
    <>
      {conflict && (
        <div className="bg-red-600 px-4 py-2 text-sm text-white">
          This trip changed in another tab.{" "}
          <button type="button" className="underline" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <TripEditor />
    </>
  );
}
```

`src/app/trips/[id]/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { loadTripState } from "@/db/trips-repo";
import { TripPageClient } from "@/components/TripPageClient";
import { getSession } from "@/lib/session";

export default async function TripEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const loaded = await loadTripState(id, session.user.id);
  if (!loaded) notFound();
  return (
    <TripPageClient
      tripState={loaded.tripState}
      itineraryId={loaded.itineraryId}
      version={loaded.version}
    />
  );
}
```

- [ ] **Step 6: End-to-end persistence test**

`tests/e2e/persistence.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("sign up, create sample, edit, reload persists", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.dev`;
  await page.goto("/login");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL("**/trips");
  await page.getByRole("button", { name: /create sample trip/i }).click();
  await page.waitForURL(/\/trips\/.+/);

  const node = page.getByText("Colosseum & Roman Forum");
  await expect(node).toBeVisible();
  await node.click();
  await page.getByLabel("Name").fill("Persisted Colosseum");
  await expect(page.getByText("Persisted Colosseum")).toBeVisible();

  await page.waitForTimeout(3000); // let the 2s autosave debounce flush
  await page.reload();
  await expect(page.getByText("Persisted Colosseum")).toBeVisible();
});
```

- [ ] **Step 7: Run the full suite + typecheck + lint**

```bash
docker compose up -d db && npm run db:push
npx tsc --noEmit && npm run lint && npm test && npm run test:e2e
```
Expected: type-clean, lint-clean, all unit + integration + E2E green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/session.ts src/lib/use-autosave.ts src/app/login src/app/trips src/app/page.tsx src/components/CreateSampleButton.tsx src/components/SignOutButton.tsx src/components/TripPageClient.tsx src/app/api/trips tests/e2e/persistence.spec.ts
git commit -m "feat: auth + persistence UI (login, trip list, editor route, autosave)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 Definition of Done

- `npm test` (unit + component + integration) and `npm run test:e2e` all green.
- `npx tsc --noEmit` and `npm run lint` clean.
- A new user can: sign up → create the sample trip → see the Rome→Florence graph on the canvas with day groups, transit edges, and a live budget bar → select and edit a node → swap an alternative → lock/delete nodes → undo/redo → drag nodes → and have every change persist across reload.
- Pure domain logic (`src/domain/**`) has no React/Next/DB imports and is exhaustively unit-tested (types, budget, transit, commands round-trips, store undo/redo, layout).

## What Phase 1 deliberately excludes (later plans)

- **Phase 2:** wizard + AI generation pipeline (Scaffold→Fill→Ground→Assemble), Google Places grounding, Trigger.dev jobs, SSE streaming, `variant_previews`/`jobs`/`cached_places` tables, dagre auto-layout on generation.
- **Phase 3:** edit classification, dependency analysis, scoped recompute, ghost-diff proposals, `acceptProposal`/`rejectProposal` commands, Ask-AI entry points, style-profile editor UI (which will finally exercise `updateStyleProfile`/`updateTripInputs`).
- **Phase 4:** Timeline / Map / Split views, share links, mobile read view.
- **Phase 5:** usage metering enforcement, Stripe, affiliate wiring, eval harness, landing page.
