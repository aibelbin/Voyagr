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
