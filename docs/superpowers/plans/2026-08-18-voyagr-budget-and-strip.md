# Voyagr Budget, Photo Fixes and n8n Strip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make place photos load, show every stop's cost against the trip budget, and strip the n8n chrome Voyagr does not use.

**Architecture:** The budget is computed entirely in the browser from the workflow document — one pure cost function per node type, one pure graph walk to split the canvas into branches, and two small display components assembled from existing n8n design-system parts. The photo fix is one entry on an existing auth allowlist. The strip prefers gating over deleting wherever the gate already exists upstream, to keep future n8n merges clean.

**Tech Stack:** TypeScript, Vue 3 + `<script setup>`, Pinia, Vitest, `@n8n/design-system`, `@n8n/i18n`, n8n's `INodeType` node API.

Spec: `docs/superpowers/specs/2026-08-18-voyagr-budget-and-strip-design.md`

## Global Constraints

- **Package manager is pnpm.** Never run bare `pnpm install`; `CI=1` is required on any install or `build:n8n`.
- **Run tests from inside the package directory.** Use `pushd`/`popd`, not bare `cd`.
- **Never use `any`.** Use `unknown` plus narrowing. `as` is acceptable in test code only.
- **All user-facing text goes through `@n8n/i18n`** — add keys to `packages/frontend/@n8n/i18n/src/locales/en.json`.
- **After editing `en.json`, run `pnpm --filter @n8n/i18n build`** or `typecheck` will not see the new `BaseTextKey` values.
- **Use CSS variables, never hardcoded px.** Check token names against `@n8n/design-system/src/css/_primitives.scss` — an undefined variable fails silently (`--spacing--sm`, not `--spacing--s`).
- **Editor-ui tests on Node 26 need** `NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"`.
- **Available `N8nText` sizes:** `xsmall | small | mini | medium | large | xlarge`. **Colors:** `primary | secondary | text-dark | text-base | text-light | text-xlight | danger | success | warning | foreground-dark | foreground-xdark`.
- **Icon names** must come from `updatedIconSet` in `packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`.
- **`data-test-id`** (n8n's spelling, not `data-testid`) must be a single value.
- Commit after every task. Conventional-commit prefixes: `fix:`, `feat:`, `chore:`, `docs:`.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.ts` | Pure per-node cost formulas. No Vue, no stores. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.test.ts` | Cost formula tests. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/tripBudget.ts` | Pure graph walk: nodes + connections → branches, totals, per-node costs. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/tripBudget.test.ts` | Branch walk tests. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/useTripBudget.ts` | Thin reactive wrapper over `tripBudget.ts`. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/components/NodeBudgetChip.vue` | Per-node cost chip. |
| `packages/frontend/editor-ui/src/features/voyagr/budget/components/TripBudgetPill.vue` | Floating canvas budget pill. |
| `packages/frontend/editor-ui/src/features/voyagr/feedback/feedback.api.ts` | Feedback submit stub; endpoint intentionally blank. |
| `packages/frontend/editor-ui/src/features/voyagr/feedback/components/FeedbackModal.vue` | Feedback modal. |
| `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.test.ts` | Photo-failure fallback test. |
| `packages/nodes-base/nodes/Voyagr/__tests__/voyagr-nodes.test.ts` | Guards travellers field + per-person labels. |

**Modified**

| Path | Change |
|---|---|
| `packages/cli/src/auth/auth.service.ts` | One entry on `skipBrowserIdCheckEndpoints`. |
| `packages/cli/src/auth/__tests__/auth.service.test.ts` | `endpoints.rest` on the shared mock + two cases. |
| `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.vue` | Hide photo on load error. |
| `packages/frontend/editor-ui/src/features/voyagr/places/components/PlacesPanel.vue` | Opaque sticky header. |
| `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts` | `travellers` field + emit. |
| `packages/nodes-base/nodes/Voyagr/{Flight,Train,Bus,Ferry,Activity}/*.node.ts` | Label price per person. |
| `packages/@n8n/api-types/src/trip-generation.ts` | `travellers` on the request. |
| `packages/cli/src/voyagr/generator/trip-generation-request.dto.ts` | `travellers` on the DTO. |
| `packages/cli/src/voyagr/generator/build-trip-workflow.ts` | Thread `travellers` onto the trigger. |
| `packages/cli/src/voyagr/generator/__tests__/build-trip-workflow.test.ts` | Fixture + assertion. |
| `packages/frontend/editor-ui/src/features/voyagr/generator/components/PlanWithAiDialog.vue` | Travellers input. |
| `packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeDefault.vue` | Render the chip. |
| `packages/frontend/editor-ui/src/app/components/MainHeader/MainHeader.vue` | Drop tabs, host the pill. |
| `packages/@n8n/backend-common/src/modules/modules.config.ts` | Default-disable `insights`. |
| `packages/frontend/editor-ui/src/app/modules.manifest.ts` | Drop `InsightsModule`. |
| `packages/frontend/editor-ui/src/app/components/MainSidebar.vue` | Drop Help + What's New, add Feedback. |
| `packages/frontend/editor-ui/src/app/composables/useSettingsItems.ts` | Allowlist filter. |
| `packages/frontend/editor-ui/src/app/constants/modals.ts` | Feedback modal key. |
| `packages/frontend/editor-ui/src/app/stores/ui.store.ts` | Register the modal. |
| `packages/frontend/editor-ui/src/app/components/Modals.vue` | Mount the modal. |
| `packages/frontend/@n8n/i18n/src/locales/en.json` | New keys. |

---

## Task 1: Place photos load (the 401)

**Files:**
- Modify: `packages/cli/src/auth/auth.service.ts:99` (after the chat-attachments entry)
- Test: `packages/cli/src/auth/__tests__/auth.service.test.ts:33` and `:680`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

**Background.** `AuthService.validateBrowserId` throws `Unauthorized` when a JWT carries a `browserId` that the request does not repeat in a `browser-id` header. An `<img>` tag cannot set headers, so `/rest/voyagr/places/photo` 401s on every card. `getEndpoint()` returns `req.baseUrl + req.route.path`, and the skip check is `method === 'GET' && this.skipBrowserIdCheckEndpoints.includes(endpoint)` — an exact match, GET only.

- [ ] **Step 1: Give the test's config a real rest endpoint**

The shared `globalConfig` is a `mock<GlobalConfig>`, so `globalConfig.endpoints.rest` is an auto-mock value and the constructor builds nonsense paths. Add `endpoints` to the existing literal at `auth.service.test.ts:33`:

```ts
	const globalConfig = mock<GlobalConfig>({
		auth: { cookie: { secure: true, samesite: 'lax' } },
		userManagement: { jwtSecret: 'random-secret' },
		endpoints: { rest: 'rest' },
	});
```

- [ ] **Step 2: Write the failing tests**

Add both to the `describe('resolveJwt')` block, directly after the existing
`'should not skip browserId check for POST requests on skip endpoints'` test
(around line 697). They deliberately do **not** override
`skipBrowserIdCheckEndpoints`, so they exercise the real list:

```ts
		it('should skip browserId check for the place photo endpoint', async () => {
			userRepository.findOne.mockResolvedValue(user);
			const req = mock<AuthenticatedRequest>({
				browserId: 'another-browser',
				method: 'GET',
				baseUrl: '/rest',
				route: { path: '/voyagr/places/photo' },
			});

			// `<img src>` cannot carry the browser-id header, so this must pass.
			const result = await authService.resolveJwt(validToken, req, res);

			expect(result).toEqual([user, { usedMfa: false }]);
		});

		it('should not skip browserId check for the place search endpoint', async () => {
			userRepository.findOne.mockResolvedValue(user);
			const req = mock<AuthenticatedRequest>({
				browserId: 'another-browser',
				method: 'GET',
				baseUrl: '/rest',
				route: { path: '/voyagr/places' },
			});

			await expect(authService.resolveJwt(validToken, req, res)).rejects.toThrow('Unauthorized');
		});
```

- [ ] **Step 3: Run them and confirm the first fails**

```bash
pushd packages/cli && pnpm test src/auth/__tests__/auth.service.test.ts 2>&1 | tail -30; popd
```

Expected: `should skip browserId check for the place photo endpoint` FAILS with `Unauthorized`. The search-endpoint test already passes — it is the guard that proves the next step does not widen too far.

- [ ] **Step 4: Add the allowlist entry**

In `auth.service.ts`, immediately after the chat-attachments entry:

```ts
			// Suggestion cards load photos with `<img src>`, and an `<img>` tag cannot
			// carry the browser-id header. GET-only by the guard below, and an exact
			// path match — the search endpoint beside it keeps its check.
			`/${restEndpoint}/voyagr/places/photo`,
```

- [ ] **Step 5: Run the tests again**

```bash
pushd packages/cli && pnpm test src/auth/__tests__/auth.service.test.ts 2>&1 | tail -20; popd
```

Expected: PASS, whole file green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/auth/auth.service.ts packages/cli/src/auth/__tests__/auth.service.test.ts
git commit -m "fix(voyagr): let place photos load in the browser

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Card and panel rendering

**Files:**
- Modify: `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.vue:23`
- Modify: `packages/frontend/editor-ui/src/features/voyagr/places/components/PlacesPanel.vue` (template + styles)
- Test: `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `PlaceCard.test.ts`:

```ts
import type { PlaceResult } from '@n8n/api-types';

import { createComponentRenderer } from '@/__tests__/render';

import PlaceCard from './PlaceCard.vue';

const place: PlaceResult = {
	providerId: 'gpl:1',
	name: 'Hanging Restaurant & Bar',
	address: 'Sekumpul, Buleleng',
	lat: -8.2,
	lon: 115.1,
	rating: 4.3,
	ratingCount: 538,
	priceTier: 2,
	photoUrl: '/rest/voyagr/places/photo?name=places/a/photos/b',
};

const renderComponent = createComponentRenderer(PlaceCard);

describe('PlaceCard', () => {
	it('renders the photo when the place has one', () => {
		const { container } = renderComponent({ props: { place } });

		expect(container.querySelector('img')).not.toBeNull();
	});

	it('drops the photo when it fails to load, leaving a clean card', async () => {
		const { container, getByText } = renderComponent({ props: { place } });

		const image = container.querySelector('img');
		expect(image).not.toBeNull();

		image?.dispatchEvent(new Event('error'));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(container.querySelector('img')).toBeNull();
		// The rest of the card survives — only the decoration is gone.
		expect(getByText('Hanging Restaurant & Bar')).toBeVisible();
	});
});
```

- [ ] **Step 2: Run it and confirm the second test fails**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/places/components/PlaceCard.test.ts 2>&1 | tail -25; popd
```

Expected: first test PASSES, second FAILS — the `img` is still in the DOM.

- [ ] **Step 3: Hide the photo on error**

In `PlaceCard.vue`, add to the `<script setup>` block after the `priceTier` computed:

```ts
// A miss on the photo proxy (spent quota, a dead link) would otherwise leave the
// browser's broken-image glyph on the card. A card with no photo reads better.
const photoFailed = ref(false);

watch(
	() => props.place.photoUrl,
	() => {
		photoFailed.value = false;
	},
);

const showPhoto = computed(() => Boolean(props.place.photoUrl) && !photoFailed.value);
```

Extend the Vue import on line 3 to `import { computed, ref, watch } from 'vue';`, and change the image element:

```html
		<img
			v-if="showPhoto"
			:src="place.photoUrl"
			:alt="place.name"
			:class="$style.photo"
			@error="photoFailed = true"
		/>
```

- [ ] **Step 4: Run the tests**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/places/components/PlaceCard.test.ts 2>&1 | tail -20; popd
```

Expected: both PASS.

- [ ] **Step 5: Make the panel header opaque**

`.title` is `position: sticky` with no background, so scrolled content paints
underneath it — that is the overlapping heading and search box. Wrap the heading
and the search input in one sticky block.

In `PlacesPanel.vue`, replace the `N8nText` title and the `N8nInput` with:

```html
		<div :class="$style.header">
			<N8nText bold>
				{{ i18n.baseText('voyagr.places.title', { interpolate: { destination } }) }}
			</N8nText>

			<N8nInput
				v-model="query"
				:placeholder="i18n.baseText('voyagr.places.search')"
				size="small"
				@keyup.enter="onSearch"
			/>
		</div>
```

Replace the `.title` rule in the style block with:

```scss
.header {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding-bottom: var(--spacing--xs);
	// Opaque, or scrolled cards paint through the heading.
	background-color: var(--background--surface);
}
```

- [ ] **Step 6: Typecheck and lint**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -10 && pnpm lint 2>&1 | tail -10; popd
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/places/components/
git commit -m "fix(voyagr): drop failed card photos and stop the panel heading overlapping

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The cost model

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.ts`
- Test: `packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `nodeCost(nodeType: string, parameters: INodeParameters, travellers: number): number` — used by Task 6.

- [ ] **Step 1: Write the failing test**

```ts
import { nodeCost } from './tripCost';

describe('nodeCost', () => {
	it('multiplies a hotel by nights, not by travellers', () => {
		// A room sleeps the party; two travellers do not book two rooms.
		expect(nodeCost('n8n-nodes-base.hotel', { pricePerNight: 120, nights: 3 }, 2)).toBe(360);
	});

	it('multiplies a car rental by days, not by travellers', () => {
		expect(nodeCost('n8n-nodes-base.carRental', { pricePerDay: 40, days: 5 }, 4)).toBe(200);
	});

	it('treats a shopping budget as a lump sum', () => {
		expect(nodeCost('n8n-nodes-base.shopping', { budget: 300 }, 3)).toBe(300);
	});

	it.each([
		['n8n-nodes-base.flight', { price: 250 }],
		['n8n-nodes-base.train', { price: 250 }],
		['n8n-nodes-base.bus', { price: 250 }],
		['n8n-nodes-base.ferry', { price: 250 }],
		['n8n-nodes-base.activity', { price: 250 }],
	])('multiplies %s by travellers', (type, parameters) => {
		expect(nodeCost(type, parameters, 3)).toBe(750);
	});

	it('multiplies meals by travellers', () => {
		expect(nodeCost('n8n-nodes-base.restaurant', { avgCost: 25 }, 4)).toBe(100);
		expect(nodeCost('n8n-nodes-base.cafe', { avgCost: 5 }, 4)).toBe(20);
	});

	it('multiplies an entry fee by travellers', () => {
		expect(nodeCost('n8n-nodes-base.touristDestination', { entryFee: 15 }, 2)).toBe(30);
	});

	it('costs nothing for free time', () => {
		expect(nodeCost('n8n-nodes-base.freeTime', { durationHours: 3 }, 2)).toBe(0);
	});

	it('costs nothing for a node type it does not know', () => {
		// A travel node added later shows no chip rather than throwing.
		expect(nodeCost('n8n-nodes-base.spaceElevator', { price: 999 }, 1)).toBe(0);
	});

	it('defaults a missing night or day count to one', () => {
		expect(nodeCost('n8n-nodes-base.hotel', { pricePerNight: 120 }, 1)).toBe(120);
		expect(nodeCost('n8n-nodes-base.carRental', { pricePerDay: 40 }, 1)).toBe(40);
	});

	it.each([
		['missing', {}],
		['negative', { price: -50 }],
		['not a number', { price: 'free' }],
		['infinite', { price: Number.POSITIVE_INFINITY }],
	])('reads a %s price as zero', (_, parameters) => {
		expect(nodeCost('n8n-nodes-base.flight', parameters, 2)).toBe(0);
	});

	it('reads a numeric string price, as n8n parameters sometimes hold', () => {
		expect(nodeCost('n8n-nodes-base.flight', { price: '250' }, 2)).toBe(500);
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/budget/tripCost.test.ts 2>&1 | tail -15; popd
```

Expected: FAIL — cannot resolve `./tripCost`.

- [ ] **Step 3: Write the implementation**

```ts
import type { INodeParameters } from 'n8n-workflow';

/**
 * What each kind of stop costs, so the canvas can price an itinerary as the
 * traveller builds it.
 *
 * Pure by design — no stores, no Vue, no clock. Every formula reads only the
 * node's own parameters plus the party size, which is what makes the whole
 * budget recomputable from the workflow document alone.
 */

/** A price. Anything not a positive finite number reads as nothing to charge. */
function amount(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** A multiplier such as nights or days, falling back to the node's own default. */
function count(value: unknown, fallback: number): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type CostFormula = (parameters: INodeParameters, travellers: number) => number;

/**
 * Per-person costs are multiplied by the party; per-unit costs are not. A hotel
 * room and a rental car carry the whole party, and Shopping is already a lump
 * sum the traveller set themselves.
 */
const FORMULAS: Record<string, CostFormula> = {
	'n8n-nodes-base.hotel': (p) => amount(p.pricePerNight) * count(p.nights, 1),
	'n8n-nodes-base.carRental': (p) => amount(p.pricePerDay) * count(p.days, 1),
	'n8n-nodes-base.shopping': (p) => amount(p.budget),
	'n8n-nodes-base.flight': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.train': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.bus': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.ferry': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.activity': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.restaurant': (p, travellers) => amount(p.avgCost) * travellers,
	'n8n-nodes-base.cafe': (p, travellers) => amount(p.avgCost) * travellers,
	'n8n-nodes-base.touristDestination': (p, travellers) => amount(p.entryFee) * travellers,
	'n8n-nodes-base.freeTime': () => 0,
};

/** Zero for any node with nothing to charge, including ones added after this table. */
export function nodeCost(
	nodeType: string,
	parameters: INodeParameters,
	travellers: number,
): number {
	return FORMULAS[nodeType]?.(parameters, travellers) ?? 0;
}
```

- [ ] **Step 4: Run the tests**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/budget/tripCost.test.ts 2>&1 | tail -15; popd
```

Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/budget/
git commit -m "feat(voyagr): cost formula per kind of stop

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Travellers on Start Trip, and honest price labels

**Files:**
- Modify: `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts:85` and `:99`
- Modify: `packages/nodes-base/nodes/Voyagr/Flight/Flight.node.ts:25`
- Modify: `packages/nodes-base/nodes/Voyagr/Train/Train.node.ts:25`
- Modify: `packages/nodes-base/nodes/Voyagr/Bus/Bus.node.ts:13`
- Modify: `packages/nodes-base/nodes/Voyagr/Ferry/Ferry.node.ts:13`
- Modify: `packages/nodes-base/nodes/Voyagr/Activity/Activity.node.ts:14`
- Test: `packages/nodes-base/nodes/Voyagr/__tests__/voyagr-nodes.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the Start Trip parameter named `travellers` (default `1`), read by Task 6 and written by Task 5.

Only `displayName` changes on the price fields — parameter **names** stay, so no
saved trip needs migrating.

- [ ] **Step 1: Write the failing test**

```ts
import type { INodeProperties } from 'n8n-workflow';

import { Activity } from '../Activity/Activity.node';
import { Bus } from '../Bus/Bus.node';
import { Ferry } from '../Ferry/Ferry.node';
import { Flight } from '../Flight/Flight.node';
import { Train } from '../Train/Train.node';
import { TripStart } from '../TripStart/TripStart.node';

function property(properties: INodeProperties[], name: string): INodeProperties | undefined {
	return properties.find((candidate) => candidate.name === name);
}

describe('Start Trip', () => {
	it('carries a party size, defaulting to one traveller', () => {
		const travellers = property(new TripStart().description.properties, 'travellers');

		expect(travellers).toMatchObject({ type: 'number', default: 1 });
	});
});

describe('per-person prices', () => {
	it.each([
		['Flight', new Flight().description.properties, 'price'],
		['Train', new Train().description.properties, 'price'],
		['Bus', new Bus().description.properties, 'price'],
		['Ferry', new Ferry().description.properties, 'price'],
		['Activity', new Activity().description.properties, 'price'],
	])('%s names its price per person', (_, properties, name) => {
		// The budget multiplies these by the party size, so the label has to say so.
		expect(property(properties, name)?.displayName).toBe('Price per Person');
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pushd packages/nodes-base && pnpm test nodes/Voyagr/__tests__/voyagr-nodes.test.ts 2>&1 | tail -25; popd
```

Expected: FAIL — `travellers` is `undefined` and every label is `'Price'`.

- [ ] **Step 3: Add the travellers field**

In `TripStart.node.ts`, insert after the `currency` property (after its closing
`},` at line 85, before the closing `],`):

```ts
			{
				displayName: 'Travellers',
				name: 'travellers',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1 },
				description: 'How many people are going. Per-person costs are multiplied by this.',
			},
```

- [ ] **Step 4: Emit it**

In the same file's `trigger`, add after the `currency` line:

```ts
							travellers: this.getNodeParameter('travellers', 1) as number,
```

- [ ] **Step 5: Relabel the five per-person prices**

In each file, change only the `displayName`:

- `Flight/Flight.node.ts:25` and `Train/Train.node.ts:25` and `Bus/Bus.node.ts:13` and `Ferry/Ferry.node.ts:13` and `Activity/Activity.node.ts:14`:

```ts
			{ displayName: 'Price per Person', name: 'price', type: 'number', default: 0 },
```

- [ ] **Step 6: Run the tests**

```bash
pushd packages/nodes-base && pnpm test nodes/Voyagr/__tests__/voyagr-nodes.test.ts 2>&1 | tail -20; popd
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/nodes-base/nodes/Voyagr/
git commit -m "feat(voyagr): party size on Start Trip, per-person price labels

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Travellers through the AI generator

**Files:**
- Modify: `packages/@n8n/api-types/src/trip-generation.ts:15-23`
- Modify: `packages/cli/src/voyagr/generator/trip-generation-request.dto.ts:16-26`
- Modify: `packages/cli/src/voyagr/generator/build-trip-workflow.ts:5-12` and `:56-63`
- Modify: `packages/cli/src/voyagr/generator/__tests__/build-trip-workflow.test.ts:5-12`
- Modify: `packages/frontend/editor-ui/src/features/voyagr/generator/components/PlanWithAiDialog.vue`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: the `travellers` parameter name from Task 4.
- Produces: `TripGenerationRequest.travellers: number` and `TripWorkflowParams.travellers: number`.

Without this, every generated trip writes a Start Trip with no party size, so
per-person costs silently mean one person.

`generator.controller.ts` passes the DTO straight into `buildTripWorkflow`, so
adding the field to both types is all the wiring the backend needs.

- [ ] **Step 1: Write the failing test**

In `build-trip-workflow.test.ts`, add `travellers: 2` to the `params` fixture at
line 5:

```ts
const params = {
	startLocation: 'Home',
	destination: 'Kyoto',
	startDate: '2026-09-12T09:00:00',
	endDate: '2026-09-19T09:00:00',
	budget: 3000,
	currency: 'USD',
	travellers: 2,
};
```

and add a test:

```ts
	it('writes the party size onto the trigger so per-person costs price correctly', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);

		const trigger = nodes.find((node) => node.type === 'n8n-nodes-base.tripStart');

		expect(trigger?.parameters).toMatchObject({ travellers: 2 });
	});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pushd packages/cli && pnpm test src/voyagr/generator/__tests__/build-trip-workflow.test.ts 2>&1 | tail -20; popd
```

Expected: FAIL — `travellers` missing from the trigger parameters.

- [ ] **Step 3: Thread it through the builder**

In `build-trip-workflow.ts`, add to `TripWorkflowParams`:

```ts
	travellers: number;
```

and to the trigger's `parameters`, after `currency`:

```ts
			travellers: params.travellers,
```

- [ ] **Step 4: Run the test**

```bash
pushd packages/cli && pnpm test src/voyagr/generator/__tests__/build-trip-workflow.test.ts 2>&1 | tail -15; popd
```

Expected: PASS.

- [ ] **Step 5: Add the field to the shared request type**

In `packages/@n8n/api-types/src/trip-generation.ts`, add to `TripGenerationRequest`:

```ts
	/** Party size. Per-person costs are multiplied by this. */
	travellers: number;
```

- [ ] **Step 6: Add it to the DTO**

In `trip-generation-request.dto.ts`, inside the `Z.class({ ... })` after `currency`:

```ts
	// Clamped rather than rejected, like the sliders: a thin payload must come
	// back as one quiet "couldn't plan this", never a validation error.
	travellers: z.number().min(1).catch(1),
```

- [ ] **Step 7: Add the form input**

In `PlanWithAiDialog.vue`, add a ref beside `budget`:

```ts
const travellers = ref('1');
```

include it in the request object after `currency`:

```ts
		travellers: Number(travellers.value),
```

and add an input after the budget `N8nInputLabel` block:

```html
			<N8nInputLabel
				:label="i18n.baseText('voyagr.generate.travellers')"
				input-name="voyagr-travellers"
			>
				<N8nInput
					id="voyagr-travellers"
					v-model="travellers"
					name="voyagr-travellers"
					type="number"
					:min="1"
					:disabled="submitting"
					data-test-id="voyagr-travellers"
				/>
			</N8nInputLabel>
```

- [ ] **Step 8: Add the i18n key**

In `en.json`, after `"voyagr.generate.budget"`:

```json
	"voyagr.generate.travellers": "How many travelling?",
```

- [ ] **Step 9: Build i18n, then typecheck**

```bash
pnpm --filter @n8n/i18n build > /tmp/i18n-build.log 2>&1; tail -5 /tmp/i18n-build.log
pnpm --filter @n8n/api-types build > /tmp/api-types-build.log 2>&1; tail -5 /tmp/api-types-build.log
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -10; popd
pushd packages/cli && pnpm typecheck 2>&1 | tail -10; popd
```

Expected: no errors. `@n8n/api-types` must be rebuilt because `packages/cli` and editor-ui both consume its `dist`.

- [ ] **Step 10: Commit**

```bash
git add packages/@n8n/api-types/src/trip-generation.ts \
  packages/cli/src/voyagr/generator/ \
  packages/frontend/editor-ui/src/features/voyagr/generator/ \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): carry party size through trip generation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Branch walk and totals

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/budget/tripBudget.ts`
- Create: `packages/frontend/editor-ui/src/features/voyagr/budget/useTripBudget.ts`
- Test: `packages/frontend/editor-ui/src/features/voyagr/budget/tripBudget.test.ts`

**Interfaces:**
- Consumes: `nodeCost` from Task 3; the `travellers` parameter from Task 4.
- Produces:
  - `computeTripBudget(nodes: INodeUi[], connections: IConnections): TripBudget`
  - `type TripBudgetBranch = { index: number; total: number }`
  - `type TripBudget = { budget: number; currency: string; travellers: number; costByNodeId: Map<string, number>; branches: TripBudgetBranch[] }`
  - `useTripBudget(): { budget: ComputedRef<number>; currency: ComputedRef<string>; costByNodeId: ComputedRef<Map<string, number>>; branches: ComputedRef<TripBudgetBranch[]> }`

**Background.** `workflowDocumentStore.value.connectionsBySourceNode` is an
`IConnections` keyed by node **name** (`{ [name]: { main: Array<IConnection[] | null> } }`),
while nodes carry both `id` and `name`. Chips are keyed by id, the walk works on
names, so the two are bridged inside `computeTripBudget`.

`buildTripWorkflow` fans Start Trip out to one branch per generated option, so
summing the whole canvas would treat three alternative itineraries as one trip.

- [ ] **Step 1: Write the failing test**

```ts
import type { IConnections } from 'n8n-workflow';

import type { INodeUi } from '@/Interface';

import { computeTripBudget } from './tripBudget';

const node = (id: string, name: string, type: string, parameters = {}): INodeUi =>
	({ id, name, type, typeVersion: 1, position: [0, 0], parameters }) as INodeUi;

const tripStart = (parameters = {}) =>
	node('start', 'Start Trip', 'n8n-nodes-base.tripStart', {
		budget: 1000,
		currency: 'USD',
		travellers: 1,
		...parameters,
	});

/** One `main` output edge from `from` to each name in `to`. */
const chain = (edges: Array<[string, string[]]>): IConnections =>
	Object.fromEntries(
		edges.map(([from, to]) => [
			from,
			{ main: [to.map((name) => ({ node: name, type: 'main', index: 0 }))] },
		]),
	) as IConnections;

describe('computeTripBudget', () => {
	it('reads budget, currency and party size off Start Trip', () => {
		const result = computeTripBudget([tripStart({ budget: 2500, currency: 'INR', travellers: 3 })], {});

		expect(result).toMatchObject({ budget: 2500, currency: 'INR', travellers: 3 });
	});

	it('totals a single chain of stops', () => {
		const nodes = [
			tripStart(),
			node('h', 'Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 100, nights: 2 }),
			node('r', 'Dinner', 'n8n-nodes-base.restaurant', { avgCost: 30 }),
		];
		const connections = chain([
			['Start Trip', ['Hotel']],
			['Hotel', ['Dinner']],
		]);

		const result = computeTripBudget(nodes, connections);

		expect(result.branches).toEqual([{ index: 1, total: 230 }]);
	});

	it('totals each generated option separately rather than summing the canvas', () => {
		const nodes = [
			tripStart(),
			node('a', 'Option A Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 100, nights: 1 }),
			node('b', 'Option B Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 250, nights: 1 }),
		];
		const connections = chain([['Start Trip', ['Option A Hotel', 'Option B Hotel']]]);

		const result = computeTripBudget(nodes, connections);

		expect(result.branches).toEqual([
			{ index: 1, total: 100 },
			{ index: 2, total: 250 },
		]);
	});

	it('prices every node whether or not it sits on a branch', () => {
		const nodes = [
			tripStart(),
			node('h', 'Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 100, nights: 2 }),
			// Dragged onto the canvas but not connected yet.
			node('loose', 'Cafe', 'n8n-nodes-base.cafe', { avgCost: 8 }),
		];
		const connections = chain([['Start Trip', ['Hotel']]]);

		const result = computeTripBudget(nodes, connections);

		expect(result.costByNodeId.get('h')).toBe(200);
		expect(result.costByNodeId.get('loose')).toBe(8);
		// An unconnected stop is not on the itinerary, so it is not spent yet.
		expect(result.branches).toEqual([{ index: 1, total: 200 }]);
	});

	it('multiplies per-person costs by the party size', () => {
		const nodes = [
			tripStart({ travellers: 4 }),
			node('r', 'Dinner', 'n8n-nodes-base.restaurant', { avgCost: 25 }),
		];

		const result = computeTripBudget(nodes, chain([['Start Trip', ['Dinner']]]));

		expect(result.branches).toEqual([{ index: 1, total: 100 }]);
	});

	it('counts a stop shared by two options in both totals', () => {
		const nodes = [
			tripStart(),
			node('a', 'Option A Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 100, nights: 1 }),
			node('b', 'Option B Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 250, nights: 1 }),
			node('s', 'Shared Dinner', 'n8n-nodes-base.restaurant', { avgCost: 40 }),
		];
		const connections = chain([
			['Start Trip', ['Option A Hotel', 'Option B Hotel']],
			['Option A Hotel', ['Shared Dinner']],
			['Option B Hotel', ['Shared Dinner']],
		]);

		const result = computeTripBudget(nodes, connections);

		// Each branch is a complete alternative itinerary, so both pay for it.
		expect(result.branches).toEqual([
			{ index: 1, total: 140 },
			{ index: 2, total: 290 },
		]);
	});

	it('terminates on a cycle instead of looping', () => {
		const nodes = [
			tripStart(),
			node('a', 'A', 'n8n-nodes-base.cafe', { avgCost: 5 }),
			node('b', 'B', 'n8n-nodes-base.cafe', { avgCost: 7 }),
		];
		const connections = chain([
			['Start Trip', ['A']],
			['A', ['B']],
			['B', ['A']],
		]);

		const result = computeTripBudget(nodes, connections);

		expect(result.branches).toEqual([{ index: 1, total: 12 }]);
	});

	it('falls back to one branch over everything when there is no Start Trip', () => {
		const nodes = [
			node('h', 'Hotel', 'n8n-nodes-base.hotel', { pricePerNight: 100, nights: 1 }),
			node('r', 'Dinner', 'n8n-nodes-base.restaurant', { avgCost: 30 }),
		];

		const result = computeTripBudget(nodes, {});

		expect(result).toMatchObject({ budget: 0, currency: 'USD', travellers: 1 });
		expect(result.branches).toEqual([{ index: 1, total: 130 }]);
	});

	it('reads a missing or nonsense budget as unset', () => {
		expect(computeTripBudget([tripStart({ budget: 0 })], {}).budget).toBe(0);
		expect(computeTripBudget([tripStart({ budget: -5 })], {}).budget).toBe(0);
		expect(computeTripBudget([tripStart({ budget: 'lots' })], {}).budget).toBe(0);
	});

	it('reads a missing or nonsense party size as one traveller', () => {
		expect(computeTripBudget([tripStart({ travellers: 0 })], {}).travellers).toBe(1);
		expect(computeTripBudget([tripStart({ travellers: undefined })], {}).travellers).toBe(1);
	});
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/budget/tripBudget.test.ts 2>&1 | tail -15; popd
```

Expected: FAIL — cannot resolve `./tripBudget`.

- [ ] **Step 3: Write the implementation**

`tripBudget.ts`:

```ts
import type { IConnections } from 'n8n-workflow';

import type { INodeUi } from '@/Interface';

import { nodeCost } from './tripCost';

const TRIP_START_NODE_TYPE = 'n8n-nodes-base.tripStart';

const DEFAULT_CURRENCY = 'USD';

export type TripBudgetBranch = {
	/**
	 * 1-based, in Start Trip's connection order — which is the order
	 * `buildTripWorkflow` lays branches out down the canvas, so "Option 2" in the
	 * pill is the second branch the traveller sees.
	 */
	index: number;
	total: number;
};

export type TripBudget = {
	/** Zero means the traveller has not set one, matching `computeTripSummary`. */
	budget: number;
	currency: string;
	travellers: number;
	costByNodeId: Map<string, number>;
	branches: TripBudgetBranch[];
};

/** A zero or negative budget means unset, not free. */
function readAmount(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readTravellers(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function readCurrency(value: unknown): string {
	return typeof value === 'string' && value.trim() !== '' ? value : DEFAULT_CURRENCY;
}

/**
 * Every node name reachable downstream of `root`, inclusive.
 *
 * `seen` makes a cycle terminate and a diamond count once per branch rather
 * than once per path into it.
 */
function reachableFrom(root: string, connections: IConnections): Set<string> {
	const seen = new Set<string>();
	const queue = [root];

	while (queue.length > 0) {
		const name = queue.shift();
		if (name === undefined || seen.has(name)) continue;
		seen.add(name);

		for (const outputs of connections[name]?.main ?? []) {
			for (const target of outputs ?? []) queue.push(target.node);
		}
	}

	return seen;
}

/**
 * Prices a canvas.
 *
 * Branches matter because a generated trip is three alternative itineraries
 * fanning out of one trigger: summing the canvas would read as instantly over
 * budget. Each branch is totalled on its own so the options can be compared
 * against the same budget.
 *
 * Pure — no stores, no clock. `useTripBudget` is the reactive wrapper.
 */
export function computeTripBudget(nodes: INodeUi[], connections: IConnections): TripBudget {
	const tripStart = nodes.find((node) => node.type === TRIP_START_NODE_TYPE);
	const parameters = tripStart?.parameters ?? {};

	const travellers = readTravellers(parameters.travellers);

	const costByNodeId = new Map<string, number>();
	const costByNodeName = new Map<string, number>();

	for (const node of nodes) {
		const cost = nodeCost(node.type, node.parameters ?? {}, travellers);
		costByNodeId.set(node.id, cost);
		costByNodeName.set(node.name, cost);
	}

	const total = (names: Iterable<string>) => {
		let sum = 0;
		for (const name of names) sum += costByNodeName.get(name) ?? 0;
		return sum;
	};

	// No trigger yet (a canvas mid-build): price everything as one itinerary,
	// which is what a traveller laying out a single trip would expect.
	const branches: TripBudgetBranch[] = tripStart
		? (connections[tripStart.name]?.main?.[0] ?? []).map((edge, position) => ({
				index: position + 1,
				total: total(reachableFrom(edge.node, connections)),
			}))
		: [{ index: 1, total: total(costByNodeName.keys()) }];

	return {
		budget: readAmount(parameters.budget),
		currency: readCurrency(parameters.currency),
		travellers,
		costByNodeId,
		branches,
	};
}
```

`useTripBudget.ts`:

```ts
import { computed } from 'vue';

import { injectWorkflowDocumentStore } from '@/app/stores/workflowDocument.store';

import { computeTripBudget } from './tripBudget';

/**
 * The trip's budget, live off the workflow document, so a chip updates as the
 * traveller types a price.
 *
 * Deliberately not routed through `useWorkflowDocumentRenderData`'s
 * `*ByNodeId` maps: those live in a core n8n store, and a Voyagr-only
 * projection there is fork surface we would carry through every merge.
 */
export function useTripBudget() {
	const workflowDocumentStore = injectWorkflowDocumentStore();

	const budget = computed(() =>
		computeTripBudget(
			workflowDocumentStore.value.allNodes,
			workflowDocumentStore.value.connectionsBySourceNode,
		),
	);

	return {
		budget: computed(() => budget.value.budget),
		currency: computed(() => budget.value.currency),
		costByNodeId: computed(() => budget.value.costByNodeId),
		branches: computed(() => budget.value.branches),
	};
}
```

- [ ] **Step 4: Run the tests**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/voyagr/budget/ 2>&1 | tail -20; popd
```

Expected: PASS — both `tripCost` and `tripBudget` suites.

- [ ] **Step 5: Typecheck**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -10; popd
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/budget/
git commit -m "feat(voyagr): price each itinerary branch against the trip budget

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: The per-node chip

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/budget/components/NodeBudgetChip.vue`
- Modify: `packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeDefault.vue` (imports, template, styles)

**Interfaces:**
- Consumes: `useTripBudget()` from Task 6.
- Produces: `<NodeBudgetChip :node-id="string" />`, `data-test-id="node-budget-chip"`.

Chips stay neutral in colour. A chip states one node's own cost, and a node
reachable from two branches could sit in one that fits and one that does not —
colouring it would force the chip to pick a branch it deliberately does not know
about. Overspend belongs to an itinerary, not a stop (Task 9's pill carries it).

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed } from 'vue';

import { N8nText } from '@n8n/design-system';

import { formatTripMoney } from '../../tripFormatting';
import { useTripBudget } from '../useTripBudget';

const props = defineProps<{ nodeId: string }>();

const { budget, currency, costByNodeId } = useTripBudget();

const cost = computed(() => costByNodeId.value.get(props.nodeId) ?? 0);

/**
 * Null for a stop with nothing to charge — a Free Time block, or a price nobody
 * filled in. An absent chip reads as "nothing to account for"; a "0 · 0%" chip
 * reads as a bug.
 */
const label = computed(() => {
	if (cost.value <= 0) return null;

	const money = formatTripMoney(cost.value, currency.value);
	if (budget.value <= 0) return money;

	return `${money} · ${Math.round((cost.value / budget.value) * 100)}%`;
});
</script>

<template>
	<N8nText v-if="label" size="xsmall" color="text-light" data-test-id="node-budget-chip">
		{{ label }}
	</N8nText>
</template>
```

- [ ] **Step 2: Render it on the canvas node**

In `CanvasNodeDefault.vue`, add to the imports:

```ts
import NodeBudgetChip from '@/features/voyagr/budget/components/NodeBudgetChip.vue';
```

and inside the `.description` block, after the subtitle `div`:

```html
			<NodeBudgetChip :node-id="id" :class="$style.budget" />
```

Add to the style module, beside the existing `.subtitle` rule (around line 446):

```scss
.budget {
	margin-top: var(--spacing--5xs);
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -10 && pnpm lint 2>&1 | tail -10; popd
```

Expected: no errors.

- [ ] **Step 4: Run the canvas node tests to catch a snapshot break**

```bash
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/features/workflows/canvas 2>&1 | tail -25; popd
```

Expected: PASS. If a snapshot fails only by gaining the chip element, review the
diff and update it with `-u`; if anything else changed, stop and investigate.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/budget/components/NodeBudgetChip.vue \
  packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeDefault.vue
git commit -m "feat(voyagr): show each stop's cost and budget share on the canvas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Remove the editor tabs

**Files:**
- Modify: `packages/frontend/editor-ui/src/app/components/MainHeader/MainHeader.vue` (script + template)

**Interfaces:**
- Consumes: nothing.
- Produces: the emptied bar that Task 9 fills.

`TabBar.vue` and the `MAIN_HEADER_TABS` enum stay in the tree —
`useHistoryHelper` and `nodeViewUtils.getNodeViewTab` still reference the enum,
and removing it is a wider refactor with no user-visible payoff. Only the header
stops rendering tabs.

- [ ] **Step 1: Replace the `<script setup>` block**

Everything removed here exists only to drive the tabs: the three route arrays,
`activeHeaderTab`, `tabBarItems`, `isViewRoute`, `syncTabsWithRoute`,
`onTabSelected`, the three `navigateTo*View` functions, and the
`dirtyState` / `workflowToReturnTo` / `executionToReturnTo` bookkeeping they
shared. `onWorkflowPage` survives because Task 9's pill uses the same condition.

```vue
<script setup lang="ts">
import WorkflowDetails from '@/app/components/MainHeader/WorkflowDetails.vue';
import { useI18n } from '@n8n/i18n';
import { usePushConnection } from '@/app/composables/usePushConnection';
import {
	LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON,
	STICKY_NODE_TYPE,
	N8N_MAIN_GITHUB_REPO_URL,
} from '@/app/constants';
import { injectNDVStoreIfProvided } from '@/features/ndv/shared/ndv.store';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useUIStore } from '@/app/stores/ui.store';
import { useWorkflowsListStore } from '@/app/stores/workflowsList.store';
import { computed, inject, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { WorkflowDocumentStoreKey } from '@/app/constants/injectionKeys';
import { useInjectWorkflowId } from '@/app/composables/useInjectWorkflowId';

import { useLocalStorage } from '@vueuse/core';
import GithubButton from 'vue-github-button';
import type { FolderShortInfo } from '@/features/core/folders/folders.types';

import { N8nIcon } from '@n8n/design-system';
import { useToast } from '@/app/composables/useToast';
const router = useRouter();
const route = useRoute();
const locale = useI18n();
const pushConnection = usePushConnection({ router });
const toast = useToast();
// The editor header renders before a workflow document is loaded (e.g. the
// blank-canvas boot window), so use the non-throwing accessor and guard reads.
const ndvStore = injectNDVStoreIfProvided();
const uiStore = useUIStore();
const workflowsListStore = useWorkflowsListStore();
const settingsStore = useSettingsStore();

const githubButtonHidden = useLocalStorage(LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON, false);

const activeNode = computed(() => ndvStore.value?.activeNode ?? null);
const hideMenuBar = computed(() =>
	Boolean(activeNode.value && activeNode.value.type !== STICKY_NODE_TYPE),
);
const workflowId = useInjectWorkflowId();
const workflowDocumentStore = inject(WorkflowDocumentStoreKey, null);
const workflowName = computed(() => workflowDocumentStore?.value?.name ?? '');
const workflowTags = computed(() => workflowDocumentStore?.value?.tags ?? []);
const workflowIsArchived = computed(() => workflowDocumentStore?.value?.isArchived ?? false);
const workflowDescription = computed(() => workflowDocumentStore?.value?.description ?? '');
const onWorkflowPage = computed(() => !!(route.meta.nodeView || route.meta.keepWorkflowAlive));

const isEnterprise = computed(
	() => settingsStore.isQueueModeEnabled && settingsStore.isWorkerViewAvailable,
);
const isTelemetryEnabled = computed((): boolean => {
	return settingsStore.isTelemetryEnabled;
});
const showGitHubButton = computed(
	() =>
		!isEnterprise.value &&
		!settingsStore.settings.inE2ETests &&
		!githubButtonHidden.value &&
		isTelemetryEnabled.value,
);

const parentFolderForBreadcrumbs = computed<FolderShortInfo | undefined>(() => {
	const folder = workflowDocumentStore?.value?.parentFolder;
	if (!folder) return undefined;
	return {
		id: folder.id,
		name: folder.name,
		parentFolder: folder.parentFolderId ?? undefined,
	};
});

onBeforeMount(() => {
	pushConnection.initialize();
});

onBeforeUnmount(() => {
	pushConnection.terminate();
});

function hideGithubButton() {
	githubButtonHidden.value = true;
}

async function onWorkflowDeactivated() {
	if (
		settingsStore.isModuleActive('mcp') &&
		workflowDocumentStore?.value?.settings?.availableInMCP
	) {
		try {
			// Fetch the updated workflow to get the latest settings after backend processing
			const updatedWorkflow = await workflowsListStore.fetchWorkflow(workflowId.value);
			workflowDocumentStore?.value?.hydrate(updatedWorkflow);
			toast.showToast({
				title: locale.baseText('mcp.workflowDeactivated.title'),
				message: locale.baseText('mcp.workflowDeactivated.message'),
				type: 'info',
			});
		} catch (error) {
			toast.showError(error, locale.baseText('workflowSettings.showError.fetchSettings.title'));
		}
	}
}
</script>
```

- [ ] **Step 2: Remove the `<TabBar>` element**

Delete the whole element at the end of the `.main-header` div:

```html
			<TabBar
				v-if="onWorkflowPage"
				:items="tabBarItems"
				:model-value="activeHeaderTab"
				:floating="settingsStore.isCanvasOnly"
				@update:model-value="onTabSelected"
			/>
```

Leave the surrounding `.container` and `.main-header` divs and all styles alone —
the bar stays; only its contents go.

- [ ] **Step 3: Typecheck and lint**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -15 && pnpm lint 2>&1 | tail -15; popd
```

Expected: no errors. An unused-import or unused-variable complaint means
something in Step 1 was kept that is no longer referenced — remove it.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/editor-ui/src/app/components/MainHeader/MainHeader.vue
git commit -m "chore(voyagr): drop the editor/executions/evaluations tabs

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: The budget pill

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/budget/components/TripBudgetPill.vue`
- Modify: `packages/frontend/editor-ui/src/app/components/MainHeader/MainHeader.vue`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: `useTripBudget()` from Task 6; the bar emptied by Task 8.
- Produces: `data-test-id="trip-budget-pill"`.

`N8nCanvasPill` is n8n's own floating-canvas pill and is not re-exported from the
design-system barrel, so it imports by subpath. The progress element follows the
native-`<progress>`-with-n8n-tokens pattern from
`features/shared/banners/components/banners/TrialBanner.vue`.

- [ ] **Step 1: Add the i18n keys**

In `en.json`, after `"voyagr.generate.unavailable"`:

```json
	"voyagr.budget.of": "{spent} of {budget}",
	"voyagr.budget.left": "{amount} left",
	"voyagr.budget.over": "{amount} over",
	"voyagr.budget.planned": "{amount} planned",
	"voyagr.budget.noBudget": "No budget set",
	"voyagr.budget.option": "Option {index}",
```

- [ ] **Step 2: Build i18n so the keys typecheck**

```bash
pnpm --filter @n8n/i18n build > /tmp/i18n-build.log 2>&1; tail -5 /tmp/i18n-build.log
```

Expected: build succeeds.

- [ ] **Step 3: Write the component**

```vue
<script setup lang="ts">
import { computed } from 'vue';

import N8nCanvasPill from '@n8n/design-system/components/CanvasPill';
import { N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import { formatTripMoney } from '../../tripFormatting';
import { useTripBudget } from '../useTripBudget';

const i18n = useI18n();

const { budget, currency, branches } = useTripBudget();

type Segment = {
	key: number;
	/** Absent for a single-branch trip: there is no option to name. */
	option: string | null;
	spend: string;
	remaining: string;
	/** 0-100, clamped so the bar cannot overflow its track when over budget. */
	percent: number;
	isOver: boolean;
};

const money = (amount: number) => formatTripMoney(amount, currency.value);

const segments = computed<Segment[]>(() =>
	branches.value.map((branch) => {
		const hasBudget = budget.value > 0;
		const isOver = hasBudget && branch.total > budget.value;

		return {
			key: branch.index,
			option:
				branches.value.length > 1
					? i18n.baseText('voyagr.budget.option', {
							interpolate: { index: branch.index },
						})
					: null,
			spend: hasBudget
				? i18n.baseText('voyagr.budget.of', {
						interpolate: { spent: money(branch.total), budget: money(budget.value) },
					})
				: i18n.baseText('voyagr.budget.planned', {
						interpolate: { amount: money(branch.total) },
					}),
			remaining: !hasBudget
				? i18n.baseText('voyagr.budget.noBudget')
				: isOver
					? i18n.baseText('voyagr.budget.over', {
							interpolate: { amount: money(branch.total - budget.value) },
						})
					: i18n.baseText('voyagr.budget.left', {
							interpolate: { amount: money(budget.value - branch.total) },
						}),
			percent: hasBudget ? Math.min(Math.round((branch.total / budget.value) * 100), 100) : 0,
			isOver,
		};
	}),
);

/** Nothing priced yet is not worth a pill. */
const visible = computed(() => branches.value.some((branch) => branch.total > 0));
</script>

<template>
	<div v-if="visible" :class="$style.wrapper" data-test-id="trip-budget-pill">
		<N8nCanvasPill v-for="segment in segments" :key="segment.key">
			<span :class="$style.segment">
				<N8nText v-if="segment.option" size="xsmall" :class="$style.option">
					{{ segment.option }}
				</N8nText>
				<span :class="$style.amounts">
					<N8nText size="xsmall" :color="segment.isOver ? 'danger' : undefined">
						{{ segment.spend }}
					</N8nText>
					<N8nText size="xsmall" :color="segment.isOver ? 'danger' : 'text-light'">
						{{ segment.remaining }}
					</N8nText>
				</span>
				<progress
					:class="[$style.progress, segment.isOver ? $style.over : $style.within]"
					:value="segment.percent"
					max="100"
				/>
			</span>
		</N8nCanvasPill>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%) translateY(50%);
	display: flex;
	gap: var(--spacing--2xs);
	// Above the canvas, matching the bar this replaces.
	z-index: 100;
}

.segment {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.option {
	color: var(--color--text--tint-1);
}

.amounts {
	display: flex;
	flex-direction: column;
	line-height: 1.2;
	white-space: nowrap;
}

.progress {
	appearance: none;
	width: var(--spacing--3xl);
	height: var(--spacing--3xs);
	border: 0;
	border-radius: var(--radius--2xs);

	&::-webkit-progress-bar {
		background-color: var(--color--foreground--shade-1);
		border-radius: var(--radius--2xs);
	}

	&::-moz-progress-bar {
		border-radius: var(--radius--2xs);
	}
}

.within::-webkit-progress-value {
	background-color: var(--color--success);
	border-radius: var(--radius--2xs);
}

.within::-moz-progress-bar {
	background-color: var(--color--success);
}

.over::-webkit-progress-value {
	background-color: var(--color--danger);
	border-radius: var(--radius--2xs);
}

.over::-moz-progress-bar {
	background-color: var(--color--danger);
}
</style>
```

- [ ] **Step 4: Verify every CSS token exists**

An undefined variable collapses the property silently, with no build error.

```bash
pushd packages/frontend/@n8n/design-system/src/css && for token in "--spacing--2xs" "--spacing--3xs" "--spacing--3xl" "--radius--2xs" "--color--foreground--shade-1" "--color--success" "--color--danger" "--color--text--tint-1"; do printf '%s: ' "$token"; grep -rqs -- "$token:" . && echo defined || echo MISSING; done; popd
```

Expected: every line `defined`. Replace any `MISSING` token with a real one from
`_primitives.scss` / `_tokens.scss` before continuing.

- [ ] **Step 5: Mount it in the header bar**

In `MainHeader.vue`, add the import:

```ts
import TripBudgetPill from '@/features/voyagr/budget/components/TripBudgetPill.vue';
```

and place it where `<TabBar>` used to sit, as the last child of `.main-header`:

```html
			<TripBudgetPill v-if="onWorkflowPage" />
```

- [ ] **Step 6: Typecheck and lint**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -15 && pnpm lint 2>&1 | tail -15; popd
```

Expected: no errors. If the `N8nCanvasPill` subpath does not resolve, check
`packages/frontend/@n8n/design-system/package.json` `exports` and fall back to
`@n8n/design-system/components/CanvasPill/CanvasPill.vue`.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/budget/components/TripBudgetPill.vue \
  packages/frontend/editor-ui/src/app/components/MainHeader/MainHeader.vue \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): trip budget pill on the canvas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Turn Insights off

**Files:**
- Modify: `packages/@n8n/backend-common/src/modules/modules.config.ts:57-58`
- Modify: `packages/frontend/editor-ui/src/app/modules.manifest.ts:3` and `:14`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

The sidebar entry is gated on `settingsStore.isModuleActive('insights')`, so
disabling the backend module removes the nav item, the route and the REST surface
at once. `ModuleRegistry` computes `defaultModules + enabled - disabled`, so a
default on `disabledModules` is enough. The `insights` sidebar item and feature
folder stay put — a disabled module renders nothing, and untouched code keeps
future n8n merges clean.

- [ ] **Step 1: Default-disable the module**

In `modules.config.ts`, replace the `disabledModules` declaration:

```ts
	/**
	 * Comma-separated list of all disabled modules.
	 *
	 * Voyagr ships with `insights` off: it reports on automation executions,
	 * which is not what a trip is.
	 */
	@Env('N8N_DISABLED_MODULES')
	disabledModules: ModuleArray = ['insights'];
```

If TypeScript rejects the array literal, use `new ModuleArray('insights')` —
`ModuleArray` takes a comma-separated string.

- [ ] **Step 2: Drop the frontend module**

In `modules.manifest.ts`, remove the `InsightsModule` import line and its entry
in the `modules` array, leaving:

```ts
import type { FrontendModuleDescription } from '@n8n/frontend-module-sdk';
import { DataTableModule } from '@/features/core/dataTable/module.descriptor';
import { MCPModule } from '@/features/ai/mcpAccess/module.descriptor';
import { ChatModule } from '@/features/ai/chatHub/module.descriptor';
import { InstanceAiModule } from '@/features/ai/instanceAi/module.descriptor';
import { AgentsModule } from '@/features/agents/module.descriptor';
import { OtelModule } from '@/features/settings/otel/module.descriptor';

/**
 * Hard-coding modules list until we have a dynamic way to load modules.
 */
export const modules: FrontendModuleDescription[] = [
	DataTableModule,
	MCPModule,
	ChatModule,
	InstanceAiModule,
	AgentsModule,
	OtelModule,
];
```

- [ ] **Step 3: Typecheck both packages**

```bash
pushd packages/@n8n/backend-common && pnpm typecheck 2>&1 | tail -10; popd
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -10; popd
```

Expected: no errors.

- [ ] **Step 4: Run the module registry tests**

```bash
pushd packages/@n8n/backend-common && pnpm test src/modules 2>&1 | tail -20; popd
```

Expected: PASS. A test asserting the default `disabledModules` is empty needs
updating to the new default — read it before changing it.

- [ ] **Step 5: Commit**

```bash
git add packages/@n8n/backend-common/src/modules/modules.config.ts \
  packages/frontend/editor-ui/src/app/modules.manifest.ts
git commit -m "chore(voyagr): turn the insights module off by default

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Strip the sidebar

**Files:**
- Modify: `packages/frontend/editor-ui/src/app/components/MainSidebar.vue`
- Modify: `packages/frontend/editor-ui/src/app/composables/useSettingsItems.ts`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a `feedback` sidebar item whose `handleSelect` case Task 12 fills in. Until then it opens nothing.

The Templates entry **stays** — it is reserved for Voyagr's own preset vacation
packages. Do not remove it.

- [ ] **Step 1: Add the i18n key**

In `en.json`, after the budget keys:

```json
	"voyagr.feedback.sidebar": "Send feedback",
```

Then rebuild i18n:

```bash
pnpm --filter @n8n/i18n build > /tmp/i18n-build.log 2>&1; tail -5 /tmp/i18n-build.log
```

- [ ] **Step 2: Replace the help item with a feedback item**

In `MainSidebar.vue`, delete the entire `{ id: 'help', ... }` object from
`mainMenuItems` — quickstart, docs, forum, examples, report-bug and about, along
with its `notification` binding — and put this in its place:

```ts
	{
		id: 'feedback',
		icon: 'message-square',
		label: i18n.baseText('voyagr.feedback.sidebar'),
		position: 'bottom',
		available: true,
	},
```

- [ ] **Step 3: Remove the What's New wiring**

Delete the `showWhatsNewNotification` computed (around line 79) and, in
`handleSelect`, delete the `'about'` case and the whole
`if (key.startsWith('whats-new-article-'))` branch in `default`.

Also remove the now-unused imports and locals: `ABOUT_MODAL_KEY`,
`WHATS_NEW_MODAL_KEY`, `EXTERNAL_LINKS`, `useBugReporting` / `getReportingURL`,
`useVersionsStore` / `versionsStore`. Keep the `'quickstart' | 'docs' | 'forum' |
'examples'` case only if any surviving item still emits those keys — after
Step 2 none do, so delete it and the `trackHelpItemClick` helper with it.

- [ ] **Step 4: Allowlist the settings items**

In `useSettingsItems.ts`, replace the `visibleSettingsItems` computed at the end
of the file:

```ts
	/**
	 * Voyagr keeps only the settings a traveller needs. The rest of n8n's
	 * settings menu is instance administration for an automation tool.
	 *
	 * Filtered rather than deleted: the item definitions stay upstream-shaped, so
	 * merges from n8n stay clean and re-enabling one is a single line.
	 */
	const VOYAGR_SETTINGS = new Set(['settings-personal', 'settings-users']);

	const visibleSettingsItems = computed(() =>
		settingsItems.value.filter((item) => item.available && VOYAGR_SETTINGS.has(item.id)),
	);
```

- [ ] **Step 5: Confirm the icon name is real**

```bash
grep -n "'message-square'" packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts | head -3
```

Expected: at least one hit, and it must be inside `updatedIconSet` — not
`deprecatedIconSet`. If it is missing or deprecated, pick another
`updatedIconSet` name and use that instead.

- [ ] **Step 6: Typecheck, lint, and run the sidebar tests**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -15 && pnpm lint 2>&1 | tail -15; popd
pushd packages/frontend/editor-ui && NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls" pnpm test src/app/components/MainSidebar 2>&1 | tail -25; popd
```

Expected: no type or lint errors. Any sidebar test asserting on Help, About or
What's New now fails legitimately — delete those cases rather than restoring the
items.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/editor-ui/src/app/components/MainSidebar.vue \
  packages/frontend/editor-ui/src/app/composables/useSettingsItems.ts \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "chore(voyagr): strip the help menu, what's new, and admin settings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Feedback modal

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/feedback/feedback.api.ts`
- Create: `packages/frontend/editor-ui/src/features/voyagr/feedback/components/FeedbackModal.vue`
- Modify: `packages/frontend/editor-ui/src/app/constants/modals.ts`
- Modify: `packages/frontend/editor-ui/src/app/stores/ui.store.ts`
- Modify: `packages/frontend/editor-ui/src/app/components/Modals.vue`
- Modify: `packages/frontend/editor-ui/src/app/components/MainSidebar.vue` (`handleSelect`)
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: the `feedback` sidebar item from Task 11.
- Produces: `VOYAGR_FEEDBACK_MODAL_KEY`, `submitFeedback(text: string): Promise<void>`.

`ModalKey` is `keyof Modals`, and `Modals` carries a `[key: string]: ModalState`
index signature, so a new key needs no type change.

**Nothing is sent anywhere.** The endpoint is intentionally blank.

- [ ] **Step 1: Add the i18n keys**

In `en.json`, after `"voyagr.feedback.sidebar"`:

```json
	"voyagr.feedback.title": "Send feedback",
	"voyagr.feedback.subtitle": "Tell us what's working and what isn't.",
	"voyagr.feedback.placeholder": "What would make Voyagr better?",
	"voyagr.feedback.submit": "Send",
	"voyagr.feedback.thanks": "Thanks for the feedback.",
```

Rebuild i18n:

```bash
pnpm --filter @n8n/i18n build > /tmp/i18n-build.log 2>&1; tail -5 /tmp/i18n-build.log
```

- [ ] **Step 2: Write the API stub**

`feedback.api.ts`:

```ts
/**
 * Where feedback would go.
 *
 * Deliberately blank: the form exists so travellers have somewhere to put a
 * thought, but there is no collector yet. Nothing is sent, nothing is stored,
 * and the submitted text is discarded — do not assume a backlog exists
 * somewhere. Fill this in and swap the body below for a real request when
 * there is an endpoint to receive it.
 */
const FEEDBACK_ENDPOINT = '';

export async function submitFeedback(_text: string): Promise<void> {
	if (FEEDBACK_ENDPOINT === '') return;

	// TODO: POST the feedback once FEEDBACK_ENDPOINT points somewhere.
}
```

- [ ] **Step 3: Add the modal key**

In `app/constants/modals.ts`, at the end of the key list:

```ts
export const VOYAGR_FEEDBACK_MODAL_KEY = 'voyagrFeedback';
```

- [ ] **Step 4: Register the modal state**

In `app/stores/ui.store.ts`, add `VOYAGR_FEEDBACK_MODAL_KEY` to the import from
`@/app/constants` and to the array inside `modalsById` (after
`ADD_EXECUTION_TO_DATASET_MODAL_KEY` or at the end of the list).

- [ ] **Step 5: Write the modal**

`FeedbackModal.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';

import { N8nButton, N8nInput, N8nInputLabel } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import Modal from '@/app/components/Modal.vue';
import { VOYAGR_FEEDBACK_MODAL_KEY } from '@/app/constants';
import { useToast } from '@/app/composables/useToast';
import { useUIStore } from '@/app/stores/ui.store';

import { submitFeedback } from '../feedback.api';

const i18n = useI18n();
const toast = useToast();
const uiStore = useUIStore();

const text = ref('');
const submitting = ref(false);

async function onSubmit(): Promise<void> {
	if (text.value.trim() === '' || submitting.value) return;

	submitting.value = true;

	try {
		await submitFeedback(text.value);

		toast.showMessage({ title: i18n.baseText('voyagr.feedback.thanks'), type: 'success' });
		text.value = '';
		uiStore.closeModal(VOYAGR_FEEDBACK_MODAL_KEY);
	} finally {
		submitting.value = false;
	}
}
</script>

<template>
	<Modal
		:name="VOYAGR_FEEDBACK_MODAL_KEY"
		:title="i18n.baseText('voyagr.feedback.title')"
		:subtitle="i18n.baseText('voyagr.feedback.subtitle')"
		width="480px"
		data-test-id="voyagr-feedback-modal"
	>
		<template #content>
			<N8nInputLabel :label="i18n.baseText('voyagr.feedback.title')" input-name="voyagr-feedback">
				<N8nInput
					id="voyagr-feedback"
					v-model="text"
					name="voyagr-feedback"
					type="textarea"
					:rows="5"
					:placeholder="i18n.baseText('voyagr.feedback.placeholder')"
					:disabled="submitting"
					data-test-id="voyagr-feedback-input"
				/>
			</N8nInputLabel>
		</template>

		<template #footer>
			<N8nButton
				:label="i18n.baseText('voyagr.feedback.submit')"
				:disabled="text.trim() === ''"
				:loading="submitting"
				data-test-id="voyagr-feedback-submit"
				@click="onSubmit"
			/>
		</template>
	</Modal>
</template>
```

Check `Modal.vue`'s slot names before finishing this step — if it uses `#header`
/ `#content` / `#footer`, the above is correct; adjust if they differ:

```bash
grep -n "slot name=" packages/frontend/editor-ui/src/app/components/Modal.vue
```

Also confirm `useToast` exposes `showMessage`; if not, use the method it does
expose for a success toast:

```bash
grep -n "showMessage\|showToast" packages/frontend/editor-ui/src/app/composables/useToast.ts | head -5
```

- [ ] **Step 6: Mount it**

In `app/components/Modals.vue`, add `VOYAGR_FEEDBACK_MODAL_KEY` to the
`@/app/constants` import, add the component import:

```ts
import FeedbackModal from '@/features/voyagr/feedback/components/FeedbackModal.vue';
```

and add a root beside the others in the template:

```html
		<ModalRoot :name="VOYAGR_FEEDBACK_MODAL_KEY">
			<FeedbackModal />
		</ModalRoot>
```

Match the surrounding `ModalRoot` usage — if siblings pass `:keep-alive` or a
slot prop, follow that shape.

- [ ] **Step 7: Open it from the sidebar**

In `MainSidebar.vue`, add `VOYAGR_FEEDBACK_MODAL_KEY` to the `@/app/constants`
import and a case in `handleSelect`:

```ts
		case 'feedback': {
			uiStore.openModal(VOYAGR_FEEDBACK_MODAL_KEY);
			break;
		}
```

- [ ] **Step 8: Typecheck and lint**

```bash
pushd packages/frontend/editor-ui && pnpm typecheck 2>&1 | tail -15 && pnpm lint 2>&1 | tail -15; popd
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/feedback/ \
  packages/frontend/editor-ui/src/app/constants/modals.ts \
  packages/frontend/editor-ui/src/app/stores/ui.store.ts \
  packages/frontend/editor-ui/src/app/components/Modals.vue \
  packages/frontend/editor-ui/src/app/components/MainSidebar.vue \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): feedback form with no collector behind it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Full build and manual verification

**Files:** none — verification only.

**Interfaces:**
- Consumes: everything above.
- Produces: a `docs/VOYAGR.md` update.

- [ ] **Step 1: Full build**

```bash
CI=1 pnpm build:n8n > build.log 2>&1; tail -n 25 build.log
```

Expected: no errors. On stale outputs after branch switching, `pnpm reset` then
rebuild.

- [ ] **Step 2: Full lint and typecheck**

```bash
pnpm lint > /tmp/lint.log 2>&1; tail -20 /tmp/lint.log
pnpm typecheck > /tmp/typecheck.log 2>&1; tail -20 /tmp/typecheck.log
```

Expected: clean.

- [ ] **Step 3: Run the affected tests**

```bash
pnpm test:affected > /tmp/test.log 2>&1; tail -40 /tmp/test.log
```

Expected: PASS. Failures in `MainSidebar`, canvas snapshots or module-registry
defaults are the legitimate consequences called out in Tasks 7, 10 and 11 — fix
the test to match the new behaviour, never revert the behaviour to please a test.

- [ ] **Step 4: Start the server and check by hand**

```bash
N8N_DIAGNOSTICS_ENABLED=false pnpm start > server.log 2>&1 &
sleep 25 && grep -i "Editor is now accessible" server.log
```

Confirm `packages/cli/bin/.env` exists (a gitignored symlink to the repo-root
`.env`) or `VOYAGR_GOOGLE_PLACES_KEY` reads empty and photos stay absent for a
reason unrelated to this work.

Sign in at http://localhost:5678 as `owner@voyagr.local` / `Voyagr1234`, then walk:

- [ ] Open a travel node → the suggestions panel shows **photos**, not broken glyphs.
- [ ] Scroll the panel → the heading no longer overlaps the search box.
- [ ] Confirm no `browserId check failed` lines in `server.log`.
- [ ] Set a budget, travellers and prices on Start Trip and a hotel → chips and the pill update as you type.
- [ ] Push the total past the budget → the pill turns red; chips stay neutral.
- [ ] Clear the budget → chips show amounts with no percentage; the pill says no budget is set.
- [ ] Plan with AI → three branches, three separate option totals in the pill.
- [ ] Editor/Executions/Evaluations tabs gone; the bar itself still there with the pill in it.
- [ ] Insights gone from the sidebar; `/insights` does not resolve.
- [ ] Help menu and What's New gone; Settings shows only Personal and Users.
- [ ] **Templates still present.**
- [ ] Feedback opens, accepts text, closes with a toast. Confirm the browser network tab shows **no** request.

- [ ] **Step 5: Update the project doc**

Add to `docs/VOYAGR.md` §2 ("What's done") a short "Trip budget" entry, and to §5
("Gotchas") two lines:

- The browser-id check 401s any URL a browser fetches for itself (`<img>`,
  `<embed>`, EventSource). New routes of that shape need an entry in
  `AuthService.skipBrowserIdCheckEndpoints`. The symptom is indistinguishable
  from a bad API key: the asset simply never loads.
- The Templates sidebar entry is reserved for Voyagr's preset vacation packages.
  It is not leftover n8n — do not strip it.

Move "Node execution semantics / budget" out of §8 ("Next steps"), leaving the
trips-page spend rollup noted as the remaining piece.

- [ ] **Step 6: Commit**

```bash
git add docs/VOYAGR.md
git commit -m "docs: record the trip budget, the browser-id gotcha, and why Templates stays

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

**Spec coverage:** §1.1 → Task 1. §1.2 → Task 2. §1.3 → Task 2. §2.1 → Tasks 7, 9.
§2.2 → Tasks 3, 4. §2.3 → Tasks 4, 5. §2.4 → Task 6. §2.5 → Tasks 7, 9.
§2.6 → Tasks 7, 9. §2.7 → deliberately unimplemented, recorded in Task 13 Step 5.
§3.1 → Task 8. §3.2 → Task 10. §3.3–3.5 → Task 11. §3.6 → Task 11 (kept).
§4 → Task 12. Testing section → per-task tests plus Task 13.

**Naming consistency:** `nodeCost(nodeType, parameters, travellers)` (Task 3) is
called only from `computeTripBudget` (Task 6). `computeTripBudget(nodes,
connections)` returns `{ budget, currency, travellers, costByNodeId, branches }`;
`useTripBudget()` re-exposes `budget`, `currency`, `costByNodeId`, `branches` as
computeds — `travellers` is intentionally not re-exposed, as no component needs
it. `TripBudgetBranch` is `{ index, total }` in both the type and every test
assertion. The parameter is `travellers` everywhere: node, DTO, request type,
builder, cost model.
