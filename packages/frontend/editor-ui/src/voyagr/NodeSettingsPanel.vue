<script setup lang="ts">
import { computed } from 'vue';
import { ElDialog } from 'element-plus';
import NodeSettings from '@/features/ndv/settings/components/NodeSettings.vue';
import type { IUpdateInformation } from '@/Interface';
import { useVoyagrTripStore } from './trip.store';
import { activityToNode } from './voyagr-nodes';

const store = useVoyagrTripStore();

// Bind the dialog's open state to the canvas selection: selecting a node opens
// the NDV-style modal; closing it (X / backdrop / escape) clears the selection.
const open = computed({
  get: () => store.selectedId !== null,
  set: (value: boolean) => {
    if (!value) store.select(null);
  },
});

const activeNode = computed(() =>
  store.selectedActivity ? activityToNode(store.selectedActivity) : undefined,
);

function onValueChanged(payload: IUpdateInformation) {
  if (payload?.name === 'name' && store.selectedActivity) {
    store.updateActivity(store.selectedActivity.id, { name: String(payload.value) });
  }
}
</script>

<template>
  <ElDialog
    v-model="open"
    append-to-body
    align-center
    width="640px"
    :show-close="true"
    :close-on-click-modal="true"
    modal-class="voyagr-ndv-modal"
    class="voyagr-ndv-dialog"
  >
    <div v-if="activeNode" class="voyagr-ndv-body">
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
  </ElDialog>
</template>

<style>
/* NDV-style sub-window: let NodeSettings own the chrome; trim the dialog padding. */
.voyagr-ndv-dialog .el-dialog__body {
  padding: 0;
}
.voyagr-ndv-dialog .el-dialog__header {
  padding: var(--spacing-2xs, 6px) var(--spacing-2xs, 6px) 0;
  margin: 0;
}
.voyagr-ndv-body {
  height: 72vh;
  overflow: auto;
}
</style>
