import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
export class Activity implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Activity', name: 'activity', icon: 'file:activity.svg', group: ['transform'], version: 1,
		description: 'An experience, tour or activity', defaults: { name: 'Activity' },
		inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '', placeholder: 'Cooking class' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '' },
			{ displayName: 'Type', name: 'kind', type: 'options', default: 'tour', options: [
				{ name: 'Tour', value: 'tour' }, { name: 'Class', value: 'class' }, { name: 'Adventure', value: 'adventure' },
				{ name: 'Nightlife', value: 'nightlife' }, { name: 'Show', value: 'show' } ] },
			{ displayName: 'Price', name: 'price', type: 'number', default: 0 },
			{ displayName: 'Duration (hours)', name: 'durationHours', type: 'number', default: 2 },
			{ displayName: 'Place ID', name: 'placeId', type: 'hidden', default: '' },
			{ displayName: 'Rating', name: 'rating', type: 'hidden', default: 0 },
			{ displayName: 'Price Tier', name: 'priceTier', type: 'hidden', default: 0 },
			{ displayName: 'Photo URL', name: 'photoUrl', type: 'hidden', default: '' },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData(); const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) out.push({ json: {
			kind: 'activity', name: this.getNodeParameter('name', i, '') as string, location: this.getNodeParameter('location', i, '') as string,
			type: this.getNodeParameter('kind', i, 'tour') as string, price: this.getNodeParameter('price', i, 0) as number,
			durationHours: this.getNodeParameter('durationHours', i, 2) as number,
			placeId: this.getNodeParameter('placeId', i, '') as string, rating: this.getNodeParameter('rating', i, 0) as number,
			priceTier: this.getNodeParameter('priceTier', i, 0) as number, photoUrl: this.getNodeParameter('photoUrl', i, '') as string }, pairedItem: { item: i } });
		return [out];
	}
}
