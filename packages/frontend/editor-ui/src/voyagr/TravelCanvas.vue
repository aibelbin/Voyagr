<script setup lang="ts">
import { computed } from 'vue';
import Canvas from '@/features/workflows/canvas/components/Canvas.vue';
import NodeDrawer from './NodeDrawer.vue';
import { mapItineraryToCanvas } from './mapping';
import { useVoyagrTripStore } from './trip.store';

const store = useVoyagrTripStore();

// Derive the canvas structures from the reactive itinerary. Any drawer edit
// re-maps; node positions are deterministic (from layout), so cards stay put
// while labels/subtitles/icons update. (Manual drag persistence is a later task.)
const mapped = computed(() => mapItineraryToCanvas(store.itinerary));

function onSelected(id?: string) {
  store.select(id ?? null);
}
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
      @update:node:selected="onSelected"
    />
    <NodeDrawer />
  </div>
</template>

<style scoped>
.voyagr-canvas {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: var(--canvas--color--background, #f7f7f8);
}
</style>
