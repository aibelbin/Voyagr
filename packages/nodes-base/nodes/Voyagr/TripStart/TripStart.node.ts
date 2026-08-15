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
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const manualTriggerFunction = async () => {
			this.emit([this.helpers.returnJsonArray([{}])]);
		};
		return { manualTriggerFunction };
	}
}
