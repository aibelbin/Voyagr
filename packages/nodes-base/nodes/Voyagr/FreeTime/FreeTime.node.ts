import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
export class FreeTime implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Free Time', name: 'freeTime', icon: 'file:freetime.svg', group: ['transform'], version: 1,
		description: 'Unscheduled or rest time', defaults: { name: 'Free Time' },
		inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Label', name: 'label', type: 'string', default: 'Free time', placeholder: 'Relax at the hotel' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '' },
			{ displayName: 'Duration (hours)', name: 'durationHours', type: 'number', default: 2 },
			{ displayName: 'Notes', name: 'notes', type: 'string', default: '' },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData(); const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) out.push({ json: {
			kind: 'freeTime', label: this.getNodeParameter('label', i, '') as string, location: this.getNodeParameter('location', i, '') as string,
			durationHours: this.getNodeParameter('durationHours', i, 2) as number, notes: this.getNodeParameter('notes', i, '') as string }, pairedItem: { item: i } });
		return [out];
	}
}
