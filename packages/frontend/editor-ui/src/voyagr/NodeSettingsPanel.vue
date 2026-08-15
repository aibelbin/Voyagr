<script setup lang="ts">
import { computed } from 'vue';
import NodeSettings from '@/features/ndv/settings/components/NodeSettings.vue';
import type { IUpdateInformation } from '@/Interface';
import { useVoyagrTripStore } from './trip.store';
import { activityToNode } from './voyagr-nodes';

const store = useVoyagrTripStore();

const activeNode = computed(() =>
  store.selectedActivity ? activityToNode(store.selectedActivity) : undefined,
);

// NodeSettings only bubbles the node-rename up (parameter edits go through the
// stubbed document store); catch it and rename the activity.
function onValueChanged(payload: IUpdateInformation) {
  if (payload?.name === 'name' && store.selectedActivity) {
    store.updateActivity(store.selectedActivity.id, { name: String(payload.value) });
  }
}
</script>

<template>
  <aside v-if="activeNode" class="voyagr-ndv">
    <div class="ndv-head">
      <button class="close" type="button" title="Close" @click="store.select(null)">✕</button>
    </div>
    <div class="ndv-body">
      <NodeSettings
        :active-node="activeNode"
        push-ref="voyagr"
        :dragging="false"
        :read-only="false"
        :foreign-credentials="[]"
        :block-ui="false"
        :executable="false"
        :hide-sub-connections="true"
        :hide-execute="true"
        @value-changed="onValueChanged"
      />
    </div>
  </aside>
</template>

<style scoped>
.voyagr-ndv {
  position: absolute;
  top: 0;
  right: 0;
  width: 420px;
  height: 100%;
  background: var(--color-background-xlight, #fff);
  border-left: 1px solid var(--color-foreground-base, #e2e2e6);
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.06);
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.ndv-head { display: flex; justify-content: flex-end; padding: 6px 8px 0; flex-shrink: 0; }
.close { border: none; background: none; cursor: pointer; font-size: 14px; color: #8a8a94; }
.ndv-body { flex: 1; min-height: 0; overflow: auto; }
.ndv-body > :deep(*) { height: 100%; }
</style>
