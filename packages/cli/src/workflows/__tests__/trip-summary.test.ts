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
