<script setup lang="ts">
import { computed } from 'vue';
import type { CostRange, TravelActivity, TravelNodeType } from './domain/itinerary';
import { useVoyagrTripStore } from './trip.store';

const store = useVoyagrTripStore();
const activity = computed(() => store.selectedActivity);

const TYPES: TravelNodeType[] = [
  'flight',
  'intercity_transport',
  'stay',
  'attraction',
  'food',
  'experience',
  'free_time',
];

function label(t: string) {
  return t.replace(/_/g, ' ');
}

function update(patch: Partial<TravelActivity>) {
  if (activity.value) store.updateActivity(activity.value.id, patch);
}

function updateCost(patch: Partial<CostRange>) {
  if (!activity.value) return;
  const cost = activity.value.cost ?? { low: 0, high: 0, currency: 'EUR', perPerson: false };
  update({ cost: { ...cost, ...patch } });
}

const val = (e: Event) => (e.target as HTMLInputElement).value;
const num = (e: Event) => Number((e.target as HTMLInputElement).value);
const checked = (e: Event) => (e.target as HTMLInputElement).checked;
</script>

<template>
  <aside v-if="activity" class="drawer">
    <header class="head">
      <span class="type">{{ label(activity.type) }}</span>
      <button class="close" type="button" @click="store.select(null)">✕</button>
    </header>

    <label class="field">
      <span>Name</span>
      <input :value="activity.name" @input="update({ name: val($event) })" />
    </label>

    <label class="field">
      <span>Type</span>
      <select :value="activity.type" @change="update({ type: val($event) as TravelNodeType })">
        <option v-for="t in TYPES" :key="t" :value="t">{{ label(t) }}</option>
      </select>
    </label>

    <label class="field">
      <span>Notes</span>
      <input :value="activity.subtitle ?? ''" @input="update({ subtitle: val($event) })" />
    </label>

    <fieldset class="cost">
      <legend>Cost</legend>
      <div class="row">
        <label class="field"><span>Low</span>
          <input type="number" :value="activity.cost?.low ?? 0" @input="updateCost({ low: num($event) })" />
        </label>
        <label class="field"><span>High</span>
          <input type="number" :value="activity.cost?.high ?? 0" @input="updateCost({ high: num($event) })" />
        </label>
      </div>
      <label class="field"><span>Currency</span>
        <input :value="activity.cost?.currency ?? 'EUR'" @input="updateCost({ currency: val($event) })" />
      </label>
      <label class="check">
        <input type="checkbox" :checked="activity.cost?.perPerson ?? false" @change="updateCost({ perPerson: checked($event) })" />
        Per person
      </label>
    </fieldset>
  </aside>
</template>

<style scoped>
.drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: 320px;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e2e2e6;
  padding: 16px;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  z-index: 10;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head { display: flex; align-items: center; }
.type { text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; color: #8a8a94; font-weight: 600; }
.close { margin-left: auto; border: none; background: none; cursor: pointer; font-size: 14px; color: #8a8a94; }
.field { display: flex; flex-direction: column; gap: 4px; color: #55555f; }
.field > span { font-size: 11px; }
input, select { border: 1px solid #d0d0d6; border-radius: 6px; padding: 6px 8px; font-size: 13px; color: #1e1e24; background: #fff; }
input:focus, select:focus { outline: none; border-color: #6b6bff; }
.cost { border: 1px solid #ececf0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; margin: 0; }
legend { font-size: 11px; text-transform: uppercase; color: #8a8a94; padding: 0 4px; font-weight: 600; }
.row { display: flex; gap: 8px; }
.row .field { flex: 1; min-width: 0; }
.row .field input { width: 100%; box-sizing: border-box; }
.check { display: flex; flex-direction: row; align-items: center; gap: 6px; color: #55555f; }
</style>
