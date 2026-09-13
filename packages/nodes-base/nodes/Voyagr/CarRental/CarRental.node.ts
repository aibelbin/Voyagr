import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class CarRental implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Car Rental',
		name: 'carRental',
		icon: 'file:car.svg',
		group: ['transform'],
		version: 1,
		description: 'A rental car in your itinerary',
		defaults: { name: 'Car Rental' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Company', name: 'company', type: 'string', default: '', placeholder: 'Hertz' },
			{ displayName: 'Pickup Location', name: 'pickupLocation', type: 'string', default: '', placeholder: 'FCO Airport' },
			{ displayName: 'Price per Day', name: 'pricePerDay', type: 'number', default: 0 },
			{ displayName: 'Days', name: 'days', type: 'number', default: 1 },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) {
			out.push({
				json: {
					kind: 'carRental',
					company: this.getNodeParameter('company', i, '') as string,
					pickupLocation: this.getNodeParameter('pickupLocation', i, '') as string,
					pricePerDay: this.getNodeParameter('pricePerDay', i, 0) as number,
					days: this.getNodeParameter('days', i, 1) as number,
				},
				pairedItem: { item: i },
			});
		}
		return [out];
	}
}
