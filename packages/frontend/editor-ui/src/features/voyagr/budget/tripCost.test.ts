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
