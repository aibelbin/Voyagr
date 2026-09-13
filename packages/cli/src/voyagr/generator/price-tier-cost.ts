import type { PlaceKind, PlaceResult } from '@n8n/api-types';

/**
 * Turns a place's Google price tier into a rough cost estimate, so a
 * generated stop carries a price without an extra AI call.
 *
 * By the time a tier reaches this module it has already been normalised to
 * `1 | 2 | 3 | 4` by `GooglePlacesProvider` (see
 * `packages/cli/src/voyagr/places/google-places.provider.ts`) — the raw
 * `PRICE_LEVEL_*` strings Google returns, including `PRICE_LEVEL_FREE`, never
 * reach here; a free place simply has no tier at all, same as an unknown one.
 *
 * Amounts are nominal in whatever currency the trip was planned in — this is
 * a 4-bucket signal turned into a round number, not a currency conversion.
 *
 * Pure and deterministic — a lookup table, nothing else.
 */

type Tier = 1 | 2 | 3 | 4;

function isTier(value: number): value is Tier {
	return value === 1 || value === 2 || value === 3 || value === 4;
}

/** One row per generated kind, tiers 1-4 in order. Coarse, round numbers. */
const COST_BY_TIER: Record<PlaceKind, readonly [number, number, number, number]> = {
	hotel: [60, 120, 220, 400],
	restaurant: [12, 25, 50, 100],
	cafe: [5, 8, 15, 25],
	attraction: [8, 15, 30, 60],
	activity: [15, 30, 60, 120],
	shopping: [20, 50, 120, 300],
};

/**
 * The parameter each kind's node is priced on, matching the formulas in
 * `packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.ts`
 * exactly. A mismatch here doesn't throw — it silently prices the stop at
 * zero, which is the bug this module exists to fix.
 */
const COST_PARAM_BY_KIND: Record<PlaceKind, string> = {
	hotel: 'pricePerNight',
	restaurant: 'avgCost',
	cafe: 'avgCost',
	attraction: 'entryFee',
	activity: 'price',
	shopping: 'budget',
};

/**
 * Estimates a cost for a stop from its price tier, on the parameter name its
 * node type is priced on. A missing or unrecognised tier returns an empty
 * object rather than a zero or a guess — the product rule is that an
 * unpriced stop renders no cost chip.
 */
export function priceTierCost(
	kind: PlaceKind,
	priceTier: PlaceResult['priceTier'],
): Record<string, number> {
	if (priceTier === undefined || !isTier(priceTier)) return {};

	return { [COST_PARAM_BY_KIND[kind]]: COST_BY_TIER[kind][priceTier - 1] };
}
