import type { GeneratedTripOption, PlaceResult } from '@n8n/api-types';

// Reaches across into the frontend package on purpose: this is the same pure
// cost function the budget pill and node chips call, so pricing a generated
// stop through it proves the wiring end to end rather than re-asserting a
// hardcoded expectation that could drift from the real formula.
import { nodeCost } from '../../../../../frontend/editor-ui/src/features/voyagr/budget/tripCost';
import { buildTripWorkflow } from '../build-trip-workflow';

const params = {
	startLocation: 'Home',
	destination: 'Kyoto',
	startDate: '2026-09-12T09:00:00',
	endDate: '2026-09-19T09:00:00',
	budget: 3000,
	currency: 'USD',
	travellers: 2,
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

	it('writes the party size onto the trigger so per-person costs price correctly', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);

		const trigger = nodes.find((node) => node.type === 'n8n-nodes-base.tripStart');

		expect(trigger?.parameters).toMatchObject({ travellers: 2 });
	});

	it('writes a cost that prices non-zero through the same formula the budget pill uses', () => {
		const { nodes } = buildTripWorkflow(params, options, placesById);
		const hotel = nodes.find((node) => node.name === 'Granbell');

		expect(hotel?.parameters.pricePerNight).toBe(120);
		expect(nodeCost(hotel!.type, hotel!.parameters, params.travellers)).toBe(120);
	});

	it('writes no cost field when the place has no price tier', () => {
		const untiered: PlaceResult = { ...place('fsq:4', 'Untiered Inn'), priceTier: undefined };
		const withUntiered = new Map(placesById).set('fsq:4', untiered);
		const optionsWithUntiered: GeneratedTripOption[] = [
			{
				name: 'No signal',
				rationale: 'Place carries no price tier.',
				stops: [{ providerId: 'fsq:4', kind: 'hotel', dayOffset: 0 }],
			},
		];

		const { nodes } = buildTripWorkflow(params, optionsWithUntiered, withUntiered);
		const hotel = nodes.find((node) => node.name === 'Untiered Inn');

		expect(hotel?.parameters.pricePerNight).toBeUndefined();
		expect(nodeCost(hotel!.type, hotel!.parameters, params.travellers)).toBe(0);
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
