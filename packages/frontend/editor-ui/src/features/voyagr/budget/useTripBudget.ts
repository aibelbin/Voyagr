import { computed } from 'vue';

import { injectWorkflowDocumentStore } from '@/app/stores/workflowDocument.store';

import { computeTripBudget } from './tripBudget';

/**
 * The trip's budget, live off the workflow document, so a chip updates as the
 * traveller types a price.
 *
 * Deliberately not routed through `useWorkflowDocumentRenderData`'s
 * `*ByNodeId` maps: those live in a core n8n store, and a Voyagr-only
 * projection there is fork surface we would carry through every merge.
 */
export function useTripBudget() {
	const workflowDocumentStore = injectWorkflowDocumentStore();

	const budget = computed(() =>
		computeTripBudget(
			workflowDocumentStore.value.allNodes,
			workflowDocumentStore.value.connectionsBySourceNode,
		),
	);

	return {
		budget: computed(() => budget.value.budget),
		currency: computed(() => budget.value.currency),
		costByNodeId: computed(() => budget.value.costByNodeId),
		branches: computed(() => budget.value.branches),
	};
}
