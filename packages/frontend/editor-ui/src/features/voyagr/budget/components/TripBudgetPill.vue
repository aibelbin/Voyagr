<script setup lang="ts">
import { computed } from 'vue';

import N8nCanvasPill from '@n8n/design-system/components/CanvasPill';
import { N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import { formatTripMoney } from '../../tripFormatting';
import { useTripBudget } from '../useTripBudget';

const i18n = useI18n();

const { budget, currency, branches } = useTripBudget();

type Segment = {
	key: number;
	/** Absent for a single-branch trip: there is no option to name. */
	option: string | null;
	spend: string;
	remaining: string;
	/** 0-100, clamped so the bar cannot overflow its track when over budget. */
	percent: number;
	isOver: boolean;
};

const money = (amount: number) => formatTripMoney(amount, currency.value);

/**
 * A branch with nothing priced yet gets no segment — an empty canvas
 * shouldn't show a zero bar. Suppression is per branch, not a single gate on
 * the whole wrapper: a three-option AI plan with one option still unpriced
 * must still show pills for the other two.
 *
 * "Option N" labelling is driven by the *total* branch count, not how many
 * survive the filter: it names which of the trip's alternatives this pill is,
 * and that identity doesn't change as sibling options get priced in. A trip
 * with three options where only one is priced still reads "Option 2" (say) —
 * unlabelling it would make it indistinguishable from a genuine single-branch
 * trip, when two other options actually exist off-canvas.
 */
const segments = computed<Segment[]>(() =>
	branches.value
		.filter((branch) => branch.total > 0)
		.map((branch) => {
			const hasBudget = budget.value > 0;
			const isOver = hasBudget && branch.total > budget.value;

			return {
				key: branch.index,
				option:
					branches.value.length > 1
						? i18n.baseText('voyagr.budget.option', {
								interpolate: { index: branch.index },
							})
						: null,
				spend: hasBudget
					? i18n.baseText('voyagr.budget.of', {
							interpolate: { spent: money(branch.total), budget: money(budget.value) },
						})
					: i18n.baseText('voyagr.budget.planned', {
							interpolate: { amount: money(branch.total) },
						}),
				remaining: !hasBudget
					? i18n.baseText('voyagr.budget.noBudget')
					: isOver
						? i18n.baseText('voyagr.budget.over', {
								interpolate: { amount: money(branch.total - budget.value) },
							})
						: i18n.baseText('voyagr.budget.left', {
								interpolate: { amount: money(budget.value - branch.total) },
							}),
				percent: hasBudget ? Math.min(Math.round((branch.total / budget.value) * 100), 100) : 0,
				isOver,
			};
		}),
);

/** Nothing priced yet is not worth a pill. */
const visible = computed(() => segments.value.length > 0);
</script>

<template>
	<div v-if="visible" :class="$style.wrapper" data-test-id="trip-budget-pill">
		<N8nCanvasPill v-for="segment in segments" :key="segment.key">
			<span :class="$style.segment">
				<N8nText v-if="segment.option" size="xsmall" :class="$style.option">
					{{ segment.option }}
				</N8nText>
				<span :class="$style.amounts">
					<N8nText size="xsmall" :color="segment.isOver ? 'danger' : undefined">
						{{ segment.spend }}
					</N8nText>
					<N8nText size="xsmall" :color="segment.isOver ? 'danger' : 'text-light'">
						{{ segment.remaining }}
					</N8nText>
				</span>
				<progress
					:class="[$style.progress, segment.isOver ? $style.over : $style.within]"
					:value="segment.percent"
					max="100"
				/>
			</span>
		</N8nCanvasPill>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%) translateY(50%);
	display: flex;
	gap: var(--spacing--2xs);
	// Above the canvas, matching the bar this replaces.
	z-index: 100;
}

.segment {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.option {
	color: var(--text-color--subtler);
}

.amounts {
	display: flex;
	flex-direction: column;
	line-height: 1.2;
	white-space: nowrap;
}

.progress {
	appearance: none;
	width: var(--spacing--3xl);
	height: var(--spacing--3xs);
	border: 0;
	border-radius: var(--radius--2xs);
	// Firefox has no track pseudo-element: after `appearance: none` it paints
	// the unfilled track as the element's own background (::-moz-progress-bar
	// is only the fill). This is the cross-browser fallback, same pattern as
	// TrialBanner.vue's `.progressBar`.
	background-color: var(--color--foreground--shade-1);

	&::-webkit-progress-bar {
		background-color: var(--color--foreground--shade-1);
		border-radius: var(--radius--2xs);
	}

	&::-moz-progress-bar {
		border-radius: var(--radius--2xs);
	}
}

.within::-webkit-progress-value {
	background-color: var(--color--success);
	border-radius: var(--radius--2xs);
}

.within::-moz-progress-bar {
	background-color: var(--color--success);
}

.over::-webkit-progress-value {
	background-color: var(--color--danger);
	border-radius: var(--radius--2xs);
}

.over::-moz-progress-bar {
	background-color: var(--color--danger);
}
</style>
