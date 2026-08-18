<script setup lang="ts">
import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { ref, watch } from 'vue';
import { N8nInput, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import PlaceCard from './PlaceCard.vue';
import { usePlaceSearch } from '../usePlaceSearch';

const props = defineProps<{ kind: PlaceKind; destination: string }>();
const emit = defineEmits<{ pick: [place: PlaceResult] }>();

const i18n = useI18n();
const { results, loading, failed, search } = usePlaceSearch();

const query = ref('');

watch(
	() => [props.kind, props.destination] as const,
	async () => await search(props.kind, props.destination, query.value),
	{ immediate: true },
);

async function onSearch(): Promise<void> {
	await search(props.kind, props.destination, query.value);
}
</script>

<template>
	<aside :class="$style.panel" data-test-id="places-panel">
		<div :class="$style.header">
			<N8nText bold>
				{{ i18n.baseText('voyagr.places.title', { interpolate: { destination } }) }}
			</N8nText>

			<N8nInput
				v-model="query"
				:placeholder="i18n.baseText('voyagr.places.search')"
				size="small"
				@keyup.enter="onSearch"
			/>
		</div>

		<N8nText v-if="!destination" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.noDestination') }}
		</N8nText>
		<N8nText v-else-if="loading" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.loading') }}
		</N8nText>
		<N8nText v-else-if="failed" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.unavailable') }}
		</N8nText>
		<N8nText v-else-if="results.length === 0" color="text-light" size="small">
			{{ i18n.baseText('voyagr.places.empty') }}
		</N8nText>

		<div v-else :class="$style.results">
			<PlaceCard
				v-for="place in results"
				:key="place.providerId"
				:place="place"
				@pick="emit('pick', $event)"
			/>
		</div>
	</aside>
</template>

<style lang="scss" module>
.panel {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	width: 320px;
	height: 100%;
	padding: var(--spacing--sm);
	overflow-y: auto;
	border-right: var(--border);
	background-color: var(--background--surface);
}

.header {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding-bottom: var(--spacing--xs);
	// Opaque, or scrolled cards paint through the heading.
	background-color: var(--background--surface);
}

.results {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}
</style>
