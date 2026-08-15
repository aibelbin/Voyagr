import type {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class TripStart implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Start Trip',
		name: 'tripStart',
		icon: 'file:tripstart.svg',
		iconColor: 'blue',
		group: ['trigger'],
		version: 1,
		description: 'The starting point of your trip itinerary',
		eventTriggerDescription: '',
		maxNodes: 1,
		defaults: {
			name: 'Start Trip',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName:
					'This is where your itinerary begins. Add travel steps after it — hotels, destinations, food and transport — then click <strong>Plan trip</strong> to build the plan.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Starting From',
				name: 'startLocation',
				type: 'string',
				default: 'Home',
				placeholder: 'Home',
				description: 'Where the trip begins',
			},
			{
				displayName: 'Destination',
				name: 'destination',
				type: 'string',
				default: '',
				placeholder: 'Kyoto, Japan',
				description: 'Where the trip is going. Suggestions for every stop are based on this.',
			},
			{
				displayName: 'Trip Starts',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'The day you leave',
			},
			{
				displayName: 'Trip Ends',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'The day you get back',
			},
			{
				displayName: 'Budget',
				name: 'budget',
				type: 'number',
				default: 0,
				description: 'Total budget for the trip',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'options',
				default: 'USD',
				options: [
					{ name: 'Australian Dollar (AUD)', value: 'AUD' },
					{ name: 'British Pound (GBP)', value: 'GBP' },
					{ name: 'Canadian Dollar (CAD)', value: 'CAD' },
					{ name: 'Euro (EUR)', value: 'EUR' },
					{ name: 'Indian Rupee (INR)', value: 'INR' },
					{ name: 'Japanese Yen (JPY)', value: 'JPY' },
					{ name: 'UAE Dirham (AED)', value: 'AED' },
					{ name: 'US Dollar (USD)', value: 'USD' },
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const manualTriggerFunction = async () => {
			this.emit([
				this.helpers.returnJsonArray([
					{
						startLocation: this.getNodeParameter('startLocation', '') as string,
						destination: this.getNodeParameter('destination', '') as string,
						startDate: this.getNodeParameter('startDate', '') as string,
						endDate: this.getNodeParameter('endDate', '') as string,
						budget: this.getNodeParameter('budget', 0) as number,
						currency: this.getNodeParameter('currency', 'USD') as string,
					},
				]),
			]);
		};
		return { manualTriggerFunction };
	}
}
