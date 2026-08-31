import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { createComponentRenderer } from '@/__tests__/render';

const budget = ref(0);
const currency = ref('USD');
const costByNodeId = ref(new Map<string, number>());

vi.mock('../useTripBudget', () => ({
	useTripBudget: () => ({ budget, currency, costByNodeId }),
}));

import NodeBudgetChip from './NodeBudgetChip.vue';

const renderComponent = createComponentRenderer(NodeBudgetChip, {
	props: { nodeId: 'node-1' },
});

describe('NodeBudgetChip', () => {
	it('renders nothing for a stop with no cost', () => {
		costByNodeId.value = new Map([['node-1', 0]]);
		budget.value = 1000;
		currency.value = 'USD';

		const { queryByTestId } = renderComponent();

		expect(queryByTestId('node-budget-chip')).toBeNull();
	});

	it('shows the amount alone when there is no trip budget to compare against', () => {
		costByNodeId.value = new Map([['node-1', 250]]);
		budget.value = 0;
		currency.value = 'USD';

		const { getByTestId } = renderComponent();

		expect(getByTestId('node-budget-chip')).toHaveTextContent('$250');
	});

	it('shows the amount and its share of the trip budget', () => {
		costByNodeId.value = new Map([['node-1', 250]]);
		budget.value = 1000;
		currency.value = 'USD';

		const { getByTestId } = renderComponent();

		expect(getByTestId('node-budget-chip')).toHaveTextContent('$250 · 25%');
	});

	it('still renders the amount when Start Trip carries a malformed currency', () => {
		// e.g. an unresolved expression or free text pasted into imported
		// workflow JSON — this must not throw during canvas render.
		costByNodeId.value = new Map([['node-1', 250]]);
		budget.value = 1000;
		currency.value = '={{ $json.currency }}';

		const { getByTestId } = renderComponent();

		expect(getByTestId('node-budget-chip')).toHaveTextContent('250 · 25%');
	});
});
