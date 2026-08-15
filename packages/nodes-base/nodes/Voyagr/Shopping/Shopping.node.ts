import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
export class Shopping implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Shopping', name: 'shopping', icon: 'file:shopping.svg', group: ['transform'], version: 1,
		description: 'A shopping stop', defaults: { name: 'Shopping' },
		inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		properties: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '', placeholder: 'Via del Corso' },
			{ displayName: 'Location', name: 'location', type: 'string', default: '' },
			{ displayName: 'Type', name: 'kind', type: 'options', default: 'market', options: [
				{ name: 'Market', value: 'market' }, { name: 'Mall', value: 'mall' }, { name: 'Boutique', value: 'boutique' }, { name: 'Souvenirs', value: 'souvenirs' } ] },
			{ displayName: 'Budget', name: 'budget', type: 'number', default: 0 },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData(); const out: INodeExecutionData[] = [];
		for (let i = 0; i < Math.max(items.length, 1); i++) out.push({ json: {
			kind: 'shopping', name: this.getNodeParameter('name', i, '') as string, location: this.getNodeParameter('location', i, '') as string,
			type: this.getNodeParameter('kind', i, 'market') as string, budget: this.getNodeParameter('budget', i, 0) as number }, pairedItem: { item: i } });
		return [out];
	}
}
