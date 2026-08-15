import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class Restaurant implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Restaurant',
		name: 'restaurant',
		icon: 'file:restaurant.svg',
		group: ['transform'],
		version: 1,
		description: 'A meal or dining stop in your itinerary',
		defaults: { name: 'Restaurant' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Restaurant Name', name: 'restaurantName', type: 'string', default: '', placeholder: 'Trattoria da Enzo' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '', placeholder: 'Trastevere, Rome' },
			{ displayName: 'Cuisine', name: 'cuisine', type: 'string', default: '', placeholder: 'Italian' },
			{
				displayName: 'Meal', name: 'mealType', type: 'options', default: 'dinner',
				options: [
					{ name: 'Breakfast', value: 'breakfast' }, { name: 'Lunch', value: 'lunch' },
					{ name: 'Dinner', value: 'dinner' }, { name: 'Snack', value: 'snack' },
				],
			},
			{ displayName: 'Avg Cost per Person', name: 'avgCost', type: 'number', default: 0 },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) {
			out.push({
				json: {
					kind: 'restaurant',
					name: this.getNodeParameter('restaurantName', i, '') as string,
					location: this.getNodeParameter('location', i, '') as string,
					cuisine: this.getNodeParameter('cuisine', i, '') as string,
					mealType: this.getNodeParameter('mealType', i, 'dinner') as string,
					avgCost: this.getNodeParameter('avgCost', i, 0) as number,
				},
				pairedItem: { item: i },
			});
		}
		return [out];
	}
}
