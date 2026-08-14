<script setup lang="ts">
import { shallowRef } from 'vue';
import Canvas from '@/features/workflows/canvas/components/Canvas.vue';
import { buildSampleItinerary } from './domain/itinerary';
import { mapItineraryToCanvas } from './mapping';

const itinerary = buildSampleItinerary();
const mapped = shallowRef(mapItineraryToCanvas(itinerary));
</script>

<template>
	<div class="voyagr-canvas">
		<Canvas
			id="voyagr"
			:nodes="mapped.nodes"
			:connections="mapped.connections"
			:render-data="mapped.renderData"
			:show-node-groups="false"
			:read-only="false"
			:key-bindings="false"
		/>
	</div>
</template>

<style scoped>
.voyagr-canvas {
	width: 100vw;
	height: 100vh;
	background: var(--canvas--color--background, #f7f7f8);
}
</style>
