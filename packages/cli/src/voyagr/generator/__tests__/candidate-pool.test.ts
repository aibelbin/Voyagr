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
