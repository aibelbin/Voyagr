import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class Hotel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hotel',
		name: 'hotel',
		icon: 'file:hotel.svg',
		group: ['transform'],
		version: 1,
		description: 'A hotel stay in your itinerary',
		defaults: { name: 'Hotel' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Hotel Name', name: 'hotelName', type: 'string', default: '', placeholder: 'Hotel Artemide' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '', placeholder: 'Rome, Italy' },
			{ displayName: 'Check-in', name: 'checkIn', type: 'dateTime', default: '' },
			{ displayName: 'Nights', name: 'nights', type: 'number', default: 1 },
			{ displayName: 'Price per Night', name: 'pricePerNight', type: 'number', default: 0 },
			{
				displayName: 'Star Rating', name: 'starRating', type: 'options', default: 3,
				options: [
					{ name: '1 Star', value: 1 }, { name: '2 Stars', value: 2 }, { name: '3 Stars', value: 3 },
					{ name: '4 Stars', value: 4 }, { name: '5 Stars', value: 5 },
				],
			},
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
					kind: 'hotel',
					name: this.getNodeParameter('hotelName', i, '') as string,
					location: this.getNodeParameter('location', i, '') as string,
					checkIn: this.getNodeParameter('checkIn', i, '') as string,
					nights: this.getNodeParameter('nights', i, 1) as number,
					pricePerNight: this.getNodeParameter('pricePerNight', i, 0) as number,
					starRating: this.getNodeParameter('starRating', i, 3) as number,
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
