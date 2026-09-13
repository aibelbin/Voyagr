import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class TouristDestination implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tourist Destination',
		name: 'touristDestination',
		icon: 'file:destination.svg',
		group: ['transform'],
		version: 1,
		description: 'A place to visit — attraction, landmark or sight',
		defaults: { name: 'Tourist Destination' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Place Name', name: 'placeName', type: 'string', default: '', placeholder: 'Colosseum' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '', placeholder: 'Rome, Italy' },
			{
				displayName: 'Category', name: 'category', type: 'options', default: 'landmark',
				options: [
					{ name: 'Landmark', value: 'landmark' }, { name: 'Museum', value: 'museum' },
					{ name: 'Nature', value: 'nature' }, { name: 'Beach', value: 'beach' },
					{ name: 'Religious Site', value: 'religious' }, { name: 'Other', value: 'other' },
				],
			},
			{ displayName: 'Entry Fee', name: 'entryFee', type: 'number', default: 0 },
			{ displayName: 'Visit Duration (hours)', name: 'visitHours', type: 'number', default: 2 },
			{ displayName: 'Place ID', name: 'placeId', type: 'hidden', default: '' },
			{ displayName: 'Rating', name: 'rating', type: 'hidden', default: 0 },
			{ displayName: 'Price Tier', name: 'priceTier', type: 'hidden', default: 0 },
			{ displayName: 'Photo URL', name: 'photoUrl', type: 'hidden', default: '' },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) {
			out.push({
				json: {
					kind: 'destination',
					name: this.getNodeParameter('placeName', i, '') as string,
					location: this.getNodeParameter('location', i, '') as string,
					category: this.getNodeParameter('category', i, 'landmark') as string,
					entryFee: this.getNodeParameter('entryFee', i, 0) as number,
					visitHours: this.getNodeParameter('visitHours', i, 2) as number,
					placeId: this.getNodeParameter('placeId', i, '') as string,
					rating: this.getNodeParameter('rating', i, 0) as number,
					priceTier: this.getNodeParameter('priceTier', i, 0) as number,
					photoUrl: this.getNodeParameter('photoUrl', i, '') as string,
				},
				pairedItem: { item: i },
			});
		}
		return [out];
	}
}
