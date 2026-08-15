<script setup lang="ts">
import type { PlaceResult } from '@n8n/api-types';
import { computed } from 'vue';
import { N8nButton, N8nIcon, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

const props = defineProps<{ place: PlaceResult }>();
const emit = defineEmits<{ pick: [place: PlaceResult] }>();

const i18n = useI18n();

const rating = computed(() =>
	props.place.rating === undefined ? null : props.place.rating.toFixed(1),
);

const priceTier = computed(() =>
	props.place.priceTier === undefined ? null : '$'.repeat(props.place.priceTier),
);
</script>

<template>
	<div :class="$style.card" data-test-id="place-card">
		<img v-if="place.photoUrl" :src="place.photoUrl" :alt="place.name" :class="$style.photo" />
		<div :class="$style.body">
			<N8nText bold>{{ place.name }}</N8nText>
			<div :class="$style.meta">
				<span v-if="rating" :class="$style.metaItem">
					<N8nIcon icon="star" size="small" />
					{{ rating }}
					<template v-if="place.ratingCount">
						{{
							i18n.baseText('voyagr.places.ratingCount', {
								interpolate: { count: place.ratingCount },
							})
						}}
					</template>
				</span>
				<span v-if="priceTier" :class="$style.metaItem">{{ priceTier }}</span>
				<span v-if="place.address" :class="$style.metaItem">{{ place.address }}</span>
			</div>
			<N8nText v-if="place.blurb" size="small" color="text-light" :class="$style.blurb">
				{{ place.blurb }}
			</N8nText>
			<N8nButton size="small" variant="outline" @click="emit('pick', place)">
				{{ i18n.baseText('voyagr.places.add') }}
			</N8nButton>
		</div>
	</div>
</template>

<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding: var(--spacing--xs);
	border: var(--border);
	border-radius: var(--radius--2xs);
	background-color: var(--background--surface);
}

.photo {
	width: 100%;
	height: 120px;
	object-fit: cover;
	border-radius: var(--radius--2xs);
}

.body {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
}

.meta {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
}

.metaItem {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
}

.blurb {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
