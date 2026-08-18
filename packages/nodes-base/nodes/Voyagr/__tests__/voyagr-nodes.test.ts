import type { INodeProperties } from 'n8n-workflow';

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
