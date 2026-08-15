<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';

import type { Resource } from '@/Interface';
import { formatTripMoney } from '../tripFormatting';

const props = defineProps<{ resources: Resource[] }>();

const i18n = useI18n();

const DAY_IN_MS = 86_400_000;

const summaries = computed(() =>
	props.resources.flatMap((resource) =>
		resource.resourceType === 'workflow' && resource.tripSummary ? [resource.tripSummary] : [],
	),
);

const stopCount = computed(() =>
	summaries.value.reduce((total, summary) => total + summary.stopCount, 0),
);

/** Budgets in different currencies are listed side by side rather than summed. */
const budget = computed(() => {
	const totals = new Map<string, number>();

	for (const summary of summaries.value) {
		if (!summary.budget || !summary.currency) continue;
		totals.set(summary.currency, (totals.get(summary.currency) ?? 0) + summary.budget);
	}

	if (totals.size === 0) return i18n.baseText('trips.stats.empty');

	return [...totals]
		.map(([currency, amount]) => formatTripMoney(amount, currency))
		.join(' · ');
});

const nextDeparture = computed(() => {
	const now = Date.now();
	const upcoming = summaries.value
		.map((summary) => (summary.startDate ? new Date(summary.startDate).getTime() : Number.NaN))
		.filter((time) => !Number.isNaN(time) && time >= now)
		.sort((a, b) => a - b);

	if (upcoming.length === 0) return i18n.baseText('trips.stats.empty');

	const days = Math.ceil((upcoming[0] - now) / DAY_IN_MS);
	if (days <= 0) return i18n.baseText('trips.stats.next.today');
	if (days === 1) return i18n.baseText('trips.stats.next.tomorrow');

	return i18n.baseText('trips.stats.next.inDays', { interpolate: { count: days } });
});

const stats = computed(() => [
	{ id: 'trips', label: i18n.baseText('trips.stats.trips'), value: String(summaries.value.length) },
	{ id: 'stops', label: i18n.baseText('trips.stats.stops'), value: String(stopCount.value) },
	{ id: 'budget', label: i18n.baseText('trips.stats.budget'), value: budget.value },
	{ id: 'next', label: i18n.baseText('trips.stats.next'), value: nextDeparture.value },
]);
</script>

<template>
	<div :class="$style.wrapper">
		<ul :class="$style.stats" data-test-id="trip-stats">
			<li v-for="stat in stats" :key="stat.id">
				<div>
					<strong>{{ stat.label }}</strong>
					<em>{{ stat.value }}</em>
				</div>
			</li>
		</ul>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	position: relative;
	padding: var(--spacing--xs) 0 0;
	margin-bottom: var(--spacing--2xl);
}

.stats {
	display: flex;
	align-items: stretch;
	justify-content: space-evenly;
	border: var(--border);
	border-radius: 6px;
	list-style: none;
	overflow-x: auto;

	li {
		display: flex;
		align-items: stretch;
		flex: 1 0;
		border-left: var(--border);

		&:first-child {
			border-left: 0;
		}

		> div {
			display: grid;
			align-content: center;
			width: 100%;
			padding: var(--spacing--sm) var(--spacing--lg);
			background-color: var(--background--surface);
		}
	}

	strong {
		justify-self: flex-start;
		margin-bottom: var(--spacing--3xs);
		color: var(--color--text--shade-1);
		font-size: var(--font-size--sm);
		font-weight: var(--font-weight--regular);
		white-space: nowrap;
	}

	em {
		color: var(--color--text--shade-1);
		font-size: var(--font-size--xl);
		font-style: normal;
		font-weight: var(--font-weight--bold);
		white-space: nowrap;
	}
}
</style>
