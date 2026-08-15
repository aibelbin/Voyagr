# Voyagr Place Connectors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suggest real places — with photos, ratings and price tiers — in a left panel, and fill a travel node in when one is picked.

**Architecture:** A backend provider layer (Foursquare for place data, Nominatim for geocoding, Wikipedia for landmark photos) behind one narrow `PlaceSearchProvider` interface, fronted by an in-memory TTL cache and a single authenticated REST endpoint. The frontend renders results as cards in a left-docked overlay panel and writes the pick into the open node's parameters.

**Tech Stack:** TypeScript, `@n8n/decorators` REST controllers, `@n8n/di` dependency injection, Vue 3 + Pinia, Vitest.

Spec: `docs/superpowers/specs/2026-08-15-voyagr-place-connectors-design.md`
Project background: `docs/VOYAGR.md`

---

## Global Constraints

**Read these before any task. They apply to every task in this plan.**

- **What this repo is:** Voyagr is a travel itinerary planner built as a fork of the n8n monorepo. The repo IS the n8n monorepo, rebranded. An "itinerary" is an n8n workflow; canvas nodes are travel steps. Custom travel nodes live in `packages/nodes-base/nodes/Voyagr/`.
- **Voyagr is a consumer product.** Users never see or enter an API key. All keys are operator-owned environment variables. Never add a credentials UI, a "connect your account" flow, or any developer-facing concept to the interface.
- Always use `pnpm`. **Never run a bare `pnpm install`** — it has corrupted `package.json` files in this repo. `CI=1` is required on any install or build.
- Never use the `any` type; avoid `as` casting outside test code.
- All user-facing text goes through `@n8n/i18n` (`packages/frontend/@n8n/i18n/src/locales/en.json`). After editing that file run `pnpm --filter @n8n/i18n build`, or typecheck will not see new keys.
- After adding an exported type to `packages/@n8n/api-types`, run `pnpm --filter @n8n/api-types build` before typechecking consumers.
- Frontend: use CSS variables, never hardcoded px. Reuse `@n8n/design-system` components. Icon names must come from `updatedIconSet` in `packages/frontend/@n8n/design-system/src/components/N8nIcon/icons.ts`. `data-test-id` must be a single value. **Invoke the `n8n:design-system` skill before writing any Vue or SCSS.**
- TypeORM must stay in `@n8n/db`; never import `@n8n/typeorm` from `packages/cli` business logic.
- `packages/nodes-base/package.json` `n8n.credentials` must stay `[]`. Populating it makes n8n's credential pseudo-nodes reappear in the palette.
- `packages/frontend/editor-ui/src/features/shared/nodeCreator/views/viewsData.ts` has ~34 **pre-existing** typecheck/lint errors. Out of scope — do not fix them, do not report them as regressions.
- Node 26's native `globalThis.localStorage` shadows jsdom's. editor-ui tests that touch it need `NODE_OPTIONS="--localstorage-file=/tmp/voyagr-ls"`.
- **Testing is deliberately minimal by explicit instruction.** Two small unit-test files in this whole plan, and one visual verification at the very end. Do not add tests beyond what tasks specify.

## Parallel execution

Tasks may run concurrently in these groups. Within a group, tasks touch disjoint files.

| Group | Tasks | Depends on |
|---|---|---|
| A | Task 1 (shared types + config) **and** Task 2 (node parameters) | — |
| B | Task 3 (providers + cache) **and** Task 5 (frontend panel) | Group A |
| C | Task 4 (service + endpoint) | Task 3 |
| D | Task 6 (verification) | everything |

Task 5 is written against the endpoint contract defined in Task 4's **Interfaces** block, so it does not need to wait for the endpoint to exist.

---

### Task 1: Shared types and configuration

**Files:**
- Create: `packages/@n8n/api-types/src/places.ts`
- Modify: `packages/@n8n/api-types/src/index.ts`
- Create: `packages/@n8n/config/src/configs/voyagr.config.ts`
- Modify: `packages/@n8n/config/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PlaceKind` and `PlaceResult` exported from `@n8n/api-types`; `VoyagrConfig` with `placesKey: string` reachable as `globalConfig.voyagr.placesKey`.

- [ ] **Step 1: Create the shared place types**

Create `packages/@n8n/api-types/src/places.ts`:

```ts
/** The kinds of place Voyagr can suggest, one per travel node type. */
export type PlaceKind =
	| 'hotel'
	| 'restaurant'
	| 'cafe'
	| 'attraction'
	| 'activity'
	| 'shopping';

/** A real place, normalised across whichever provider returned it. */
export type PlaceResult = {
	/** Provider-prefixed identifier, e.g. "fsq:4b0588...". */
	providerId: string;
	name: string;
	address?: string;
	lat: number;
	lon: number;
	/** Normalised to 0-5 regardless of the provider's own scale. */
	rating?: number;
	ratingCount?: number;
	priceTier?: 1 | 2 | 3 | 4;
	photoUrl?: string;
	/** A tip snippet or encyclopaedia extract, one line. */
	blurb?: string;
	website?: string;
};
```

- [ ] **Step 2: Export the types**

In `packages/@n8n/api-types/src/index.ts`, add this line directly below the existing `export type * from './datetime';`:

```ts
export type * from './places';
```

- [ ] **Step 3: Create the Voyagr config**

Create `packages/@n8n/config/src/configs/voyagr.config.ts`:

```ts
import { Config, Env } from '../decorators';

@Config
export class VoyagrConfig {
	/**
	 * Foursquare Places API key used to suggest hotels, restaurants and sights.
	 * Operator-owned — Voyagr users never see or enter it. Suggestions are
	 * disabled gracefully when this is empty.
	 */
	@Env('VOYAGR_PLACES_KEY')
	placesKey: string = '';
}
```

- [ ] **Step 4: Register the config**

In `packages/@n8n/config/src/index.ts`, add the import alongside the other config imports (keep the file's alphabetical-ish grouping):

```ts
import { VoyagrConfig } from './configs/voyagr.config';
```

And add the nested property to the `GlobalConfig` class, following the existing `@Nested` pattern:

```ts
	@Nested
	voyagr: VoyagrConfig;
```

- [ ] **Step 5: Build both packages and typecheck**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr
pnpm --filter @n8n/api-types build && pnpm --filter @n8n/config build
cd packages/@n8n/config && pnpm typecheck
```

Expected: both build, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/@n8n/api-types/src/places.ts packages/@n8n/api-types/src/index.ts \
  packages/@n8n/config/src/configs/voyagr.config.ts packages/@n8n/config/src/index.ts
git commit -m "feat(voyagr): shared place types and Voyagr config"
```

---

### Task 2: Node parameters for picked places

**Files:**
- Modify: `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/Hotel/Hotel.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/Restaurant/Restaurant.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/Cafe/Cafe.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/TouristDestination/TouristDestination.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/Activity/Activity.node.ts`
- Modify: `packages/nodes-base/nodes/Voyagr/Shopping/Shopping.node.ts`

**Interfaces:**
- Consumes: nothing. This task is independent of every other task and can run first or in parallel.
- Produces: a `destination` parameter on `tripStart`, and four parameters — `placeId`, `rating`, `priceTier`, `photoUrl` — on each of the six place nodes. The AI trip generator (a later, separate plan) writes exactly these names.

- [ ] **Step 1: Add `destination` to Start Trip**

In `packages/nodes-base/nodes/Voyagr/TripStart/TripStart.node.ts`, add this property to the `properties` array immediately after the existing `startLocation` entry:

```ts
			{
				displayName: 'Destination',
				name: 'destination',
				type: 'string',
				default: '',
				placeholder: 'Kyoto, Japan',
				description: 'Where the trip is going. Suggestions for every stop are based on this.',
			},
```

Then add it to the object the trigger emits, alongside the existing fields:

```ts
						destination: this.getNodeParameter('destination', '') as string,
```

- [ ] **Step 2: Add the four provider fields to each place node**

For **each** of the six files listed above — `Hotel`, `Restaurant`, `Cafe`, `TouristDestination`, `Activity`, `Shopping` — append these four properties to the end of that node's `properties` array:

```ts
			{
				displayName: 'Place ID',
				name: 'placeId',
				type: 'hidden',
				default: '',
			},
			{
				displayName: 'Rating',
				name: 'rating',
				type: 'hidden',
				default: 0,
			},
			{
				displayName: 'Price Tier',
				name: 'priceTier',
				type: 'hidden',
				default: 0,
			},
			{
				displayName: 'Photo URL',
				name: 'photoUrl',
				type: 'hidden',
				default: '',
			},
```

`type: 'hidden'` is deliberate: these are written by the suggestions panel and the AI generator, never typed by a traveller, so they must not clutter the node's form.

- [ ] **Step 3: Emit the four fields from each node's execute()**

In each of the same six files, add these lines inside the object pushed to `out` in `execute()`, alongside the existing fields:

```ts
					placeId: this.getNodeParameter('placeId', i, '') as string,
					rating: this.getNodeParameter('rating', i, 0) as number,
					priceTier: this.getNodeParameter('priceTier', i, 0) as number,
					photoUrl: this.getNodeParameter('photoUrl', i, '') as string,
```

Note the signature difference between the two node kinds: `TripStart` is a trigger and uses `getNodeParameter(name, fallback)`; the six place nodes use `getNodeParameter(name, itemIndex, fallback)`.

- [ ] **Step 4: Typecheck and lint**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/nodes-base
pnpm typecheck && npx eslint nodes/Voyagr
```

Expected: clean. n8n's node lint rules require Title Case `displayName` values — the code above already complies. If the options-sorting rule fires on anything you touched, sort alphabetically rather than adding an eslint-disable.

- [ ] **Step 5: Commit**

```bash
git add packages/nodes-base/nodes/Voyagr
git commit -m "feat(voyagr): trip destination and picked-place fields on travel nodes"
```

---

### Task 3: Providers, geocoder and cache

**Files:**
- Create: `packages/cli/src/voyagr/places/place-provider.ts`
- Create: `packages/cli/src/voyagr/places/foursquare.provider.ts`
- Create: `packages/cli/src/voyagr/places/geocoder.ts`
- Create: `packages/cli/src/voyagr/places/wikipedia.enricher.ts`
- Create: `packages/cli/src/voyagr/places/place-cache.ts`
- Test: `packages/cli/src/voyagr/places/__tests__/place-cache.test.ts`

**Interfaces:**
- Consumes: `PlaceKind`, `PlaceResult` from `@n8n/api-types` (Task 1).
- Produces:
  - `interface PlaceSearchProvider { search(opts: PlaceSearchOptions): Promise<PlaceResult[]> }` and `type PlaceSearchOptions = { kind: PlaceKind; near: string; query?: string; limit: number }` from `place-provider.ts`
  - `class FoursquareProvider` (injectable, implements `PlaceSearchProvider`)
  - `class Geocoder` with `geocode(place: string): Promise<{ lat: number; lon: number } | undefined>`
  - `class WikipediaEnricher` with `enrich(results: PlaceResult[]): Promise<PlaceResult[]>`
  - `class PlaceCache` with `get<T>(key: string): T | undefined` and `set<T>(key: string, value: T, ttlMs: number): void`

- [ ] **Step 1: Verify the current Foursquare API shape**

Before writing the provider, fetch the current Foursquare Places API documentation and confirm the request shape — base URL, authentication header, and the search response field names. Foursquare has migrated its API surface more than once, and this plan must not encode a stale contract.

Use WebFetch on `https://docs.foursquare.com/developer/reference/places-api-overview` (follow through to the place-search endpoint reference).

Record what you find at the top of your report: base URL, auth header name and format, and the JSON path to each of: place id, name, formatted address, latitude, longitude, rating, rating count, price tier, photo. Then write Step 3's code against **that**, adjusting field names from the version below where they differ.

- [ ] **Step 2: Write the cache and its test**

Create `packages/cli/src/voyagr/places/place-cache.ts`:

```ts
import { Service } from '@n8n/di';

type Entry = { value: unknown; expiresAt: number };

/**
 * In-memory TTL cache for provider responses.
 *
 * One operator-owned key on a free tier serves every Voyagr user, so caching is
 * what keeps the feature inside quota rather than a nice-to-have. Entries are
 * lost on restart, which is acceptable: a redeploy costs one cold window, not a
 * sustained increase in call volume.
 */
@Service()
export class PlaceCache {
	private readonly entries = new Map<string, Entry>();

	/** Bounded so a long-running instance cannot grow without limit. */
	private readonly maxEntries = 500;

	get<T>(key: string): T | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;

		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}

		return entry.value as T;
	}

	set<T>(key: string, value: T, ttlMs: number): void {
		if (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (!oldest.done) this.entries.delete(oldest.value);
		}

		this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
	}

	/** Seam for tests. */
	protected now(): number {
		return Date.now();
	}
}
```

Create `packages/cli/src/voyagr/places/__tests__/place-cache.test.ts`:

```ts
import { PlaceCache } from '../place-cache';

class TestCache extends PlaceCache {
	public clock = 0;

	protected now(): number {
		return this.clock;
	}
}

describe('PlaceCache', () => {
	it('returns a stored value before it expires', () => {
		const cache = new TestCache();
		cache.set('kyoto', ['a'], 1000);

		cache.clock = 999;

		expect(cache.get('kyoto')).toEqual(['a']);
	});

	it('drops a value once its ttl has passed', () => {
		const cache = new TestCache();
		cache.set('kyoto', ['a'], 1000);

		cache.clock = 1000;

		expect(cache.get('kyoto')).toBeUndefined();
	});

	it('returns undefined for a key it never held', () => {
		expect(new TestCache().get('osaka')).toBeUndefined();
	});
});
```

- [ ] **Step 3: Run the cache test**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli
pnpm test src/voyagr/places/__tests__/place-cache.test.ts
```

Expected: 3 passing. Backend packages run Vitest with `globals: true`, so `describe`/`it`/`expect` need no import.

- [ ] **Step 4: Write the provider interface**

Create `packages/cli/src/voyagr/places/place-provider.ts`:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';

export type PlaceSearchOptions = {
	kind: PlaceKind;
	/** A place name to search near, e.g. "Kyoto, Japan". */
	near: string;
	/** Optional free text to narrow the search within that area. */
	query?: string;
	limit: number;
};

/** A source of real places. The panel never learns which one answered. */
export interface PlaceSearchProvider {
	search(opts: PlaceSearchOptions): Promise<PlaceResult[]>;
}
```

- [ ] **Step 5: Write the geocoder**

Create `packages/cli/src/voyagr/places/geocoder.ts`:

```ts
import { Service } from '@n8n/di';

import { PlaceCache } from './place-cache';

type Coordinates = { lat: number; lon: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Cities do not move, so a geocode stays good for a long time. */
const GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Turns a destination string into coordinates using OpenStreetMap's Nominatim,
 * which needs no API key. Its usage policy requires a descriptive User-Agent
 * and roughly one request per second; the cache keeps us far inside that.
 */
@Service()
export class Geocoder {
	constructor(private readonly cache: PlaceCache) {}

	async geocode(place: string): Promise<Coordinates | undefined> {
		const key = `geocode:${place.trim().toLowerCase()}`;

		const cached = this.cache.get<Coordinates>(key);
		if (cached) return cached;

		const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(place)}`;

		const response = await fetch(url, {
			headers: { 'User-Agent': 'Voyagr/1.0 (travel itinerary planner)' },
		});

		if (!response.ok) return undefined;

		const body: unknown = await response.json();
		if (!Array.isArray(body) || body.length === 0) return undefined;

		const first: unknown = body[0];
		if (typeof first !== 'object' || first === null) return undefined;

		const { lat, lon } = first as { lat?: string; lon?: string };
		if (typeof lat !== 'string' || typeof lon !== 'string') return undefined;

		const coordinates = { lat: Number(lat), lon: Number(lon) };
		if (Number.isNaN(coordinates.lat) || Number.isNaN(coordinates.lon)) return undefined;

		this.cache.set(key, coordinates, GEOCODE_TTL_MS);

		return coordinates;
	}
}
```

- [ ] **Step 6: Write the Foursquare provider**

Create `packages/cli/src/voyagr/places/foursquare.provider.ts`. **Adjust the base URL, auth header and response field paths to match what Step 1 found** — the shape below reflects Foursquare's v3 Places API and may be stale:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';

import { Geocoder } from './geocoder';
import type { PlaceSearchOptions, PlaceSearchProvider } from './place-provider';

const FOURSQUARE_SEARCH_URL = 'https://api.foursquare.com/v3/places/search';

/** Foursquare category ids, one set per Voyagr place kind. */
const CATEGORIES: Record<PlaceKind, string> = {
	hotel: '19014',
	restaurant: '13065',
	cafe: '13032',
	attraction: '16000',
	activity: '18000',
	shopping: '17000',
};

type FoursquarePlace = {
	fsq_id?: string;
	name?: string;
	rating?: number;
	price?: number;
	location?: { formatted_address?: string; locality?: string };
	geocodes?: { main?: { latitude?: number; longitude?: number } };
	photos?: Array<{ prefix?: string; suffix?: string }>;
	website?: string;
};

@Service()
export class FoursquareProvider implements PlaceSearchProvider {
	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly geocoder: Geocoder,
	) {}

	/** False when no key is configured, so callers can degrade quietly. */
	get isConfigured(): boolean {
		return this.globalConfig.voyagr.placesKey !== '';
	}

	async search(opts: PlaceSearchOptions): Promise<PlaceResult[]> {
		if (!this.isConfigured) return [];

		const coordinates = await this.geocoder.geocode(opts.near);
		if (!coordinates) return [];

		const params = new URLSearchParams({
			ll: `${coordinates.lat},${coordinates.lon}`,
			categories: CATEGORIES[opts.kind],
			limit: String(opts.limit),
			fields: 'fsq_id,name,location,geocodes,rating,price,photos,website',
		});

		if (opts.query) params.set('query', opts.query);

		const response = await fetch(`${FOURSQUARE_SEARCH_URL}?${params.toString()}`, {
			headers: {
				Authorization: this.globalConfig.voyagr.placesKey,
				Accept: 'application/json',
			},
		});

		if (!response.ok) return [];

		const body: unknown = await response.json();
		if (typeof body !== 'object' || body === null) return [];

		const { results } = body as { results?: FoursquarePlace[] };
		if (!Array.isArray(results)) return [];

		return results.flatMap((place) => this.toPlaceResult(place));
	}

	/** Returns an empty array for a place too incomplete to show on a card. */
	private toPlaceResult(place: FoursquarePlace): PlaceResult[] {
		const latitude = place.geocodes?.main?.latitude;
		const longitude = place.geocodes?.main?.longitude;

		if (!place.fsq_id || !place.name || latitude === undefined || longitude === undefined) {
			return [];
		}

		const photo = place.photos?.[0];

		return [
			{
				providerId: `fsq:${place.fsq_id}`,
				name: place.name,
				address: place.location?.formatted_address ?? place.location?.locality,
				lat: latitude,
				lon: longitude,
				// Foursquare rates out of 10; every consumer expects 0-5.
				rating: typeof place.rating === 'number' ? place.rating / 2 : undefined,
				priceTier: this.toPriceTier(place.price),
				photoUrl:
					photo?.prefix && photo.suffix ? `${photo.prefix}original${photo.suffix}` : undefined,
				website: place.website,
			},
		];
	}

	private toPriceTier(price: number | undefined): 1 | 2 | 3 | 4 | undefined {
		return price === 1 || price === 2 || price === 3 || price === 4 ? price : undefined;
	}
}
```

- [ ] **Step 7: Write the Wikipedia enricher**

Create `packages/cli/src/voyagr/places/wikipedia.enricher.ts`:

```ts
import type { PlaceResult } from '@n8n/api-types';
import { Service } from '@n8n/di';

const WIKI_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';

/**
 * Fills in a photo and a one-line blurb for landmarks the primary provider is
 * thin on. Keyless, and best-effort: a miss simply leaves the card as it was.
 */
@Service()
export class WikipediaEnricher {
	async enrich(results: PlaceResult[]): Promise<PlaceResult[]> {
		return await Promise.all(
			results.map(async (result) =>
				result.photoUrl && result.blurb ? result : await this.enrichOne(result),
			),
		);
	}

	private async enrichOne(result: PlaceResult): Promise<PlaceResult> {
		try {
			const response = await fetch(`${WIKI_SUMMARY_URL}/${encodeURIComponent(result.name)}`, {
				headers: { 'User-Agent': 'Voyagr/1.0 (travel itinerary planner)' },
			});

			if (!response.ok) return result;

			const body: unknown = await response.json();
			if (typeof body !== 'object' || body === null) return result;

			const { extract, thumbnail } = body as {
				extract?: string;
				thumbnail?: { source?: string };
			};

			return {
				...result,
				photoUrl: result.photoUrl ?? thumbnail?.source,
				blurb: result.blurb ?? extract,
			};
		} catch {
			return result;
		}
	}
}
```

- [ ] **Step 8: Typecheck**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli && pnpm typecheck
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/voyagr/places
git commit -m "feat(voyagr): place providers, geocoding and response cache"
```

---

### Task 4: Places service and endpoint

**Files:**
- Create: `packages/cli/src/voyagr/places/places.service.ts`
- Create: `packages/cli/src/voyagr/places/places.controller.ts`
- Modify: `packages/cli/src/server.ts`

**Interfaces:**
- Consumes: everything from Task 3, plus `PlaceKind`/`PlaceResult` from Task 1.
- Produces: the endpoint the frontend calls —

  ```
  GET /rest/voyagr/places?kind=<PlaceKind>&near=<string>&q=<optional string>
  → PlaceResult[]
  ```

  Always returns `200` with an array. An unconfigured key, an unreachable provider, or no matches all return `[]` rather than an error status, so the panel has exactly one empty state to render.

- [ ] **Step 1: Write the service**

Create `packages/cli/src/voyagr/places/places.service.ts`:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { Service } from '@n8n/di';

import { FoursquareProvider } from './foursquare.provider';
import { PlaceCache } from './place-cache';
import { WikipediaEnricher } from './wikipedia.enricher';

/**
 * Short enough that a place closing or re-rating shows up within a day, long
 * enough that repeat searches for the same city cost nothing.
 *
 * Confirm the provider's caching terms before deploying and set this to match.
 */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

const RESULT_LIMIT = 20;

@Service()
export class PlacesService {
	constructor(
		private readonly provider: FoursquareProvider,
		private readonly enricher: WikipediaEnricher,
		private readonly cache: PlaceCache,
	) {}

	async search(kind: PlaceKind, near: string, query?: string): Promise<PlaceResult[]> {
		const key = `search:${kind}:${near.trim().toLowerCase()}:${query?.trim().toLowerCase() ?? ''}`;

		const cached = this.cache.get<PlaceResult[]>(key);
		if (cached) return cached;

		const results = await this.provider.search({ kind, near, query, limit: RESULT_LIMIT });

		// Only landmarks are worth a second round trip; the rest already carry
		// a photo and a rating from the primary provider.
		const enriched = kind === 'attraction' ? await this.enricher.enrich(results) : results;

		if (enriched.length > 0) this.cache.set(key, enriched, SEARCH_TTL_MS);

		return enriched;
	}
}
```

- [ ] **Step 2: Write the controller**

Create `packages/cli/src/voyagr/places/places.controller.ts`:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { Get, Query, RestController } from '@n8n/decorators';

import { PlacesService } from './places.service';

const PLACE_KINDS: PlaceKind[] = [
	'hotel',
	'restaurant',
	'cafe',
	'attraction',
	'activity',
	'shopping',
];

function isPlaceKind(value: string): value is PlaceKind {
	return PLACE_KINDS.some((kind) => kind === value);
}

@RestController('/voyagr')
export class PlacesController {
	constructor(private readonly placesService: PlacesService) {}

	/**
	 * Suggestions for one kind of stop near one destination.
	 *
	 * No scope decorator: this is a keyless read-only lookup against a third
	 * party, not an operation on a Voyagr resource, so there is no resource to
	 * authorize against. It sits behind the same session auth as every other
	 * REST route.
	 */
	@Get('/places')
	async getPlaces(
		_req: unknown,
		_res: unknown,
		@Query query: { kind?: string; near?: string; q?: string },
	): Promise<PlaceResult[]> {
		const { kind, near, q } = query;

		if (!kind || !isPlaceKind(kind) || !near) return [];

		return await this.placesService.search(kind, near, q);
	}
}
```

If the `@Query` decorator's signature in this repo differs from the shape above, read another controller that uses `@Query` (for example `packages/cli/src/controllers/ai.controller.ts`) and follow that instead — the decorator, not this plan, is authoritative.

- [ ] **Step 3: Register the controller**

In `packages/cli/src/server.ts`, add a side-effect import alongside the existing block of `import '@/controllers/...'` lines:

```ts
import '@/voyagr/places/places.controller';
```

Controllers in this repo are activated by being imported here; without this line the route silently will not exist.

- [ ] **Step 4: Typecheck and verify the route responds**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/cli && pnpm typecheck
```

Expected: clean.

Then, from the repo root, build and start the server, log in, and confirm the endpoint answers:

```bash
CI=1 pnpm build:n8n > build.log 2>&1; tail -n 15 build.log
N8N_DIAGNOSTICS_ENABLED=false pnpm start > server.log 2>&1 &
```

Wait for `Editor is now accessible` in `server.log`, then authenticate and call the route:

```bash
curl -s -c /tmp/voyagr-cookies -X POST http://localhost:5678/rest/login \
  -H 'content-type: application/json' \
  -d '{"emailOrLdapLoginId":"owner@voyagr.local","password":"Voyagr1234"}' > /dev/null
curl -s -b /tmp/voyagr-cookies 'http://localhost:5678/rest/voyagr/places?kind=hotel&near=Kyoto'
```

Expected: a JSON array. **`[]` is a pass** when `VOYAGR_PLACES_KEY` is unset — that is the designed degradation, and it proves routing and auth work. Report which you got.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/voyagr/places/places.service.ts \
  packages/cli/src/voyagr/places/places.controller.ts packages/cli/src/server.ts
git commit -m "feat(voyagr): place suggestions endpoint"
```

---

### Task 5: Suggestions panel

**Files:**
- Create: `packages/frontend/editor-ui/src/features/voyagr/places/places.api.ts`
- Create: `packages/frontend/editor-ui/src/features/voyagr/places/usePlaceSearch.ts`
- Create: `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.vue`
- Create: `packages/frontend/editor-ui/src/features/voyagr/places/components/PlacesPanel.vue`
- Modify: `packages/frontend/@n8n/i18n/src/locales/en.json`

**Interfaces:**
- Consumes: `PlaceResult`, `PlaceKind` from `@n8n/api-types` (Task 1); the endpoint contract in Task 4's Interfaces block. Writes the node parameters Task 2 adds.
- Produces: `PlacesPanel.vue`, mounted by a later step in this task.

**Before starting:** invoke the `n8n:design-system` skill and read `packages/frontend/AGENTS.md`.

- [ ] **Step 1: Add the panel strings**

In `packages/frontend/@n8n/i18n/src/locales/en.json`, add these keys next to the other `workflows.item.*` entries:

```json
	"voyagr.places.title": "Suggestions near {destination}",
	"voyagr.places.search": "Search for a place",
	"voyagr.places.add": "Add to trip",
	"voyagr.places.loading": "Finding places…",
	"voyagr.places.empty": "Nothing found here yet. Try a different search.",
	"voyagr.places.unavailable": "Suggestions aren't available right now.",
	"voyagr.places.noDestination": "Set a destination on Start Trip to see suggestions.",
	"voyagr.places.ratingCount": "({count})",
```

Then run `pnpm --filter @n8n/i18n build`.

- [ ] **Step 2: Write the API client**

Create `packages/frontend/editor-ui/src/features/voyagr/places/places.api.ts`:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export async function fetchPlaces(
	context: IRestApiContext,
	params: { kind: PlaceKind; near: string; q?: string },
): Promise<PlaceResult[]> {
	return await makeRestApiRequest<PlaceResult[]>(context, 'GET', '/voyagr/places', params);
}
```

If `makeRestApiRequest`'s import path differs in this repo, match whatever an existing `*.api.ts` under `packages/frontend/editor-ui/src/features/` imports.

- [ ] **Step 3: Write the search composable**

Create `packages/frontend/editor-ui/src/features/voyagr/places/usePlaceSearch.ts`:

```ts
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { ref } from 'vue';

import { useRootStore } from '@n8n/stores/useRootStore';

import { fetchPlaces } from './places.api';

export function usePlaceSearch() {
	const rootStore = useRootStore();

	const results = ref<PlaceResult[]>([]);
	const loading = ref(false);
	const failed = ref(false);

	async function search(kind: PlaceKind, near: string, q?: string): Promise<void> {
		if (!near) {
			results.value = [];
			return;
		}

		loading.value = true;
		failed.value = false;

		try {
			results.value = await fetchPlaces(rootStore.restApiContext, { kind, near, q });
		} catch {
			// The panel is an assist, never a blocker: a failure shows a quiet
			// message and the traveller carries on typing the place by hand.
			results.value = [];
			failed.value = true;
		} finally {
			loading.value = false;
		}
	}

	return { results, loading, failed, search };
}
```

If `useRootStore`'s import path differs, match an existing composable under `packages/frontend/editor-ui/src/features/`.

- [ ] **Step 4: Write the card**

Create `packages/frontend/editor-ui/src/features/voyagr/places/components/PlaceCard.vue`:

```vue
<script setup lang="ts">
import type { PlaceResult } from '@n8n/api-types';
import { computed } from 'vue';
import { N8nButton, N8nIcon, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

const props = defineProps<{ place: PlaceResult }>();
const emit = defineEmits<{ pick: [place: PlaceResult] }>();

const i18n = useI18n();

const rating = computed(() =>
	props.place.rating === undefined ? null : props.place.rating.toFixed(1),
);

const priceTier = computed(() =>
	props.place.priceTier === undefined ? null : '$'.repeat(props.place.priceTier),
);
</script>

<template>
	<div :class="$style.card" data-test-id="place-card">
		<img v-if="place.photoUrl" :src="place.photoUrl" :alt="place.name" :class="$style.photo" />
		<div :class="$style.body">
			<N8nText bold>{{ place.name }}</N8nText>
			<div :class="$style.meta">
				<span v-if="rating" :class="$style.metaItem">
					<N8nIcon icon="star" size="small" />
					{{ rating }}
					<template v-if="place.ratingCount">
						{{ i18n.baseText('voyagr.places.ratingCount', { interpolate: { count: place.ratingCount } }) }}
					</template>
				</span>
				<span v-if="priceTier" :class="$style.metaItem">{{ priceTier }}</span>
				<span v-if="place.address" :class="$style.metaItem">{{ place.address }}</span>
			</div>
			<N8nText v-if="place.blurb" size="small" color="text-light" :class="$style.blurb">
				{{ place.blurb }}
			</N8nText>
			<N8nButton size="small" variant="outline" @click="emit('pick', place)">
				{{ i18n.baseText('voyagr.places.add') }}
			</N8nButton>
		</div>
	</div>
</template>

<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding: var(--spacing--xs);
	border: var(--border);
	border-radius: var(--radius--2xs);
	background-color: var(--background--surface);
}

.photo {
	width: 100%;
	height: 120px;
	object-fit: cover;
	border-radius: var(--radius--2xs);
}

.body {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
}

.meta {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
}

.metaItem {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
}

.blurb {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
```

Confirm `star` is present in `updatedIconSet` before using it; if it is not, pick a present alternative and say which in your report.

- [ ] **Step 5: Write the panel**

Create `packages/frontend/editor-ui/src/features/voyagr/places/components/PlacesPanel.vue`:

```vue
<script setup lang="ts">
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { ref, watch } from 'vue';
import { N8nInput, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import PlaceCard from './PlaceCard.vue';
import { usePlaceSearch } from '../usePlaceSearch';

const props = defineProps<{ kind: PlaceKind; destination: string }>();
const emit = defineEmits<{ pick: [place: PlaceResult] }>();

const i18n = useI18n();
const { results, loading, failed, search } = usePlaceSearch();

const query = ref('');

watch(
	() => [props.kind, props.destination] as const,
	async () => await search(props.kind, props.destination, query.value),
	{ immediate: true },
);

async function onSearch(): Promise<void> {
	await search(props.kind, props.destination, query.value);
}
</script>

<template>
	<aside :class="$style.panel" data-test-id="places-panel">
		<N8nText bold :class="$style.title">
			{{ i18n.baseText('voyagr.places.title', { interpolate: { destination } }) }}
		</N8nText>

		<N8nInput
			v-model="query"
			:placeholder="i18n.baseText('voyagr.places.search')"
			size="small"
			@keyup.enter="onSearch"
		/>

		<N8nText v-if="!destination" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.noDestination') }}
		</N8nText>
		<N8nText v-else-if="loading" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.loading') }}
		</N8nText>
		<N8nText v-else-if="failed" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.unavailable') }}
		</N8nText>
		<N8nText v-else-if="results.length === 0" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.empty') }}
		</N8nText>

		<div v-else :class="$style.results">
			<PlaceCard
				v-for="place in results"
				:key="place.providerId"
				:place="place"
				@pick="emit('pick', $event)"
			/>
		</div>
	</aside>
</template>

<style lang="scss" module>
.panel {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	width: 320px;
	height: 100%;
	padding: var(--spacing--s);
	overflow-y: auto;
	border-right: var(--border);
	background-color: var(--background--surface);
}

.title {
	position: sticky;
	top: 0;
}

.results {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}
</style>
```

- [ ] **Step 6: Mount the panel and wire the pick**

The panel appears while a place node's detail view is open, docked to the left of the canvas.

Find the component that renders the node detail view (search `packages/frontend/editor-ui/src/features/ndv/` for the root NDV component). In it:

1. Map the active node's type to a `PlaceKind`, rendering the panel only for the six that map:

```ts
const NODE_TYPE_TO_PLACE_KIND: Record<string, PlaceKind> = {
	'n8n-nodes-base.hotel': 'hotel',
	'n8n-nodes-base.restaurant': 'restaurant',
	'n8n-nodes-base.cafe': 'cafe',
	'n8n-nodes-base.touristDestination': 'attraction',
	'n8n-nodes-base.activity': 'activity',
	'n8n-nodes-base.shopping': 'shopping',
};
```

2. Read the destination from the trip's Start Trip node — find the node whose `type` is `n8n-nodes-base.tripStart` in the workflows store and read `parameters.destination`.

3. On `pick`, write the chosen place into the active node's parameters. Every kind gets `placeId` (the `providerId`), `rating`, `priceTier` and `photoUrl`, and `location` takes the place's `address`. The headline name field differs per node — these are the verified parameter names:

```ts
const KIND_TO_NAME_PARAM: Record<PlaceKind, string> = {
	hotel: 'hotelName',
	restaurant: 'restaurantName',
	cafe: 'name',
	attraction: 'placeName',
	activity: 'name',
	shopping: 'name',
};
```

Use the same store action the node's own form uses to update parameters, so undo history and the dirty flag behave normally.

Report exactly which file you mounted it in and which store action you used.

- [ ] **Step 7: Typecheck and lint**

```bash
cd /Users/aibelbinzacariah/Documents/Code/Voyagr/packages/frontend/editor-ui
pnpm typecheck && pnpm lint
```

Expected: clean apart from the pre-existing `viewsData.ts` errors.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/editor-ui/src/features/voyagr/places \
  packages/frontend/@n8n/i18n/src/locales/en.json
git commit -m "feat(voyagr): place suggestions panel"
```

---

### Task 6: Build, verify, document

**Files:**
- Modify: `docs/VOYAGR.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a verified running instance.

This is the **single verification pass** for the whole plan. No earlier task performs an end-to-end check.

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

Drive headless **system** Chrome — the bundled chromium is version-mismatched and will not launch:

```js
chromium.launch({ headless: true, channel: 'chrome' })
```

Work from `packages/testing/playwright`. Put throwaway scripts and screenshots in a temp directory, **not** in the repo. Log in as `owner@voyagr.local` / `Voyagr1234`.

Check and report PASS/FAIL with what you saw:

1. Start Trip has a **Destination** field, and setting it persists after save.
2. Opening a Hotel node shows the suggestions panel docked left.
3. With no `VOYAGR_PLACES_KEY` set, the panel shows the quiet unavailable/empty message — **not** an error, a stack trace, or a broken layout.
4. The six hidden provider fields do not appear in any node's form.
5. Nothing else on the canvas regressed.

If a `VOYAGR_PLACES_KEY` is available, set it, restart, and additionally confirm cards render with photo, rating and price tier, and that picking one fills the node.

Read the screenshot back with the Read tool and judge it visually, not just via DOM text.

- [ ] **Step 4: Record it in the project notes**

Add to `docs/VOYAGR.md` section 2 ("What's done"), matching the existing style:

```markdown
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
```

Add to section 5 ("Gotchas"):

```markdown
- **Place suggestions degrade silently.** No key, spent quota, or an unreachable
  provider all return `[]` from `/rest/voyagr/places` and render one quiet empty
  state. Never surface a provider error to a traveller.
```

- [ ] **Step 5: Commit**

```bash
git add docs/VOYAGR.md
git commit -m "docs: record place connectors in project status"
```

---

## Notes for the implementer

- **The Foursquare request shape in Task 3 may be stale.** Step 1 of that task exists precisely to catch that — verify before implementing, and adjust field names rather than forcing the response into the shape written here.
- **Deliberate deviations from the spec**, both for tractability: the cache is in-memory rather than a DB table (a migration is heavy machinery for a cache, and this runs as one process), and the panel is a left-docked overlay rather than a modification of n8n's node-creator component (same visual position, far less invasive).
- **Out of scope, do not add:** real nightly rates, availability, booking, flight or train search, per-node dates, multi-city trips.
