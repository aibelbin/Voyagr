<script setup lang="ts">
import { computed } from 'vue';
import Canvas from '@/features/workflows/canvas/components/Canvas.vue';
import BudgetBar from './BudgetBar.vue';
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
  <div class="voyagr-app">
    <BudgetBar />
    <div class="canvas-area">
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
  </div>
</template>

<style scoped>
.voyagr-app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}
.canvas-area {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--canvas--color--background, #f7f7f8);
}
/* Ensure n8n's canvas fills the area below the budget bar. */
.canvas-area > :deep(.vue-flow),
.canvas-area > :deep(div) {
  height: 100%;
}
</style>
