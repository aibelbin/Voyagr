# Voyagr AI Trip Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A traveller fills in a five-field form and gets three complete itineraries drawn as parallel branches on one canvas, ready to compare, keep and edit.

**Architecture:** The form's answers pick a candidate pool of *real* places from the connector layer, then one model call selects and sequences them into three combinations — choosing **by provider id**, never by writing a place name, so a hallucinated hotel is structurally impossible. A pure materialiser turns the result into n8n workflow JSON: one Start Trip node fanning out to three branches.

**Tech Stack:** TypeScript, the `openai` SDK pointed at Groq's OpenAI-compatible endpoint, strict JSON-schema structured outputs, `@n8n/decorators` REST controllers, `@n8n/di`, Vue 3, Vitest.

Spec: `docs/superpowers/specs/2026-08-15-voyagr-ai-trip-generator-design.md`
**Prerequisite:** `docs/superpowers/plans/2026-08-15-voyagr-place-connectors.md` must be complete — this plan consumes its provider layer, its config class, and its node parameters.
Project background: `docs/VOYAGR.md`

---

## Global Constraints

**Read these before any task. They apply to every task in this plan.**

- **What this repo is:** Voyagr is a travel itinerary planner built as a fork of the n8n monorepo. The repo IS the n8n monorepo, rebranded. An "itinerary" is an n8n workflow; canvas nodes are travel steps.
- **Voyagr is a consumer product.** Users never see or enter an API key. All keys are operator-owned environment variables. No credentials UI, no developer-facing concepts in the interface.
- Always use `pnpm`. **Never run a bare `pnpm install`** — it has corrupted `package.json` files in this repo. `CI=1` is required on any install or build. To add a dependency, edit `package.json` and run `CI=1 pnpm install --no-frozen-lockfile` from the repo root, then `git diff` the lockfile to confirm only the intended package changed.
- Never use the `any` type; avoid `as` casting outside test code.
- All user-facing text goes through `@n8n/i18n`. After editing `en.json`, run `pnpm --filter @n8n/i18n build`.
- After adding an exported type to `packages/@n8n/api-types`, run `pnpm --filter @n8n/api-types build`.
- Frontend: CSS variables never hardcoded px; reuse `@n8n/design-system`; icons from `updatedIconSet`; single-value `data-test-id`. **Invoke the `n8n:design-system` skill before writing any Vue or SCSS.**
- `packages/frontend/editor-ui/src/features/shared/nodeCreator/views/viewsData.ts` has ~34 **pre-existing** typecheck/lint errors. Out of scope.
- Node 26's native `globalThis.localStorage` shadows jsdom's. editor-ui tests touching it need `NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"`.
- **Model is `openai/gpt-oss-120b`, served by Groq's free tier** via the OpenAI-compatible endpoint `https://api.groq.com/openai/v1`. Do not substitute a different model without checking the constraints below — this choice is load-bearing:
  - Groq supports `response_format: { type: 'json_schema', ..., strict: true }` **only** on the `gpt-oss` family. Every other Groq model (Llama, Qwen, etc.) is loose `json_object` mode or nothing, which would let the model invent a place name instead of returning a provider id. Strict mode is the mechanism that makes hallucination structurally impossible here, so it is not optional.
  - Strict mode requires: `additionalProperties: false` on **every** object, and **every** property listed in `required`. Optional fields must be modelled as a `["type", "null"]` union, not omitted. A schema that violates this is rejected by the API.
  - Free-tier limits are **30 requests/min and 8,000 tokens/min**. That token ceiling is tight and shapes the design: keep the candidate pool prompt lean (id, name, kind, rating, price tier only — no blurbs, no URLs) and keep `max_tokens` modest. One generation must fit inside 8k tokens in and out combined.
  - Structured outputs cannot be combined with streaming or tool use on Groq. This plan uses neither.
- **Fallback model** if `openai/gpt-oss-120b` proves unreliable or rate-limited: `openai/gpt-oss-20b`. Same 131k context, same strict-schema guarantee, same free-tier limits — smaller and faster, likely weaker at multi-day sequencing.
- **Never make a live API call in a test.** The one model-facing test uses a stubbed response.
- **Testing is deliberately minimal by explicit instruction.** Two small unit-test files in this whole plan, and one visual verification at the very end.

### Node facts this plan depends on

Verified in the codebase — use these exact values:

| Place kind | Node type | Name parameter | Location parameter |
|---|---|---|---|
| `hotel` | `n8n-nodes-base.hotel` | `hotelName` | `location` |
| `restaurant` | `n8n-nodes-base.restaurant` | `restaurantName` | `location` |
| `cafe` | `n8n-nodes-base.cafe` | `name` | `location` |
| `attraction` | `n8n-nodes-base.touristDestination` | `placeName` | `location` |
| `activity` | `n8n-nodes-base.activity` | `name` | `location` |
| `shopping` | `n8n-nodes-base.shopping` | `name` | `location` |

Every one of the six also has hidden `placeId`, `rating`, `priceTier`, `photoUrl` parameters (added by the prerequisite plan). The trigger is `n8n-nodes-base.tripStart` with `startLocation`, `destination`, `startDate`, `endDate`, `budget`, `currency`.

## Parallel execution

| Group | Tasks | Depends on |
|---|---|---|
| A | Task 1 (types + config) **and** Task 2 (materialiser) | — |
| B | Task 3 (candidate pool) **and** Task 5 (form UI) | Group A |
| C | Task 4 (model call + endpoint) | Tasks 1–3 |
| D | Task 6 (verification) | everything |

Task 2 is a pure function with no imports from Tasks 1 or 3 beyond shared types, so it can start immediately. Task 5 is written against the endpoint contract in Task 4's **Interfaces** block.

---

### Task 1: Types and config

**Files:**
- Create: `packages/@n8n/api-types/src/trip-generation.ts`
- Modify: `packages/@n8n/api-types/src/index.ts`
- Modify: `packages/@n8n/config/src/configs/voyagr.config.ts`

**Interfaces:**
- Consumes: `PlaceKind` from `@n8n/api-types` (prerequisite plan).
- Produces: `TripTastes`, `TripGenerationRequest`, `GeneratedStop`, `GeneratedTripOption` exported from `@n8n/api-types`; `globalConfig.voyagr.groqKey`.

- [ ] **Step 1: Add the shared types**

Create `packages/@n8n/api-types/src/trip-generation.ts`:

```ts
import type { PlaceKind } from './places';

/**
 * Where the traveller sits on each slider, 0-100.
 *
 * `pace`: 0 is chill, 100 is active.
 * `terrain`: 0 is mountain, 100 is beach.
 */
export type TripTastes = {
	pace: number;
	terrain: number;
};

/** Everything the five-field form collects. */
export type TripGenerationRequest = {
	destination: string;
	startLocation: string;
	startDate: string;
	endDate: string;
	budget: number;
	currency: string;
	tastes: TripTastes;
};

export type GeneratedStop = {
	/** Must match a place from the candidate pool. */
	providerId: string;
	kind: PlaceKind;
	/** Days after the trip starts, 0-based. */
	dayOffset: number;
};

export type GeneratedTripOption = {
	name: string;
	rationale: string;
	stops: GeneratedStop[];
};
```

- [ ] **Step 2: Export them**

In `packages/@n8n/api-types/src/index.ts`, add directly below the existing `export type * from './places';`:

```ts
export type * from './trip-generation';
```

- [ ] **Step 3: Add the key to the Voyagr config**

In `packages/@n8n/config/src/configs/voyagr.config.ts`, add a second property to the existing `VoyagrConfig` class:

```ts
	/**
	 * Groq API key used to generate trip itineraries. Operator-owned —
	 * Voyagr users never see or enter it. Generation is disabled gracefully
	 * when this is empty.
	 */
	@Env('VOYAGR_GROQ_KEY')
	groqKey: string = '';
```

- [ ] **Step 4: Confirm the SDK is already available — do NOT install anything**

`packages/cli/package.json` **already** declares both dependencies this plan needs:

- `"openai": "catalog:"` — the client, pointed at Groq's OpenAI-compatible endpoint
- `"zod-to-json-schema": "catalog:"` — to derive the strict JSON schema from the zod schema

So there is **no dependency to add and no install to run.** Do not run `pnpm install` in any form — a bare install has corrupted `package.json` files in this repo before, and this plan no longer needs one.

Confirm both are present and note the resolved versions in your report:

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
grep -nE '"(openai|zod-to-json-schema)"' packages/cli/package.json
node -e "console.log('openai', require('openai/package.json').version)" 2>/dev/null || true
```

If either is somehow missing, STOP and report it rather than installing — that would mean the tree diverged from what this plan was written against.

- [ ] **Step 5: Build and typecheck**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
pnpm --filter @n8n/api-types build && pnpm --filter @n8n/config build
cd packages/cli && pnpm typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/@n8n/api-types/src/trip-generation.ts packages/@n8n/api-types/src/index.ts \
  packages/@n8n/config/src/configs/voyagr.config.ts
git commit -m "feat(voyagr): trip generation types and generator key config"
```

---

### Task 2: The materialiser

**Files:**
- Create: `packages/cli/src/voyagr/generator/build-trip-workflow.ts`
- Test: `packages/cli/src/voyagr/generator/__tests__/build-trip-workflow.test.ts`

**Interfaces:**
- Consumes: `PlaceResult`, `PlaceKind`, `GeneratedTripOption` from `@n8n/api-types`.
- Produces:

  ```ts
  buildTripWorkflow(
    params: TripWorkflowParams,
    options: GeneratedTripOption[],
    placesById: Map<string, PlaceResult>,
  ): { nodes: INode[]; connections: IConnections }
  ```

  where `TripWorkflowParams = { startLocation, destination, startDate, endDate, budget, currency }`.

This is the one piece worth testing properly: pure, deterministic, params in and graph out, no I/O.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/voyagr/generator/__tests__/build-trip-workflow.test.ts`:

```ts
import type { GeneratedTripOption, PlaceResult } from '@n8n/api-types';

import { buildTripWorkflow } from '../build-trip-workflow';

const params = {
	startLocation: 'Home',
	destination: 'Kyoto',
	startDate: '2026-09-12T09:00:00',
	endDate: '2026-09-19T09:00:00',
	budget: 3000,
	currency: 'USD',
};

const place = (providerId: string, name: string): PlaceResult => ({
	providerId,
	name,
	address: `${name} Street`,
	lat: 35,
	lon: 135,
	rating: 4.4,
	priceTier: 2,
	photoUrl: `https://example.test/${providerId}.jpg`,
});

const placesById = new Map<string, PlaceResult>([
	['fsq:1', place('fsq:1', 'Granbell')],
	['fsq:2', place('fsq:2', 'Ramen Sen')],
	['fsq:3', place('fsq:3', 'Kanra')],
]);

const options: GeneratedTripOption[] = [
	{
		name: 'Eastern temples',
		rationale: 'Quiet mornings in Gion.',
		stops: [
			{ providerId: 'fsq:1', kind: 'hotel', dayOffset: 0 },
			{ providerId: 'fsq:2', kind: 'restaurant', dayOffset: 1 },
		],
	},
	{
		name: 'Downtown',
		rationale: 'Central and walkable.',
		stops: [{ providerId: 'fsq:3', kind: 'hotel', dayOffset: 0 }],
	},
];

describe('buildTripWorkflow', () => {
	it('creates one trigger plus every stop', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);

		expect(nodes).toHaveLength(4);
		expect(nodes[0].type).toBe('n8n-nodes-base.tripStart');
	});

	it('puts the form values on the trigger', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);

		expect(nodes[0].parameters).toMatchObject({
			startLocation: 'Home',
			destination: 'Kyoto',
			budget: 3000,
			currency: 'USD',
		});
	});

	it('fans the trigger out to the first stop of every branch', () => {
		const { connections } = buildTripWorkflow(params, options, placesById);

		expect(connections['Start Trip'].main[0]).toEqual([
			{ node: 'Granbell', type: 'main', index: 0 },
			{ node: 'Kanra', type: 'main', index: 0 },
		]);
	});

	it('chains stops within a branch and stops at the end', () => {
		const { connections } = buildTripWorkflow(params, options, placesById);

		expect(connections.Granbell.main[0]).toEqual([{ node: 'Ramen Sen', type: 'main', index: 0 }]);
		expect(connections['Ramen Sen']).toBeUndefined();
	});

	it('writes the place details into each stop node', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);
		const hotel = nodes.find((node) => node.name === 'Granbell');

		expect(hotel?.type).toBe('n8n-nodes-base.hotel');
		expect(hotel?.parameters).toMatchObject({
			hotelName: 'Granbell',
			location: 'Granbell Street',
			placeId: 'fsq:1',
			rating: 4.4,
			priceTier: 2,
			photoUrl: 'https://example.test/fsq:1.jpg',
		});
	});

	it('lays branches out on separate rows', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);
		const first = nodes.find((node) => node.name === 'Granbell');
		const second = nodes.find((node) => node.name === 'Kanra');

		expect(first?.position[1]).not.toBe(second?.position[1]);
	});

	it('drops a stop whose place is not in the pool', () => {
		const withGhost: GeneratedTripOption[] = [
			{
				name: 'Ghost',
				rationale: 'References a place we never fetched.',
				stops: [{ providerId: 'fsq:999', kind: 'hotel', dayOffset: 0 }],
			},
		];

		const { nodes } = buildTripWorkflow(params, withGhost, placesById);

		expect(nodes).toHaveLength(1);
	});

	it('gives duplicate place names distinct node names', () => {
		const twice: GeneratedTripOption[] = [
			{
				name: 'Repeat',
				rationale: 'Same place twice.',
				stops: [
					{ providerId: 'fsq:1', kind: 'hotel', dayOffset: 0 },
					{ providerId: 'fsq:1', kind: 'hotel', dayOffset: 2 },
				],
			},
		];

		const { nodes } = buildTripWorkflow(params, twice, placesById);
		const names = nodes.map((node) => node.name);

		expect(new Set(names).size).toBe(names.length);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli
pnpm test src/voyagr/generator/__tests__/build-trip-workflow.test.ts
```

Expected: FAIL — cannot resolve `../build-trip-workflow`.

- [ ] **Step 3: Implement the materialiser**

Create `packages/cli/src/voyagr/generator/build-trip-workflow.ts`:

```ts
import type { GeneratedTripOption, PlaceKind, PlaceResult } from '@n8n/api-types';
import type { IConnections, INode } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export type TripWorkflowParams = {
	startLocation: string;
	destination: string;
	startDate: string;
	endDate: string;
	budget: number;
	currency: string;
};

const TRIGGER_NAME = 'Start Trip';

const KIND_TO_NODE_TYPE: Record<PlaceKind, string> = {
	hotel: 'n8n-nodes-base.hotel',
	restaurant: 'n8n-nodes-base.restaurant',
	cafe: 'n8n-nodes-base.cafe',
	attraction: 'n8n-nodes-base.touristDestination',
	activity: 'n8n-nodes-base.activity',
	shopping: 'n8n-nodes-base.shopping',
};

/** Each node type names its headline field differently. */
const KIND_TO_NAME_PARAM: Record<PlaceKind, string> = {
	hotel: 'hotelName',
	restaurant: 'restaurantName',
	cafe: 'name',
	attraction: 'placeName',
	activity: 'name',
	shopping: 'name',
};

const STOP_SPACING = 250;
const BRANCH_SPACING = 220;

/**
 * Turns generated options into a canvas: one trigger fanning out to one branch
 * per option, so a traveller can compare them side by side, keep the one they
 * like, and splice pieces between them.
 *
 * Pure and deterministic — no clock, no randomness, no I/O.
 */
export function buildTripWorkflow(
	params: TripWorkflowParams,
	options: GeneratedTripOption[],
	placesById: Map<string, PlaceResult>,
): { nodes: INode[]; connections: IConnections } {
	const trigger: INode = {
		id: 'trip-start',
		name: TRIGGER_NAME,
		type: 'n8n-nodes-base.tripStart',
		typeVersion: 1,
		position: [0, 0],
		parameters: {
			startLocation: params.startLocation,
			destination: params.destination,
			startDate: params.startDate,
			endDate: params.endDate,
			budget: params.budget,
			currency: params.currency,
		},
	};

	const nodes: INode[] = [trigger];
	const connections: IConnections = {};
	const branchHeads: string[] = [];
	const usedNames = new Set<string>([TRIGGER_NAME]);

	options.forEach((option, optionIndex) => {
		// Centre the branches vertically on the trigger.
		const y = (optionIndex - (options.length - 1) / 2) * BRANCH_SPACING;
		let previousName: string | undefined;
		let stopIndex = 0;

		for (const stop of option.stops) {
			const place = placesById.get(stop.providerId);

			// The model may only choose from the pool we supplied. Anything else
			// is dropped rather than drawn as a node we cannot vouch for.
			if (!place) continue;

			const name = uniqueName(place.name, usedNames);
			usedNames.add(name);

			nodes.push({
				id: `${optionIndex}-${stopIndex}`,
				name,
				type: KIND_TO_NODE_TYPE[stop.kind],
				typeVersion: 1,
				position: [(stopIndex + 1) * STOP_SPACING, y],
				parameters: {
					[KIND_TO_NAME_PARAM[stop.kind]]: place.name,
					location: place.address ?? '',
					placeId: place.providerId,
					rating: place.rating ?? 0,
					priceTier: place.priceTier ?? 0,
					photoUrl: place.photoUrl ?? '',
				},
			});

			if (previousName === undefined) {
				branchHeads.push(name);
			} else {
				connections[previousName] = {
					[NodeConnectionTypes.Main]: [
						[{ node: name, type: NodeConnectionTypes.Main, index: 0 }],
					],
				};
			}

			previousName = name;
			stopIndex += 1;
		}
	});

	if (branchHeads.length > 0) {
		connections[TRIGGER_NAME] = {
			[NodeConnectionTypes.Main]: [
				branchHeads.map((node) => ({ node, type: NodeConnectionTypes.Main, index: 0 })),
			],
		};
	}

	return { nodes, connections };
}

/** n8n requires node names to be unique within a workflow. */
function uniqueName(preferred: string, taken: Set<string>): string {
	if (!taken.has(preferred)) return preferred;

	let suffix = 1;
	while (taken.has(`${preferred} ${suffix}`)) suffix += 1;

	return `${preferred} ${suffix}`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli
pnpm test src/voyagr/generator/__tests__/build-trip-workflow.test.ts
```

Expected: 8 passing, output pristine.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/voyagr/generator
git commit -m "feat(voyagr): materialise generated options into a branching canvas"
```

---

### Task 3: Candidate pool

**Files:**
- Create: `packages/cli/src/voyagr/generator/candidate-pool.ts`
- Test: `packages/cli/src/voyagr/generator/__tests__/candidate-pool.test.ts`

**Interfaces:**
- Consumes: `PlacesService` from `packages/cli/src/voyagr/places/places.service.ts` (prerequisite plan) — `search(kind, near, query?): Promise<PlaceResult[]>`; `TripTastes`, `PlaceKind`, `PlaceResult` from `@n8n/api-types`.
- Produces:
  - `kindsForTastes(tastes: TripTastes): PlaceKind[]`
  - `terrainHint(tastes: TripTastes): string | undefined`
  - `class CandidatePoolBuilder` with `build(destination: string, tastes: TripTastes): Promise<PlaceResult[]>`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/voyagr/generator/__tests__/candidate-pool.test.ts`:

```ts
import { kindsForTastes, terrainHint } from '../candidate-pool';

describe('kindsForTastes', () => {
	it('always covers somewhere to sleep, eat and visit', () => {
		const kinds = kindsForTastes({ pace: 50, terrain: 50 });

		expect(kinds).toEqual(expect.arrayContaining(['hotel', 'restaurant', 'attraction']));
	});

	it('offers activities to an active traveller', () => {
		expect(kindsForTastes({ pace: 90, terrain: 50 })).toContain('activity');
	});

	it('offers cafes and shops to a relaxed traveller', () => {
		const kinds = kindsForTastes({ pace: 10, terrain: 50 });

		expect(kinds).toContain('cafe');
		expect(kinds).toContain('shopping');
	});
});

describe('terrainHint', () => {
	it('hints beach at the beach end', () => {
		expect(terrainHint({ pace: 50, terrain: 90 })).toBe('beach');
	});

	it('hints mountain at the mountain end', () => {
		expect(terrainHint({ pace: 50, terrain: 10 })).toBe('mountain');
	});

	it('hints nothing when the traveller has no strong preference', () => {
		expect(terrainHint({ pace: 50, terrain: 50 })).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli
pnpm test src/voyagr/generator/__tests__/candidate-pool.test.ts
```

Expected: FAIL — cannot resolve `../candidate-pool`.

- [ ] **Step 3: Implement it**

Create `packages/cli/src/voyagr/generator/candidate-pool.ts`:

```ts
import type { PlaceKind, PlaceResult, TripTastes } from '@n8n/api-types';
import { Service } from '@n8n/di';

import { PlacesService } from '../places/places.service';

/** Above this on the pace slider counts as an active traveller. */
const ACTIVE_THRESHOLD = 55;

/** How far from the middle a terrain preference must sit to count. */
const TERRAIN_MARGIN = 15;

/**
 * Which kinds of place to gather for this traveller.
 *
 * Everyone needs somewhere to sleep, eat and visit. Beyond that the pace slider
 * decides: an active traveller is offered things to do, a relaxed one is
 * offered places to linger.
 */
export function kindsForTastes(tastes: TripTastes): PlaceKind[] {
	const kinds: PlaceKind[] = ['hotel', 'restaurant', 'attraction'];

	if (tastes.pace >= ACTIVE_THRESHOLD) {
		kinds.push('activity');
	} else {
		kinds.push('cafe', 'shopping');
	}

	return kinds;
}

/**
 * A search hint drawn from the terrain slider, applied only to the kinds where
 * landscape actually changes the answer. Returns undefined near the middle,
 * where the traveller has expressed no real preference.
 */
export function terrainHint(tastes: TripTastes): string | undefined {
	if (tastes.terrain >= 50 + TERRAIN_MARGIN) return 'beach';
	if (tastes.terrain <= 50 - TERRAIN_MARGIN) return 'mountain';

	return undefined;
}

/** Kinds where the surrounding landscape changes which places are a good fit. */
const TERRAIN_SENSITIVE: PlaceKind[] = ['attraction', 'activity'];

@Service()
export class CandidatePoolBuilder {
	constructor(private readonly placesService: PlacesService) {}

	/** Real places for the model to choose from. Never invented, always fetched. */
	async build(destination: string, tastes: TripTastes): Promise<PlaceResult[]> {
		const hint = terrainHint(tastes);

		const perKind = await Promise.all(
			kindsForTastes(tastes).map(
				async (kind) =>
					await this.placesService.search(
						kind,
						destination,
						TERRAIN_SENSITIVE.includes(kind) ? hint : undefined,
					),
			),
		);

		const seen = new Set<string>();

		return perKind.flat().filter((place) => {
			if (seen.has(place.providerId)) return false;
			seen.add(place.providerId);
			return true;
		});
	}
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli
pnpm test src/voyagr/generator/__tests__/candidate-pool.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/voyagr/generator/candidate-pool.ts \
  packages/cli/src/voyagr/generator/__tests__/candidate-pool.test.ts
git commit -m "feat(voyagr): build a candidate place pool from trip tastes"
```

---

### Task 4: The model call and the endpoint

**Files:**
- Create: `packages/cli/src/voyagr/generator/trip-options.schema.ts`
- Create: `packages/cli/src/voyagr/generator/generator.service.ts`
- Create: `packages/cli/src/voyagr/generator/generator.controller.ts`
- Modify: `packages/cli/src/server.ts`

**Interfaces:**
- Consumes: `CandidatePoolBuilder` (Task 3), `buildTripWorkflow` (Task 2), `TripGenerationRequest`/`GeneratedTripOption` (Task 1), `globalConfig.voyagr.groqKey` (Task 1).
- Produces: the endpoint the form calls —

  ```
  POST /rest/voyagr/generate-trip
  body: TripGenerationRequest
  → { workflowId: string } on success
  → { workflowId: null } when generation is unavailable
  ```

  Always `200`. The form renders one quiet message on a `null`, never an error status.

- [ ] **Step 1: Write the output schema**

Create `packages/cli/src/voyagr/generator/trip-options.schema.ts`:

```ts
import { z } from 'zod';

/**
 * The shape the model must return.
 *
 * `providerId` is deliberately a plain string validated against the pool after
 * the fact rather than an enum: a pool of twenty ids would bloat the schema,
 * and anything unrecognised is dropped by the materialiser anyway.
 *
 * Deliberately free of `.min()` / `.max()` on the arrays. Groq's strict mode
 * accepts only a subset of JSON Schema — `minItems`/`maxItems` are not in it,
 * and a schema carrying them is rejected. Cardinality is enforced in the
 * service after parsing instead, where a violation can degrade quietly rather
 * than fail the request.
 */
export const tripOptionsSchema = z.object({
	options: z.array(
		z.object({
			name: z.string(),
			rationale: z.string(),
			stops: z.array(
				z.object({
					providerId: z.string(),
					kind: z.enum([
						'hotel',
						'restaurant',
						'cafe',
						'attraction',
						'activity',
						'shopping',
					]),
					dayOffset: z.number().int(),
				}),
			),
		}),
	),
});
```

**Strict-mode requirements — verify these on the schema you actually send.** Groq rejects a strict schema unless every object has `additionalProperties: false` and lists every one of its properties in `required`. `zod-to-json-schema` does not necessarily emit `additionalProperties: false` by default, so after converting, assert the emitted schema satisfies both rules and post-process it if it does not. Confirm the exact behaviour against the installed `zod-to-json-schema` rather than assuming — the library, not this plan, is authoritative. Report what you found and whether post-processing was needed.

- [ ] **Step 2: Write the generator service**

Create `packages/cli/src/voyagr/generator/generator.service.ts`:

```ts
import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
	GeneratedTripOption,
	PlaceResult,
	TripGenerationRequest,
} from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';

import { CandidatePoolBuilder } from './candidate-pool';
import { tripOptionsSchema } from './trip-options.schema';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const MODEL = 'openai/gpt-oss-120b';

/**
 * Groq's free tier allows 8,000 tokens per minute across input and output
 * combined, so this ceiling is a budget, not a safety margin. The output is a
 * compact list of ids rather than prose, which fits comfortably; the prompt is
 * kept lean for the same reason.
 */
const MAX_TOKENS = 4000;

/** Three is the product requirement; the model is asked for exactly this many. */
const OPTION_COUNT = 3;

/**
 * Derived once at module load — the schema never varies per request.
 *
 * `$refStrategy: 'none'` inlines everything: Groq's strict mode is happier with
 * a self-contained schema than with `$ref`/`$defs` indirection.
 */
const tripOptionsJsonSchema = zodToJsonSchema(tripOptionsSchema, {
	$refStrategy: 'none',
});

export type GenerationResult = {
	options: GeneratedTripOption[];
	placesById: Map<string, PlaceResult>;
};

@Service()
export class GeneratorService {
	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly pool: CandidatePoolBuilder,
		private readonly logger: Logger,
	) {}

	get isConfigured(): boolean {
		return this.globalConfig.voyagr.groqKey !== '';
	}

	/** Returns undefined whenever generation cannot run, for any reason. */
	async generate(request: TripGenerationRequest): Promise<GenerationResult | undefined> {
		if (!this.isConfigured) return undefined;

		const places = await this.pool.build(request.destination, request.tastes);
		if (places.length === 0) return undefined;

		const client = new OpenAI({
			apiKey: this.globalConfig.voyagr.groqKey,
			baseURL: GROQ_BASE_URL,
		});

		try {
			const response = await client.chat.completions.create({
				model: MODEL,
				max_tokens: MAX_TOKENS,
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'trip_options',
						// Constrained decoding: the model physically cannot emit a
						// token that breaks the schema, which is what guarantees a
						// provider id rather than an invented place name.
						strict: true,
						schema: tripOptionsJsonSchema,
					},
				},
				messages: [{ role: 'user', content: this.buildPrompt(request, places) }],
			});

			const choice = response.choices[0];

			// A declined request comes back 200 with a stop reason rather than an
			// error, so this has to be checked before touching the content.
			if (choice?.finish_reason === 'content_filter') {
				this.logger.warn('Trip generation was declined by the model');
				return undefined;
			}

			const content = choice?.message?.content;
			if (!content) return undefined;

			// Strict mode makes malformed JSON very unlikely, but the boundary is
			// still untrusted input: parse and validate rather than assume.
			const parsed = tripOptionsSchema.safeParse(JSON.parse(content));
			if (!parsed.success) {
				this.logger.warn('Trip generation returned an unusable shape', {
					error: parsed.error,
				});
				return undefined;
			}

			const options = parsed.data.options
				.filter((option) => option.stops.length > 0)
				.slice(0, OPTION_COUNT);

			if (options.length === 0) return undefined;

			return {
				options,
				placesById: new Map(places.map((place) => [place.providerId, place])),
			};
		} catch (error) {
			this.logger.warn('Trip generation failed', { error });
			return undefined;
		}
	}

	private buildPrompt(request: TripGenerationRequest, places: PlaceResult[]): string {
		const pool = places
			.map((place) => {
				const rating = place.rating === undefined ? '' : ` rating ${place.rating.toFixed(1)}/5`;
				const price = place.priceTier === undefined ? '' : ` price ${'$'.repeat(place.priceTier)}`;
				const area = place.address ? ` — ${place.address}` : '';

				return `- ${place.providerId} | ${place.name}${area}${rating}${price}`;
			})
			.join('\n');

		return [
			`Plan a trip to ${request.destination}, leaving from ${request.startLocation}.`,
			`Dates: ${request.startDate} to ${request.endDate}. Budget: ${request.budget} ${request.currency}.`,
			'',
			`The traveller's pace preference is ${request.tastes.pace}/100, where 0 is very relaxed and 100 is packed with activity.`,
			`Their landscape preference is ${request.tastes.terrain}/100, where 0 is mountains and 100 is beaches.`,
			'',
			'Here are the real places available. You may only choose from this list, by providerId:',
			pool,
			'',
			'Produce three itineraries. All three must suit the preferences above — they are not',
			'meant to be relaxed-versus-packed alternatives. What should differ between them is the',
			'combination of specific places: different hotels, different places to eat, different',
			'things to see. Give each option a short name and one line saying what makes it distinct.',
			'',
			'Order each option\'s stops in the order the traveller would visit them, and set dayOffset',
			'to the day of the trip each stop falls on, counting from 0. Never invent a place: every',
			'providerId must appear in the list above.',
		].join('\n');
	}
}
```

**Verify this against the installed libraries rather than trusting the code above.** Three things are most likely to differ:

1. `zodToJsonSchema`'s emitted output — confirm it produces `additionalProperties: false` on every object and every property in `required`. If it does not, post-process the schema so it does, and say so in your report. Log or dump the derived schema once while developing so you have actually seen it.
2. The `openai` SDK's typing of `response_format.json_schema` — `strict` and `schema` must typecheck; follow the SDK's own types if the field names differ.
3. `max_tokens` may be deprecated in favour of `max_completion_tokens` in the installed SDK major. Use whichever the SDK types accept.

The libraries, not this plan, are authoritative. Report any difference you find.

- [ ] **Step 3: Write the controller**

Create `packages/cli/src/voyagr/generator/generator.controller.ts`:

```ts
import type { TripGenerationRequest } from '@n8n/api-types';
import type { AuthenticatedRequest } from '@n8n/db';
import { Body, Post, RestController } from '@n8n/decorators';

import { WorkflowService } from '@/workflows/workflow.service';

import { buildTripWorkflow } from './build-trip-workflow';
import { GeneratorService } from './generator.service';

@RestController('/voyagr')
export class GeneratorController {
	constructor(
		private readonly generatorService: GeneratorService,
		private readonly workflowService: WorkflowService,
	) {}

	/**
	 * Generates three itineraries and saves them as one trip whose branches the
	 * traveller can compare and prune.
	 *
	 * Always answers 200. `workflowId: null` means generation could not run —
	 * no key, no places, a refusal, or a model error — and the form shows one
	 * quiet message rather than an error. Planning by hand never depends on this.
	 */
	@Post('/generate-trip')
	async generateTrip(
		req: AuthenticatedRequest,
		_res: unknown,
		@Body body: TripGenerationRequest,
	): Promise<{ workflowId: string | null }> {
		const result = await this.generatorService.generate(body);
		if (!result) return { workflowId: null };

		const { nodes, connections } = buildTripWorkflow(body, result.options, result.placesById);
		if (nodes.length <= 1) return { workflowId: null };

		const created = await this.workflowService.create(
			{ name: body.destination, nodes, connections },
			req.user,
		);

		return { workflowId: created.id };
	}
}
```

`WorkflowService`'s create method may take a different name or signature in this repo. Read `packages/cli/src/workflows/workflow.service.ts` and use whatever it actually exposes for creating a workflow on behalf of a user, adapting the call above. Report the signature you used.

- [ ] **Step 4: Register the controller**

In `packages/cli/src/server.ts`, add alongside the other side-effect controller imports:

```ts
import '@/voyagr/generator/generator.controller';
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli && pnpm typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/voyagr/generator packages/cli/src/server.ts
git commit -m "feat(voyagr): generate three itineraries from real places"
```

---

### Task 5: The form

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/generator/generator.api.ts`
- Create: `packages/frontend/editor-ui/src/features/voyagr/generator/components/PlanWithAiDialog.vue`
- Modify: `packages/frontend/editor-ui/src/app/views/WorkflowsView.vue`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: `TripGenerationRequest` from `@n8n/api-types` (Task 1); the endpoint contract in Task 4's Interfaces block.
- Produces: a **Plan with AI** entry point on My Trips that opens the form and, on success, navigates to the generated trip.

**Before starting:** invoke the `n8n:design-system` skill and read `packages/frontend/AGENTS.md`. Open `packages/frontend/editor-ui/src/features/core/auth/views/SignupView.vue` and `SetupView.vue` first — the form must look like it belongs to the same product as those, not like a settings page.

- [ ] **Step 1: Add the strings**

In `packages/frontend/@n8n/i18n/src/locales/en.json`, add next to the other `voyagr.*` keys:

```json
	"voyagr.generate.open": "Plan with AI",
	"voyagr.generate.title": "Where are you going?",
	"voyagr.generate.subtitle": "A few questions, then we'll draw you three trips to choose from.",
	"voyagr.generate.destination": "Where to?",
	"voyagr.generate.from": "Travelling from",
	"voyagr.generate.dates": "When?",
	"voyagr.generate.budget": "Budget",
	"voyagr.generate.pace": "How busy?",
	"voyagr.generate.pace.low": "Relaxed",
	"voyagr.generate.pace.high": "Packed",
	"voyagr.generate.terrain": "What draws you?",
	"voyagr.generate.terrain.low": "Mountains",
	"voyagr.generate.terrain.high": "Beaches",
	"voyagr.generate.submit": "Plan my trip",
	"voyagr.generate.working": "Planning your trip…",
	"voyagr.generate.unavailable": "AI planning isn't available right now. You can still plan a trip yourself.",
```

Then run `pnpm --filter @n8n/i18n build`.

- [ ] **Step 2: Write the API client**

Create `packages/frontend/editor-ui/src/features/voyagr/generator/generator.api.ts`:

```ts
import type { TripGenerationRequest } from '@n8n/api-types';
import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export async function generateTrip(
	context: IRestApiContext,
	request: TripGenerationRequest,
): Promise<{ workflowId: string | null }> {
	return await makeRestApiRequest<{ workflowId: string | null }>(
		context,
		'POST',
		'/voyagr/generate-trip',
		request,
	);
}
```

- [ ] **Step 3: Write the dialogue**

Create `packages/frontend/editor-ui/src/features/voyagr/generator/components/PlanWithAiDialog.vue`.

Five inputs and nothing more — destination, travelling from (default `Home`), a date range, budget with currency, and two sliders. Match `SignupView.vue`'s heading, spacing and field rhythm; use `N8nInput`, `N8nButton`, `N8nHeading`, `N8nText` from `@n8n/design-system` and the design system's slider component (find it in `packages/frontend/@n8n/design-system/src/components/` — report which you used).

Behaviour:

- Sliders are `0–100`, both defaulting to `50`, labelled at each end with the `.low`/`.high` strings above.
- Submit is disabled until destination and both dates are set.
- While in flight, show `voyagr.generate.working` and disable the form.
- On `{ workflowId }`, close and route to that workflow's canvas (`VIEWS.WORKFLOW` with `name: workflowId` — confirm the route param against `packages/frontend/editor-ui/src/app/constants.ts`).
- On `{ workflowId: null }` **or** any thrown error, show `voyagr.generate.unavailable` inline and leave the form open with its values intact. Never surface a raw error.

Build the request as:

```ts
const request: TripGenerationRequest = {
	destination: destination.value,
	startLocation: startLocation.value,
	startDate: startDate.value,
	endDate: endDate.value,
	budget: Number(budget.value),
	currency: currency.value,
	tastes: { pace: pace.value, terrain: terrain.value },
};
```

- [ ] **Step 4: Add the entry point**

In `packages/frontend/editor-ui/src/app/views/WorkflowsView.vue`, add a **Plan with AI** action beside the existing create-trip button, opening the dialogue. Follow whatever pattern that view already uses for its header actions rather than inventing a new one; report where you put it.

- [ ] **Step 5: Typecheck and lint**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/frontend/editor-ui
pnpm typecheck && pnpm lint
```

Expected: clean apart from the pre-existing `viewsData.ts` errors.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/generator \
  packages/frontend/editor-ui/src/app/views/WorkflowsView.vue \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): plan a trip with AI from a short form"
```

---

### Task 6: Build, verify, document

**Files:**
- Modify: `docs/VOYAGR.md`

This is the **single verification pass** for the whole plan.

- [ ] **Step 1: Build**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
CI=1 pnpm build:n8n > build.log 2>&1; echo "EXIT=$?"; tail -n 15 build.log
```

Expected: `EXIT=0`.

- [ ] **Step 2: Start the server**

```bash
lsof -ti:5678 | xargs -r kill
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
N8N_DIAGNOSTICS_ENABLED=false pnpm start > server.log 2>&1 &
```

Wait for `Editor is now accessible` in `server.log`.

- [ ] **Step 3: Verify in a browser**

Headless **system** Chrome (the bundled chromium is version-mismatched and will not launch):

```js
chromium.launch({ headless: true, channel: 'chrome' })
```

Work from `packages/testing/playwright`; keep scripts and screenshots out of the repo. Log in as `owner@voyagr.local` / `Voyagr1234`.

Report PASS/FAIL with what you saw:

1. **Plan with AI** appears on My Trips and opens a dialogue that looks like it belongs beside the signup screen — not a settings form.
2. The form has exactly five things to fill in and no more.
3. With no `VOYAGR_GROQ_KEY` set, submitting shows the quiet unavailable message and leaves the form usable — no error toast, no stack trace, no spinner stuck forever.
4. Nothing on My Trips or the canvas regressed.

If both `VOYAGR_GROQ_KEY` and `VOYAGR_PLACES_KEY` are available, set them, restart, and additionally confirm: submitting draws a canvas with one Start Trip node fanning out to three branches, every node is a real named place, and the branches are visually separated. Screenshot the canvas and read it back with the Read tool.

- [ ] **Step 4: Record it in the project notes**

Add to `docs/VOYAGR.md` section 2 ("What's done"):

```markdown
**AI trip generator:**
- "Plan with AI" on My Trips: five questions (destination, from, dates, budget,
  two taste sliders) produce three itineraries drawn as parallel branches from a
  single Start Trip node, to compare, prune and mix.
- The model chooses **by provider id from a pool of real places we fetched**, so
  it cannot invent a hotel. Anything unrecognised is dropped when the canvas is
  built (`packages/cli/src/voyagr/generator/build-trip-workflow.ts`).
- `openai/gpt-oss-120b` on Groq's free tier via the `openai` SDK, using strict
  JSON-schema structured outputs so the model can only ever return a provider
  id, never an invented place name. Key is
  `VOYAGR_GROQ_KEY` in deployment env, never shown to users.
```

Add to section 5 ("Gotchas"):

```markdown
- **Trip generation fails quietly by design.** No key, no candidate places, a
  model refusal, or an API error all return `{ workflowId: null }` and render one
  message. Check `stop_reason === 'refusal'` before reading model content — a
  refused request returns HTTP 200 with empty or partial content.
```

- [ ] **Step 5: Commit**

```bash
git add docs/VOYAGR.md
git commit -m "docs: record AI trip generator in project status"
```

---

## Notes for the implementer

- **The single most important property of this feature** is that the model picks from a fetched pool by id. If you find yourself letting it emit place names as free text, stop — that reintroduces exactly the hallucination the design exists to prevent.
- **Deliberate deviation from the spec:** the model call is non-streaming. The spec called for streaming, but the output is a compact list of ids well inside the non-streaming ceiling, and streaming would add machinery for no benefit. If output ever grows, revisit.
- **Out of scope, do not add:** real prices, availability, booking, flight or train search, per-node dates beyond `dayOffset`, learning from past trips, regenerating one branch, chat-based refinement.
