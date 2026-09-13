<script setup lang="ts">
import type { TripGenerationRequest } from '@n8n/api-types';
import {
	N8nButton,
	N8nDialog,
	N8nDialogDescription,
	N8nDialogFooter,
	N8nDialogHeader,
	N8nDialogTitle,
	N8nHeading,
	N8nInput,
	N8nInputLabel,
	N8nOption,
	N8nSelect,
	N8nText,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useRootStore } from '@n8n/stores/useRootStore';
import { ElDatePicker, ElSlider } from 'element-plus';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VIEWS } from '@/app/constants';

import { generateTrip } from '../generator.api';

const open = defineModel<boolean>('open', { required: true });

const i18n = useI18n();
const router = useRouter();
const rootStore = useRootStore();

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'] as const;

const destination = ref('');
const startLocation = ref('Home');
const startDate = ref('');
const endDate = ref('');
const budget = ref('1000');
const currency = ref<string>(CURRENCIES[0]);
const travellers = ref('1');
const pace = ref(50);
const terrain = ref(50);

const submitting = ref(false);
const unavailable = ref(false);

const canSubmit = computed(
	() => destination.value.trim() !== '' && startDate.value !== '' && endDate.value !== '',
);

// Element-plus prices its slider off its own CSS vars; mapping them to the
// design system's semantic tokens keeps the control on-brand in both themes.
const sliderTokens = {
	'--el-slider-main-bg-color': 'var(--background--brand)',
	'--el-slider-runway-bg-color': 'var(--border-color--strong)',
	'--el-slider-disabled-color': 'var(--background--disabled)',
} as const;

function onOpenChange(value: boolean): void {
	if (submitting.value) return;
	open.value = value;
}

async function onSubmit(): Promise<void> {
	if (!canSubmit.value || submitting.value) return;

	submitting.value = true;
	unavailable.value = false;

	const request: TripGenerationRequest = {
		destination: destination.value,
		startLocation: startLocation.value,
		startDate: startDate.value,
		endDate: endDate.value,
		budget: Number(budget.value),
		currency: currency.value,
		travellers: Number(travellers.value),
		tastes: { pace: pace.value, terrain: terrain.value },
	};

	try {
		const { workflowId } = await generateTrip(rootStore.restApiContext, request);

		if (!workflowId) {
			// Planning is an assist, never a blocker: the traveller keeps their
			// answers and can still build the trip by hand.
			unavailable.value = true;
			return;
		}

		open.value = false;
		await router.push({ name: VIEWS.WORKFLOW, params: { workflowId } });
	} catch {
		unavailable.value = true;
	} finally {
		submitting.value = false;
	}
}
</script>

<template>
	<N8nDialog
		:open="open"
		size="medium"
		data-test-id="plan-with-ai-dialog"
		@update:open="onOpenChange"
	>
		<N8nDialogHeader>
			<N8nDialogTitle as-child>
				<N8nHeading tag="h2" size="xlarge" bold>
					{{ i18n.baseText('voyagr.generate.title') }}
				</N8nHeading>
			</N8nDialogTitle>
			<N8nDialogDescription as-child>
				<N8nText color="text-light">
					{{ i18n.baseText('voyagr.generate.subtitle') }}
				</N8nText>
			</N8nDialogDescription>
		</N8nDialogHeader>

		<form :class="$style.form" @submit.prevent="onSubmit">
			<N8nInputLabel
				:label="i18n.baseText('voyagr.generate.destination')"
				input-name="voyagr-destination"
				required
			>
				<N8nInput
					id="voyagr-destination"
					v-model="destination"
					name="voyagr-destination"
					:disabled="submitting"
					data-test-id="voyagr-destination"
				/>
			</N8nInputLabel>

			<N8nInputLabel
				:label="i18n.baseText('voyagr.generate.from')"
				input-name="voyagr-start-location"
			>
				<N8nInput
					id="voyagr-start-location"
					v-model="startLocation"
					name="voyagr-start-location"
					:disabled="submitting"
					data-test-id="voyagr-start-location"
				/>
			</N8nInputLabel>

			<N8nInputLabel :label="i18n.baseText('voyagr.generate.dates')" required>
				<div :class="$style.row">
					<ElDatePicker
						v-model="startDate"
						type="date"
						value-format="YYYY-MM-DD"
						placeholder="yyyy-mm-dd"
						:teleported="false"
						:disabled="submitting"
						:class="$style.grow"
						data-test-id="voyagr-start-date"
					/>
					<ElDatePicker
						v-model="endDate"
						type="date"
						value-format="YYYY-MM-DD"
						placeholder="yyyy-mm-dd"
						:teleported="false"
						:disabled="submitting"
						:class="$style.grow"
						data-test-id="voyagr-end-date"
					/>
				</div>
			</N8nInputLabel>

			<N8nInputLabel :label="i18n.baseText('voyagr.generate.budget')" input-name="voyagr-budget">
				<div :class="$style.row">
					<N8nInput
						id="voyagr-budget"
						v-model="budget"
						name="voyagr-budget"
						type="number"
						:disabled="submitting"
						:class="$style.grow"
						data-test-id="voyagr-budget"
					/>
					<N8nSelect
						v-model="currency"
						:disabled="submitting"
						:teleported="false"
						:class="$style.currency"
						data-test-id="voyagr-currency"
					>
						<N8nOption v-for="code in CURRENCIES" :key="code" :value="code" :label="code" />
					</N8nSelect>
				</div>
			</N8nInputLabel>

			<N8nInputLabel
				:label="i18n.baseText('voyagr.generate.travellers')"
				input-name="voyagr-travellers"
			>
				<N8nInput
					id="voyagr-travellers"
					v-model="travellers"
					name="voyagr-travellers"
					type="number"
					:min="1"
					:disabled="submitting"
					data-test-id="voyagr-travellers"
				/>
			</N8nInputLabel>

			<N8nInputLabel :label="i18n.baseText('voyagr.generate.pace')">
				<div :class="$style.slider">
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('voyagr.generate.pace.low') }}
					</N8nText>
					<ElSlider
						v-model="pace"
						:min="0"
						:max="100"
						:disabled="submitting"
						:style="sliderTokens"
						:class="$style.grow"
						data-test-id="voyagr-pace"
					/>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('voyagr.generate.pace.high') }}
					</N8nText>
				</div>
			</N8nInputLabel>

			<N8nInputLabel :label="i18n.baseText('voyagr.generate.terrain')">
				<div :class="$style.slider">
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('voyagr.generate.terrain.low') }}
					</N8nText>
					<ElSlider
						v-model="terrain"
						:min="0"
						:max="100"
						:disabled="submitting"
						:style="sliderTokens"
						:class="$style.grow"
						data-test-id="voyagr-terrain"
					/>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('voyagr.generate.terrain.high') }}
					</N8nText>
				</div>
			</N8nInputLabel>

			<N8nText v-if="unavailable" size="small" color="text-light" data-test-id="voyagr-unavailable">
				{{ i18n.baseText('voyagr.generate.unavailable') }}
			</N8nText>

			<N8nDialogFooter>
				<N8nButton
					type="submit"
					size="large"
					:disabled="!canSubmit"
					:loading="submitting"
					:label="
						submitting
							? i18n.baseText('voyagr.generate.working')
							: i18n.baseText('voyagr.generate.submit')
					"
					data-test-id="voyagr-generate-submit"
				/>
			</N8nDialogFooter>
		</form>
	</N8nDialog>
</template>

<style lang="scss" module>
.form {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	margin-top: var(--spacing--md);
}

.row {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.slider {
	display: flex;
	align-items: center;
	gap: var(--spacing--sm);
}

.grow {
	flex: 1 1 auto;
	min-width: 0;
}

.currency {
	flex: 0 0 auto;
	width: var(--spacing--4xl);
}
</style>
