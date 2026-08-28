<script setup lang="ts">
import { computed } from 'vue';

import { N8nText } from '@n8n/design-system';

import { formatTripMoney } from '../../tripFormatting';
import { useTripBudget } from '../useTripBudget';

const props = defineProps<{ nodeId: string }>();

const { budget, currency, costByNodeId } = useTripBudget();

const cost = computed(() => costByNodeId.value.get(props.nodeId) ?? 0);

/**
 * Null for a stop with nothing to charge — a Free Time block, or a price nobody
 * filled in. An absent chip reads as "nothing to account for"; a "0 · 0%" chip
 * reads as a bug.
 */
const label = computed(() => {
	if (cost.value <= 0) return null;

	const money = formatTripMoney(cost.value, currency.value);
	if (budget.value <= 0) return money;

	return `${money} · ${Math.round((cost.value / budget.value) * 100)}%`;
});
</script>

<template>
	<N8nText v-if="label" size="xsmall" color="text-light" data-test-id="node-budget-chip">
		{{ label }}
	</N8nText>
</template>
