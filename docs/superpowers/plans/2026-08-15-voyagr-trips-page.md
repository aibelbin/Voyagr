# Voyagr Trips Page & Start Trip Inputs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Overview page into a trips list whose cards show real itinerary info, and give the Start Trip node origin/date/budget inputs.

**Architecture:** The Start Trip node holds the trip's origin, dates and budget. The backend derives a small `TripSummary` from each trip's stored nodes and attaches it to the workflows list response via a second, primary-key-indexed query (the existing list query deliberately omits `nodes`, and its folders/workflows union is fragile). The frontend renders that summary on each card and aggregates it into a stat strip that replaces the executions insights banner.

**Tech Stack:** TypeScript, Vue 3 + Pinia (editor-ui), TypeORM (@n8n/db), Vitest.

Spec: `docs/superpowers/specs/2026-08-15-voyagr-trips-page-design.md`
Project background: `docs/VOYAGR.md`

## Global Constraints

- Always use `pnpm`. `CI=1` is required on any `pnpm install` / `pnpm build:n8n`.
- Never use the `any` type; avoid `as` casting outside test code.
- All user-facing UI text goes through `@n8n/i18n` (`packages/frontend/@n8n/i18n/src/locales/en.json`).
- Frontend: reuse existing `@n8n/design-system` components; use CSS variables, never hardcoded px; icon names must come from `updatedIconSet` in `packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`.
- Do not run a bare `pnpm install` — it has corrupted `package.json` files in this repo before (`docs/VOYAGR.md` §5).
- Tests are deliberately light: one unit-test file for the derivation logic, plus keeping existing suites green.
- Node type IDs in this fork: `n8n-nodes-base.tripStart`, `n8n-nodes-base.stickyNote`.

---

### Task 1: TripSummary type and derivation

**Files:**
- Create: `packages/@n8n/api-types/src/trip-summary.ts`
- Modify: `packages/@n8n/api-types/src/index.ts`
- Create: `packages/cli/src/workflows/trip-summary.ts`
- Test: `packages/cli/src/workflows/__tests__/trip-summary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TripSummary` type (exported from `@n8n/api-types`) and `computeTripSummary(nodes: INode[]): TripSummary` (exported from `@/workflows/trip-summary`).

- [ ] **Step 1: Add the shared type**

Create `packages/@n8n/api-types/src/trip-summary.ts`:

```ts
/** Itinerary-level summary of a trip, derived from its Start Trip node. */
export type TripSummary = {
	startLocation?: string;
	startDate?: string;
	endDate?: string;
	budget?: number;
	currency?: string;
	stopCount: number;
};
```

- [ ] **Step 2: Export it**

In `packages/@n8n/api-types/src/index.ts`, add this line directly below `export type * from './datetime';`:

```ts
export type * from './trip-summary';
```

- [ ] **Step 3: Write the failing test**

Create `packages/cli/src/workflows/__tests__/trip-summary.test.ts`:

```ts
import type { INode } from 'n8n-workflow';

import { computeTripSummary } from '@/workflows/trip-summary';

const node = (type: string, parameters: INode['parameters'] = {}): INode => ({
	id: type,
	name: type,
	type,
	typeVersion: 1,
	position: [0, 0],
	parameters,
});

describe('computeTripSummary', () => {
	it('counts stops, excluding the trigger and sticky notes', () => {
		const summary = computeTripSummary([
			node('n8n-nodes-base.tripStart'),
			node('n8n-nodes-base.stickyNote'),
			node('n8n-nodes-base.hotel'),
			node('n8n-nodes-base.flight'),
		]);

		expect(summary.stopCount).toBe(2);
	});

	it('reads trip details from the Start Trip node', () => {
		const summary = computeTripSummary([
			node('n8n-nodes-base.tripStart', {
				startLocation: 'Home',
				startDate: '2026-09-12T00:00:00.000Z',
				endDate: '2026-09-19T00:00:00.000Z',
				budget: 3000,
				currency: 'USD',
			}),
			node('n8n-nodes-base.hotel'),
		]);

		expect(summary).toEqual({
			stopCount: 1,
			startLocation: 'Home',
			startDate: '2026-09-12T00:00:00.000Z',
			endDate: '2026-09-19T00:00:00.000Z',
			budget: 3000,
			currency: 'USD',
		});
	});

	it('treats blank strings and a zero budget as unset', () => {
		const summary = computeTripSummary([
			node('n8n-nodes-base.tripStart', { startLocation: '', startDate: '', budget: 0 }),
		]);

		expect(summary.startLocation).toBeUndefined();
		expect(summary.startDate).toBeUndefined();
		expect(summary.budget).toBeUndefined();
	});

	it('returns only a stop count when there is no Start Trip node', () => {
		expect(computeTripSummary([node('n8n-nodes-base.hotel')])).toEqual({ stopCount: 1 });
	});
});
```

- [ ] **Step 4: Run the test and watch it fail**

```bash
cd packages/cli && pnpm test src/workflows/__tests__/trip-summary.test.ts
```

Expected: FAIL — cannot resolve `@/workflows/trip-summary`.

- [ ] **Step 5: Implement the derivation**

Create `packages/cli/src/workflows/trip-summary.ts`:

```ts
import type { TripSummary } from '@n8n/api-types';
import type { INode } from 'n8n-workflow';

const TRIP_START_NODE_TYPE = 'n8n-nodes-base.tripStart';

/** Nodes that annotate the itinerary rather than being a stop on it. */
const NON_STOP_NODE_TYPES = new Set([TRIP_START_NODE_TYPE, 'n8n-nodes-base.stickyNote']);

function asText(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** A zero or negative budget means the traveller has not set one. */
function asAmount(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function computeTripSummary(nodes: INode[]): TripSummary {
	const stopCount = nodes.filter((node) => !NON_STOP_NODE_TYPES.has(node.type)).length;
	const tripStart = nodes.find((node) => node.type === TRIP_START_NODE_TYPE);

	if (!tripStart) return { stopCount };

	const parameters = tripStart.parameters ?? {};

	return {
		stopCount,
		startLocation: asText(parameters.startLocation),
		startDate: asText(parameters.startDate),
		endDate: asText(parameters.endDate),
		budget: asAmount(parameters.budget),
		currency: asText(parameters.currency),
	};
}
```

- [ ] **Step 6: Run the test and watch it pass**

```bash
cd packages/cli && pnpm test src/workflows/__tests__/trip-summary.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/@n8n/api-types/src/trip-summary.ts packages/@n8n/api-types/src/index.ts \
  packages/cli/src/workflows/trip-summary.ts packages/cli/src/workflows/__tests__/trip-summary.test.ts
git commit -m "feat(voyagr): derive trip summary from itinerary nodes"
```

---

### Task 2: Attach trip summaries to the workflows list

**Files:**
- Modify: `packages/@n8n/db/src/repositories/workflow.repository.ts`
- Modify: `packages/cli/src/workflows/workflow.service.ts`

**Interfaces:**
- Consumes: `computeTripSummary` and `TripSummary` from Task 1.
- Produces: `workflowRepository.findNodesByIds(ids: string[]): Promise<Array<{ id: string; nodes: INode[] }>>`, and a `tripSummary?: TripSummary` property on every workflow returned by `WorkflowService.getMany()`.

- [ ] **Step 1: Add the repository method**

In `packages/@n8n/db/src/repositories/workflow.repository.ts`, add this type-only import directly below the existing `import { PROJECT_ROOT, UserError } from 'n8n-workflow';`:

```ts
import type { INode } from 'n8n-workflow';
```

Then add this method directly below the existing `getAllActiveIds()` method (around line 84):

```ts
	/** Nodes for the given workflows, so list views can derive a trip summary. */
	async findNodesByIds(ids: string[]): Promise<Array<{ id: string; nodes: INode[] }>> {
		if (ids.length === 0) return [];

		return await this.find({
			select: { id: true, nodes: true },
			where: { id: In(ids) },
		});
	}
```

`In` is already imported at the top of this file — do not re-import it.

- [ ] **Step 2: Wire it into getMany()**

In `packages/cli/src/workflows/workflow.service.ts`, add to the imports:

```ts
import type { TripSummary } from '@n8n/api-types';

import { computeTripSummary } from '@/workflows/trip-summary';
```

Add this private method to the `WorkflowService` class, directly below `getMany()` (which ends around line 204):

```ts
	/** Voyagr: itinerary summary shown on trip cards, derived from each trip's nodes. */
	private async attachTripSummaries(workflows: Array<{ id: string; tripSummary?: TripSummary }>) {
		if (workflows.length === 0) return;

		const rows = await this.workflowRepository.findNodesByIds(workflows.map(({ id }) => id));
		const summaries = new Map(rows.map((row) => [row.id, computeTripSummary(row.nodes ?? [])]));

		for (const workflow of workflows) {
			workflow.tripSummary = summaries.get(workflow.id);
		}
	}
```

Then in `getMany()`, insert the call immediately after the `if (includeFolders) { workflows = this.mergeProcessedWorkflows(...); }` block and immediately before the comment `// Add hasResolvableCredentials if dynamic credentials feature is licensed`:

```ts
		await this.attachTripSummaries(workflows);
```

Placement matters: after the merge, so folders present in the list are simply left without a summary; before the return statements, so both return paths carry it.

- [ ] **Step 3: Verify existing service tests still pass**

```bash
cd packages/cli && pnpm test src/workflows/__tests__/workflow.service.test.ts
```

Expected: PASS. The `getMany()` tests stub an empty workflow list, and `attachTripSummaries` returns early on an empty array, so the mocked repository is never asked for nodes.

- [ ] **Step 4: Typecheck both packages**

```bash
cd packages/@n8n/db && pnpm typecheck && cd ../../cli && pnpm typecheck
```

Expected: no errors. If `attachTripSummaries(workflows)` reports an argument-type error, it means the local `workflows` variable is a union — narrow it at the call site rather than casting, e.g. assign to a `const list: Array<{ id: string; tripSummary?: TripSummary }> = workflows;` first.

- [ ] **Step 5: Commit**

```bash
git add packages/@n8n/db/src/repositories/workflow.repository.ts packages/cli/src/workflows/workflow.service.ts
git commit -m "feat(voyagr): return trip summary with the trips list"
```

---

### Task 3: Start Trip node inputs

**Files:**
- Modify: `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: node parameters named `startLocation`, `startDate`, `endDate`, `budget`, `currency` — the exact names `computeTripSummary` (Task 1) reads.

- [ ] **Step 1: Add the properties**

In `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts`, replace the whole `properties: [...]` array (keeping the existing notice as its first entry) with:

```ts
		properties: [
			{
				displayName:
					'This is where your itinerary begins. Add travel steps after it — hotels, destinations, food and transport — then click <strong>Plan trip</strong> to build the plan.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Starting From',
				name: 'startLocation',
				type: 'string',
				default: 'Home',
				placeholder: 'Home',
				description: 'Where the trip begins',
			},
			{
				displayName: 'Trip Starts',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'The day you leave',
			},
			{
				displayName: 'Trip Ends',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'The day you get back',
			},
			{
				displayName: 'Budget',
				name: 'budget',
				type: 'number',
				default: 0,
				description: 'Total budget for the trip',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: [
					{ name: 'US Dollar (USD)', value: 'USD' },
					{ name: 'Euro (EUR)', value: 'EUR' },
					{ name: 'British Pound (GBP)', value: 'GBP' },
					{ name: 'Indian Rupee (INR)', value: 'INR' },
					{ name: 'Japanese Yen (JPY)', value: 'JPY' },
					{ name: 'Australian Dollar (AUD)', value: 'AUD' },
					{ name: 'Canadian Dollar (CAD)', value: 'CAD' },
					{ name: 'UAE Dirham (AED)', value: 'AED' },
				],
			},
		],
```

- [ ] **Step 2: Emit the trip context**

Replace the `trigger()` method in the same file with:

```ts
	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const manualTriggerFunction = async () => {
			this.emit([
				this.helpers.returnJsonArray([
					{
						startLocation: this.getNodeParameter('startLocation', '') as string,
						startDate: this.getNodeParameter('startDate', '') as string,
						endDate: this.getNodeParameter('endDate', '') as string,
						budget: this.getNodeParameter('budget', 0) as number,
						currency: this.getNodeParameter('currency', 'USD') as string,
					},
				]),
			]);
		};
		return { manualTriggerFunction };
	}
```

Note the `ITriggerFunctions.getNodeParameter(name, fallback)` signature — it takes a fallback value, not an item index.

- [ ] **Step 3: Lint and typecheck**

```bash
cd packages/nodes-base && pnpm typecheck && npx eslint nodes/Voyagr/TripStart/TripStart.node.ts
```

Expected: no errors. n8n's node lint rules require Title Case `displayName`s and a `description` on non-obvious fields — both are satisfied above.

- [ ] **Step 4: Commit**

```bash
git add packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts
git commit -m "feat(voyagr): add origin, dates and budget to Start Trip"
```

---

### Task 4: Trip meta on the trip cards

**Files:**
- Modify: `packages/frontend/editor-ui/src/Interface.ts:285-301` (`WorkflowResource`) and `:351-358` (`WorkflowListItem`)
- Create: `packages/frontend/editor-ui/src/features/voyagr/tripFormatting.ts`
- Modify: `packages/frontend/editor-ui/src/app/components/WorkflowCard.vue`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: `TripSummary` from `@n8n/api-types` (Task 1); the `tripSummary` field on list responses (Task 2).
- Produces: `formatTripMoney(amount: number, currency: string): string` from `@/features/voyagr/tripFormatting`, reused by Task 5.

**Before starting:** invoke the `n8n:design-system` skill — it governs Vue/SCSS changes in `packages/frontend`.

- [ ] **Step 1: Add tripSummary to the frontend list types**

In `packages/frontend/editor-ui/src/Interface.ts`, add `TripSummary` to the existing `@n8n/api-types` type import at lines 2-8 — do not create a second import block. It becomes:

```ts
import type {
	AgentJsonConfig,
	FrontendSettings,
	IUserManagementSettings,
	IVersionNotificationSettings,
	Role,
	TripSummary,
} from '@n8n/api-types';
```

Add this line to the `WorkflowResource` type, directly below `hasResolvableCredentials?: boolean;`:

```ts
	tripSummary?: TripSummary;
```

And to `WorkflowListItem`, directly below its own `hasResolvableCredentials?: boolean;`:

```ts
	tripSummary?: TripSummary;
```

- [ ] **Step 2: Add the shared money formatter**

Create `packages/frontend/editor-ui/src/features/voyagr/tripFormatting.ts`:

```ts
/** Trip budgets are whole-currency amounts — no one budgets a trip to the cent. */
export function formatTripMoney(amount: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency,
		maximumFractionDigits: 0,
	}).format(amount);
}
```

- [ ] **Step 3: Add the card strings**

In `packages/frontend/@n8n/i18n/src/locales/en.json`, add these keys directly below the existing `"workflows.item.created": "Created",` line (line 4554):

```json
	"workflows.item.trip.addDates": "Add dates",
	"workflows.item.trip.day": "1 day",
	"workflows.item.trip.days": "{count} days",
	"workflows.item.trip.stop": "1 stop",
	"workflows.item.trip.stops": "{count} stops",
	"workflows.item.trip.noStops": "no stops yet",
	"workflows.item.trip.from": "from {location}",
```

- [ ] **Step 4: Build the trip meta parts in WorkflowCard**

In `packages/frontend/editor-ui/src/app/components/WorkflowCard.vue`, add `IconName` to the existing type import from `@n8n/design-system`:

```ts
import type { IconName } from '@n8n/design-system';
```

Then add this computed directly below the existing `formattedCreatedAtDate` computed (which ends around line 293):

```ts
type TripMetaPart = { icon?: IconName; text: string };

const tripMeta = computed<TripMetaPart[]>(() => {
	const summary = props.data.tripSummary;
	if (!summary) return [];

	const currentYear = new Date().getFullYear().toString();
	const formatTripDate = (value: string) =>
		dateformat(value, `d mmm${value.startsWith(currentYear) ? '' : ', yyyy'}`);

	const parts: TripMetaPart[] = [];

	if (summary.startDate) {
		parts.push({
			icon: 'calendar',
			text: summary.endDate
				? `${formatTripDate(summary.startDate)} – ${formatTripDate(summary.endDate)}`
				: formatTripDate(summary.startDate),
		});

		if (summary.endDate) {
			const days = Math.round(
				(new Date(summary.endDate).getTime() - new Date(summary.startDate).getTime()) / 86_400_000,
			);
			if (days > 0) {
				parts.push({
					text:
						days === 1
							? locale.baseText('workflows.item.trip.day')
							: locale.baseText('workflows.item.trip.days', { interpolate: { count: days } }),
				});
			}
		}
	} else {
		parts.push({ icon: 'calendar', text: locale.baseText('workflows.item.trip.addDates') });
	}

	if (summary.stopCount === 0) {
		parts.push({ icon: 'pin', text: locale.baseText('workflows.item.trip.noStops') });
	} else {
		parts.push({
			icon: 'pin',
			text:
				summary.stopCount === 1
					? locale.baseText('workflows.item.trip.stop')
					: locale.baseText('workflows.item.trip.stops', {
							interpolate: { count: summary.stopCount },
						}),
		});
	}

	if (summary.startLocation) {
		parts.push({
			text: locale.baseText('workflows.item.trip.from', {
				interpolate: { location: summary.startLocation },
			}),
		});
	}

	if (summary.budget && summary.currency) {
		parts.push({ icon: 'circle-dollar-sign', text: formatTripMoney(summary.budget, summary.currency) });
	}

	return parts;
});
```

Add the formatter import alongside the other `@/` imports:

```ts
import { formatTripMoney } from '@/features/voyagr/tripFormatting';
```

`dateformat`, `locale`, `computed` and `N8nIcon` are all already imported in this file — do not re-import them.

- [ ] **Step 5: Render it**

In the same file's template, replace these four lines inside `<div :class="$style.cardDescription">` (around lines 625-632):

```html
			<span v-show="data">
				{{ locale.baseText('workflows.item.updated') }}
				<TimeAgo :date="String(data.updatedAt)" />
			</span>
			<span v-show="data" :class="$style.divider">|</span>
			<span v-show="data">
				{{ locale.baseText('workflows.item.created') }} {{ formattedCreatedAtDate }}
			</span>
```

with:

```html
			<template v-if="tripMeta.length">
				<template v-for="(part, index) in tripMeta" :key="part.text">
					<span v-if="index > 0" :class="$style.divider">|</span>
					<span :class="$style.tripMetaPart">
						<N8nIcon v-if="part.icon" :icon="part.icon" size="small" />
						{{ part.text }}
					</span>
				</template>
			</template>
			<template v-else>
				<span v-show="data">
					{{ locale.baseText('workflows.item.updated') }}
					<TimeAgo :date="String(data.updatedAt)" />
				</span>
				<span v-show="data" :class="$style.divider">|</span>
				<span v-show="data">
					{{ locale.baseText('workflows.item.created') }} {{ formattedCreatedAtDate }}
				</span>
			</template>
```

The `v-else` branch keeps the original behaviour for anything without a summary, so folders and any non-trip resource still render sensibly.

Add this class to the `<style lang="scss" module>` block at the end of the file:

```scss
.tripMetaPart {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
}
```

- [ ] **Step 6: Run the card tests and typecheck**

```bash
cd packages/frontend/editor-ui && pnpm test src/app/components/WorkflowCard.test.ts && pnpm typecheck
```

Expected: PASS. The existing card tests render cards without a `tripSummary`, so they exercise the `v-else` branch unchanged.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/editor-ui/src/Interface.ts \
  packages/frontend/editor-ui/src/features/voyagr/tripFormatting.ts \
  packages/frontend/editor-ui/src/app/components/WorkflowCard.vue \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): show itinerary details on trip cards"
```

---

### Task 5: Trip stats strip

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/components/TripStats.vue`
- Modify: `packages/frontend/editor-ui/src/app/views/WorkflowsView.vue` (imports ~line 53, `showInsights` ~line 712, header slot ~line 2215)
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: `formatTripMoney` from Task 4; `tripSummary` on list resources from Task 2.
- Produces: `TripStats.vue`, a component taking a single prop `resources: Resource[]`.

**Before starting:** invoke the `n8n:design-system` skill.

Why a new component: the design system has no stat/summary component (only Callout, Card, EmptyState, HoverCard, InfoAccordion, InfoTip, UserInfo), and `InsightsSummary.vue` is coupled to insights types, routes and telemetry. `TripStats.vue` therefore mirrors `InsightsSummary.vue`'s markup and CSS structure so the strip keeps the same visual language in the same slot.

- [ ] **Step 1: Add the stat strings**

In `packages/frontend/@n8n/i18n/src/locales/en.json`, add these keys directly below the `workflows.item.trip.*` keys added in Task 4:

```json
	"trips.stats.trips": "Trips",
	"trips.stats.stops": "Stops",
	"trips.stats.budget": "Budget",
	"trips.stats.next": "Next departure",
	"trips.stats.next.today": "Today",
	"trips.stats.next.tomorrow": "Tomorrow",
	"trips.stats.next.inDays": "In {count} days",
	"trips.stats.empty": "—",
```

- [ ] **Step 2: Create the component**

Create `packages/frontend/editor-ui/src/features/voyagr/components/TripStats.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';

import type { Resource } from '@/Interface';
import { formatTripMoney } from '../tripFormatting';

const props = defineProps<{ resources: Resource[] }>();

const i18n = useI18n();

const DAY_IN_MS = 86_400_000;

const summaries = computed(() =>
	props.resources.flatMap((resource) =>
		resource.resourceType === 'workflow' && resource.tripSummary ? [resource.tripSummary] : [],
	),
);

const stopCount = computed(() =>
	summaries.value.reduce((total, summary) => total + summary.stopCount, 0),
);

/** Budgets in different currencies are listed side by side rather than summed. */
const budget = computed(() => {
	const totals = new Map<string, number>();

	for (const summary of summaries.value) {
		if (!summary.budget || !summary.currency) continue;
		totals.set(summary.currency, (totals.get(summary.currency) ?? 0) + summary.budget);
	}

	if (totals.size === 0) return i18n.baseText('trips.stats.empty');

	return [...totals]
		.map(([currency, amount]) => formatTripMoney(amount, currency))
		.join(' · ');
});

const nextDeparture = computed(() => {
	const now = Date.now();
	const upcoming = summaries.value
		.map((summary) => (summary.startDate ? new Date(summary.startDate).getTime() : Number.NaN))
		.filter((time) => !Number.isNaN(time) && time >= now)
		.sort((a, b) => a - b);

	if (upcoming.length === 0) return i18n.baseText('trips.stats.empty');

	const days = Math.ceil((upcoming[0] - now) / DAY_IN_MS);
	if (days <= 0) return i18n.baseText('trips.stats.next.today');
	if (days === 1) return i18n.baseText('trips.stats.next.tomorrow');

	return i18n.baseText('trips.stats.next.inDays', { interpolate: { count: days } });
});

const stats = computed(() => [
	{ id: 'trips', label: i18n.baseText('trips.stats.trips'), value: String(summaries.value.length) },
	{ id: 'stops', label: i18n.baseText('trips.stats.stops'), value: String(stopCount.value) },
	{ id: 'budget', label: i18n.baseText('trips.stats.budget'), value: budget.value },
	{ id: 'next', label: i18n.baseText('trips.stats.next'), value: nextDeparture.value },
]);
</script>

<template>
	<div :class="$style.wrapper">
		<ul :class="$style.stats" data-test-id="trip-stats">
			<li v-for="stat in stats" :key="stat.id">
				<div>
					<strong>{{ stat.label }}</strong>
					<em>{{ stat.value }}</em>
				</div>
			</li>
		</ul>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	position: relative;
	padding: var(--spacing--xs) 0 0;
	margin-bottom: var(--spacing--2xl);
}

.stats {
	display: flex;
	align-items: stretch;
	justify-content: space-evenly;
	border: var(--border);
	border-radius: 6px;
	list-style: none;
	overflow-x: auto;

	li {
		display: flex;
		align-items: stretch;
		flex: 1 0;
		border-left: var(--border);

		&:first-child {
			border-left: 0;
		}

		> div {
			display: grid;
			align-content: center;
			width: 100%;
			padding: var(--spacing--sm) var(--spacing--lg);
			background-color: var(--background--surface);
		}
	}

	strong {
		justify-self: flex-start;
		margin-bottom: var(--spacing--3xs);
		color: var(--color--text--shade-1);
		font-size: var(--font-size--sm);
		font-weight: var(--font-weight--regular);
		white-space: nowrap;
	}

	em {
		color: var(--color--text--shade-1);
		font-size: var(--font-size--xl);
		font-style: normal;
		font-weight: var(--font-weight--bold);
		white-space: nowrap;
	}
}
</style>
```

- [ ] **Step 3: Swap it into the page**

In `packages/frontend/editor-ui/src/app/views/WorkflowsView.vue`:

Replace these two import lines (lines 53-54):

```ts
import InsightsSummary from '@/features/execution/insights/components/InsightsSummary.vue';
import { useInsightsStore } from '@/features/execution/insights/insights.store';
```

with:

```ts
import TripStats from '@/features/voyagr/components/TripStats.vue';
```

Delete the store instantiation (line ~164):

```ts
const insightsStore = useInsightsStore();
```

Delete the whole `showInsights` computed (lines ~712-720):

```ts
const showInsights = computed(() => {
	return (
		projectPages.isOverviewSubPage &&
		insightsStore.isSummaryEnabled &&
		(workflowListResources.value.length > 0 ||
			(!personalizedTemplatesV2Store.isFeatureEnabled() &&
				!personalizedTemplatesV3Store.isFeatureEnabled()))
	);
});
```

And in the template, replace the `InsightsSummary` element inside `<ProjectHeader>` (lines ~2215-2220):

```html
				<InsightsSummary
					v-if="showInsights"
					:loading="insightsStore.weeklySummary.isLoading"
					:summary="insightsStore.weeklySummary.state"
					time-range="week"
				/>
```

with:

```html
				<TripStats
					v-if="projectPages.isOverviewSubPage && workflowListResources.length > 0"
					:resources="workflowListResources"
				/>
```

- [ ] **Step 4: Run the view tests, lint and typecheck**

```bash
cd packages/frontend/editor-ui && pnpm test src/app/views/WorkflowsView.test.ts && pnpm typecheck && pnpm lint
```

Expected: PASS with no unused-import or unused-variable errors. `WorkflowsView.test.ts` makes no reference to insights, so it needs no changes.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/components/TripStats.vue \
  packages/frontend/editor-ui/src/app/views/WorkflowsView.vue \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): replace executions insights with trip stats"
```

---

### Task 6: Trip wording and removing the tab row

**Files:**
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json:5248,5254,5261`
- Modify: `packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.vue`
- Modify: `packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no new API. Removes the `ProjectTabs` render from `ProjectHeader.vue`.

- [ ] **Step 1: Rename the page copy**

In `packages/frontend/@n8n/i18n/src/locales/en.json`, change these three existing values (keys stay as they are):

| Line | Key | New value |
|---|---|---|
| 5248 | `projects.header.overview.subtitle` | `All the trips you're planning` |
| 5254 | `projects.header.create.workflow` | `Plan a trip` |
| 5261 | `projects.menu.overview` | `My Trips` |

`projects.menu.overview` also labels the sidebar item; relabelling both is intended.

- [ ] **Step 2: Remove the tab row**

In `packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.vue`, delete all of the following:

1. The import `import ProjectTabs from './ProjectTabs.vue';` (line 9).
2. `TabOptions` from the design-system type import on line 5, leaving `import type { UserAction } from '@n8n/design-system';`.
3. The whole `showSettings` computed (lines ~121-126).
4. The whole `customProjectTabs` computed (lines ~135-150).
5. The whole `pageType` computed (lines ~390-398).
6. This block from the template (lines ~536-543):

```html
		<div :class="$style.actions">
			<ProjectTabs
				:page-type="pageType"
				:show-executions="!projectPages.isSharedSubPage"
				:show-settings="showSettings"
				:additional-tabs="customProjectTabs"
			/>
		</div>
```

7. The now-unused `.actions` rule from the style block (lines ~560-562):

```scss
.actions {
	padding: var(--spacing--2xs) 0 var(--spacing--xs);
}
```

Leave `<slot></slot>` in place — that is where `TripStats` renders.

- [ ] **Step 3: Delete the tests for the removed tab row**

In `packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.test.ts`, delete:

1. The `projectTabsSpy` const (lines ~53-55):

```ts
const projectTabsSpy = vi.fn().mockReturnValue({
	render: vi.fn(),
});
```

2. The `ProjectTabs: projectTabsSpy,` stub entry (line ~79).
3. These four tests in full:
   - `'should render ProjectTabs Settings if project is team project and user has update scope'`
   - `'should render ProjectTabs without Settings if no project update or externalSecretsProvider:read permission'`
   - `'should render ProjectTabs Settings if project editor has externalSecretsProvider:read scope'`
   - `'should render ProjectTabs without Settings if project is not team project'`
4. The entire `describe('customProjectTabs', ...)` block (lines ~375-543).

These assert behaviour this task removes, so they go with it.

- [ ] **Step 4: Update the renamed-copy assertion**

In the same test file, in the test `'Overview: should render the correct title and subtitle'`, change:

```ts
		const overviewSubtitle = 'All the workflows, credentials and executions you have access to';
		...
		expect(getByTestId('project-name')).toHaveTextContent('Overview');
```

to:

```ts
		const overviewSubtitle = "All the trips you're planning";
		...
		expect(getByTestId('project-name')).toHaveTextContent('My Trips');
```

- [ ] **Step 5: Run the tests, lint and typecheck**

```bash
cd packages/frontend/editor-ui && pnpm test src/features/collaboration/projects/components/ProjectHeader.test.ts && pnpm typecheck && pnpm lint
```

Expected: PASS with no unused-variable errors. If any other suite asserts the old "Overview" copy, update that assertion the same way.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/@n8n/i18n/src/locales/en.json \
  packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.vue \
  packages/frontend/editor-ui/src/features/collaboration/projects/components/ProjectHeader.test.ts
git commit -m "feat(voyagr): trip wording and single-purpose trips page"
```

---

### Task 7: Build, verify against the running app, clear mock trips

**Files:**
- Modify: `docs/VOYAGR.md` (§2 "What's done" and §8 "Next steps")

**Interfaces:**
- Consumes: everything above.
- Produces: a verified running instance and updated project notes.

- [ ] **Step 1: Build**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr && CI=1 pnpm build:n8n > build.log 2>&1; tail -n 20 build.log
```

Expected: build completes with no errors. The build regenerates `dist/known/nodes.json` and `dist/types/nodes.json`, which is what makes the new Start Trip fields visible — a bare recompile is not enough.

- [ ] **Step 2: Start the server**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr && N8N_DIAGNOSTICS_ENABLED=false pnpm start
```

Run it in the background. Wait for the "Editor is now accessible" line, then open `http://localhost:5678`. Login: `owner@voyagr.local` / `Voyagr1234`.

- [ ] **Step 3: Create one real trip by hand**

In the UI: create a trip, open the Start Trip node, set Starting From `Home`, Trip Starts and Trip Ends a week apart in the future, Budget `3000`, Currency `USD`. Add two travel nodes (e.g. Hotel and Flight). Save, then go to My Trips.

Confirm on the page:
- Title reads "My Trips", subtitle "All the trips you're planning", button "Plan a trip".
- No tab row.
- The stat strip shows Trips 1, Stops 2, Budget $3,000, Next departure "In 7 days".
- The card reads like `12 Sep – 19 Sep | 7 days | 2 stops | from Home | $3,000`.

- [ ] **Step 4: Screenshot it**

From `packages/testing/playwright`, drive headless **system** Chrome — the bundled chromium is mismatched:

```js
chromium.launch({ headless: true, channel: 'chrome' })
```

Capture `http://localhost:5678/home/workflows` after logging in, and check the rendering matches Step 3.

- [ ] **Step 5: Delete the mock trips**

Delete the eight "My workflow N" entries through the UI (each card's ⋯ menu → Delete). These are mock data and the user has approved removing them. Leave the trip created in Step 3.

- [ ] **Step 6: Update the project notes**

In `docs/VOYAGR.md`, add to §2 "What's done":

```markdown
**Trips page & Start Trip inputs:**
- Overview page is now "My Trips": trip wording, no tab row, trip stats strip
  (trips / stops / budget / next departure) instead of the executions insights.
- Trip cards show itinerary details — dates, duration, stop count, origin, budget.
- Start Trip holds Starting From, Trip Starts, Trip Ends, Budget and Currency,
  and emits them so downstream travel nodes receive trip context.
- The summary is derived server-side from each trip's nodes
  (`packages/cli/src/workflows/trip-summary.ts`) and attached in
  `WorkflowService.getMany()`; the list query itself still omits `nodes`.
```

Remove the "Deeper terminology rebrand" bullet from §8 only if no "workflow"/"execution" wording remains elsewhere; otherwise narrow it to the places still using it.

- [ ] **Step 7: Full check and commit**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr && pnpm typecheck && pnpm lint
git add docs/VOYAGR.md
git commit -m "docs: record Voyagr trips page in project status"
```

---

## Notes for the implementer

- **Known limitation, by design:** the stat strip aggregates the loaded page of trips (default page size 50), not the whole instance. This was accepted during design rather than solved.
- **Out of scope, do not add:** sorting trips by departure date, destination imagery, upcoming/past grouping, per-node dates.
- **Sanity check if cards show no trip details:** confirm the API response actually carries `tripSummary` — `curl` the list endpoint or check the network tab. If it does not, Task 2's call was likely placed after a `return` in `getMany()`.
