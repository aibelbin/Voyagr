import { priceTierCost } from '../price-tier-cost';

describe('priceTierCost', () => {
	it.each([
		['hotel', 1, { pricePerNight: 60 }],
		['hotel', 2, { pricePerNight: 120 }],
		['hotel', 3, { pricePerNight: 220 }],
		['hotel', 4, { pricePerNight: 400 }],
		['restaurant', 1, { avgCost: 12 }],
		['restaurant', 2, { avgCost: 25 }],
		['restaurant', 3, { avgCost: 50 }],
		['restaurant', 4, { avgCost: 100 }],
		['cafe', 1, { avgCost: 5 }],
		['cafe', 4, { avgCost: 25 }],
		['attraction', 1, { entryFee: 8 }],
		['attraction', 4, { entryFee: 60 }],
		['activity', 1, { price: 15 }],
		['activity', 4, { price: 120 }],
		['shopping', 1, { budget: 20 }],
		['shopping', 4, { budget: 300 }],
	] as const)('prices a tier %s %s stop', (kind, tier, expected) => {
		expect(priceTierCost(kind, tier)).toEqual(expected);
	});

	it('produces no cost field for a missing tier', () => {
		// The settled product rule: an unpriced stop renders no chip, never a zero.
		expect(priceTierCost('hotel', undefined)).toEqual({});
	});

	it('produces no cost field for an unrecognised tier', () => {
		// Defensive against data that slips past the `1 | 2 | 3 | 4` type, e.g. a
		// provider bug or a future Google tier this table doesn't know yet.
		expect(priceTierCost('hotel', 0 as unknown as 1)).toEqual({});
		expect(priceTierCost('hotel', 5 as unknown as 1)).toEqual({});
	});

	/**
	 * Cross-checked by hand against the `FORMULAS` table in
	 * packages/frontend/editor-ui/src/features/voyagr/budget/tripCost.ts — a
	 * mismatched key here would silently price a stop at zero rather than fail
	 * loudly, which is exactly the bug this module fixes.
	 */
	it.each([
		['hotel', 'pricePerNight'],
		['restaurant', 'avgCost'],
		['cafe', 'avgCost'],
		['attraction', 'entryFee'],
		['activity', 'price'],
		['shopping', 'budget'],
	] as const)('writes %s cost onto the %s parameter tripCost.ts reads', (kind, param) => {
		expect(Object.keys(priceTierCost(kind, 2))).toEqual([param]);
	});
});
