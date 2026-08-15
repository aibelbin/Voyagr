import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
export class Cafe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cafe', name: 'cafe', icon: 'file:cafe.svg', group: ['transform'], version: 1,
		description: 'A coffee or quick stop', defaults: { name: 'Cafe' },
		inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '', placeholder: 'Sant Eustachio' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '' },
			{ displayName: 'Specialty', name: 'specialty', type: 'string', default: '', placeholder: 'Espresso' },
			{ displayName: 'Avg Cost per Person', name: 'avgCost', type: 'number', default: 0 },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData(); const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) out.push({ json: {
			kind: 'cafe', name: this.getNodeParameter('name', i, '') as string, location: this.getNodeParameter('location', i, '') as string,
			specialty: this.getNodeParameter('specialty', i, '') as string, avgCost: this.getNodeParameter('avgCost', i, 0) as number }, pairedItem: { item: i } });
		return [out];
	}
}
