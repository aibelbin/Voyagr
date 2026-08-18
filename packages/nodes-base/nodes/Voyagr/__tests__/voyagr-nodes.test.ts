import type { IDataObject, INodeProperties, ITriggerFunctions } from 'n8n-workflow';

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

	it('emits the party size alongside the rest of the trip context', async () => {
		const tripParameters: IDataObject = {
			startLocation: 'Home',
			destination: 'Kyoto, Japan',
			startDate: '2026-01-01',
			endDate: '2026-01-10',
			budget: 2000,
			currency: 'USD',
			travellers: 4,
		};

		const emitSpy = vi.fn<ITriggerFunctions['emit']>();
		const context = {
			getNodeParameter: vi.fn<ITriggerFunctions['getNodeParameter']>((name) => tripParameters[name]),
			emit: emitSpy,
			helpers: {
				returnJsonArray: (data: IDataObject[]) => data.map((json) => ({ json })),
			},
		} as unknown as ITriggerFunctions;

		const { manualTriggerFunction } = await new TripStart().trigger.call(context);
		await manualTriggerFunction?.();

		expect(emitSpy).toHaveBeenCalledTimes(1);
		const [emittedOutput] = emitSpy.mock.calls[0][0];
		const [emittedItem] = emittedOutput;

		expect(emittedItem.json).toMatchObject(tripParameters);
		expect(emittedItem.json.travellers).toBe(4);
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
