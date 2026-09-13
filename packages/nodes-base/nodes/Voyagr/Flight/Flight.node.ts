import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class Flight implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flight',
		name: 'flight',
		icon: 'file:flight.svg',
		group: ['transform'],
		version: 1,
		description: 'A flight leg in your itinerary',
		defaults: { name: 'Flight' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Airline', name: 'airline', type: 'string', default: '', placeholder: 'ITA Airways' },
			{ displayName: 'From', name: 'from', type: 'string', default: '', placeholder: 'JFK' },
			{ displayName: 'To', name: 'to', type: 'string', default: '', placeholder: 'FCO' },
			{ displayName: 'Departure', name: 'departure', type: 'dateTime', default: '' },
			{ displayName: 'Price per Person', name: 'price', type: 'number', default: 0 },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) {
			out.push({
				json: {
					kind: 'flight',
					airline: this.getNodeParameter('airline', i, '') as string,
					from: this.getNodeParameter('from', i, '') as string,
					to: this.getNodeParameter('to', i, '') as string,
					departure: this.getNodeParameter('departure', i, '') as string,
					price: this.getNodeParameter('price', i, 0) as number,
				},
				pairedItem: { item: i },
			});
		}
		return [out];
	}
}
