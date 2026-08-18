import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
export class Ferry implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ferry', name: 'ferry', icon: 'file:ferry.svg', group: ['transform'], version: 1,
		description: 'A ferry or boat crossing', defaults: { name: 'Ferry' },
		inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Operator', name: 'operator', type: 'string', default: '' },
			{ displayName: 'From', name: 'from', type: 'string', default: '' },
			{ displayName: 'To', name: 'to', type: 'string', default: '' },
			{ displayName: 'Departure', name: 'departure', type: 'dateTime', default: '' },
			{ displayName: 'Price per Person', name: 'price', type: 'number', default: 0 },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData(); const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) out.push({ json: {
			kind: 'ferry', operator: this.getNodeParameter('operator', i, '') as string, from: this.getNodeParameter('from', i, '') as string,
			to: this.getNodeParameter('to', i, '') as string, departure: this.getNodeParameter('departure', i, '') as string,
			price: this.getNodeParameter('price', i, 0) as number }, pairedItem: { item: i } });
		return [out];
	}
}
