import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { createComponentRenderer } from '@/__tests__/render';

import { formatTripMoney } from '../../tripFormatting';
import type { TripBudgetBranch } from '../tripBudget';

const budget = ref(0);
const currency = ref('USD');
const branches = ref<TripBudgetBranch[]>([]);

vi.mock('../useTripBudget', () => ({
	useTripBudget: () => ({ budget, currency, branches }),
}));

import TripBudgetPill from './TripBudgetPill.vue';

const renderComponent = createComponentRenderer(TripBudgetPill);

describe('TripBudgetPill', () => {
	it('renders no pill when nothing is priced', () => {
		branches.value = [{ index: 1, total: 0 }];
		budget.value = 1000;
		currency.value = 'USD';

		const { queryByTestId } = renderComponent();

		expect(queryByTestId('trip-budget-pill')).toBeNull();
	});

	it('suppresses a zero-total branch while its priced siblings still render under their own option number', () => {
		// A three-option AI plan where only options 2 and 3 have anything priced.
		branches.value = [
			{ index: 1, total: 0 },
			{ index: 2, total: 300 },
			{ index: 3, total: 450 },
		];
		budget.value = 1000;
		currency.value = 'USD';

		const { getByTestId, getByText, queryByText, container } = renderComponent();

		expect(getByTestId('trip-budget-pill')).toBeVisible();
		// Only the two priced branches render.
		expect(container.querySelectorAll('progress')).toHaveLength(2);
		// Surviving labels keep their own upstream index, not their position
		// among the survivors.
		expect(queryByText('Option 1')).toBeNull();
		expect(getByText('Option 2')).toBeVisible();
		expect(getByText('Option 3')).toBeVisible();
	});

	it('keeps the Option label for a lone survivor among unpriced siblings', () => {
		// A three-option AI plan where only option 2 has anything priced yet.
		branches.value = [
			{ index: 1, total: 0 },
			{ index: 2, total: 300 },
			{ index: 3, total: 0 },
		];
		budget.value = 1000;
		currency.value = 'USD';

		const { getByTestId, getByText, queryByText, container } = renderComponent();

		expect(getByTestId('trip-budget-pill')).toBeVisible();
		// Only the one priced branch renders.
		expect(container.querySelectorAll('progress')).toHaveLength(1);
		// The label is gated on the total branch count (3), not the surviving
		// segment count (1), so the lone survivor still reads its true
		// upstream index rather than going unlabelled.
		expect(getByText('Option 2')).toBeVisible();
		expect(queryByText('Option 1')).toBeNull();
		expect(queryByText('Option 3')).toBeNull();
	});

	it.each([0, -100])(
		'shows the planned total and no-budget notice when the budget is unset (%i)',
		(unsetBudget) => {
			branches.value = [{ index: 1, total: 300 }];
			budget.value = unsetBudget;
			currency.value = 'USD';

			const { getByText, queryByText } = renderComponent();

			expect(getByText(`${formatTripMoney(300, 'USD')} planned`)).toBeVisible();
			expect(getByText('No budget set')).toBeVisible();
			// No percentage-style "spent of budget" phrasing when there's no budget.
			expect(queryByText(/ of /)).toBeNull();
		},
	);

	it('treats a branch exactly at budget as within budget, not over', () => {
		branches.value = [{ index: 1, total: 500 }];
		budget.value = 500;
		currency.value = 'USD';

		const { getByText, queryByText } = renderComponent();

		expect(getByText(`${formatTripMoney(0, 'USD')} left`)).toBeVisible();
		expect(queryByText(/over/)).toBeNull();
	});

	it('only reports over-budget once a branch total actually exceeds the budget', () => {
		branches.value = [{ index: 1, total: 600 }];
		budget.value = 500;
		currency.value = 'USD';

		const { getByText } = renderComponent();

		expect(getByText(`${formatTripMoney(100, 'USD')} over`)).toBeVisible();
	});

	it('omits the Option label for a single-branch trip', () => {
		branches.value = [{ index: 1, total: 300 }];
		budget.value = 1000;
		currency.value = 'USD';

		const { queryByText, getByTestId } = renderComponent();

		expect(getByTestId('trip-budget-pill')).toBeVisible();
		expect(queryByText(/Option/)).toBeNull();
	});
});
