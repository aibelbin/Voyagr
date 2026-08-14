<script setup lang="ts">
import { computed } from 'vue';
import { computeBudget, type BudgetState } from './domain/budget';
import { useVoyagrTripStore } from './trip.store';

const store = useVoyagrTripStore();
const budget = computed(() => computeBudget(store.itinerary));
const pct = computed(() =>
  Math.min(100, Math.round((budget.value.high / Math.max(1, budget.value.target)) * 100)),
);

const STATE_COLOR: Record<BudgetState, string> = {
  under: '#16a34a',
  near: '#d97706',
  over: '#dc2626',
};
const STATE_LABEL: Record<BudgetState, string> = {
  under: 'under budget',
  near: 'near budget',
  over: 'over budget',
};

const fmt = (n: number) => n.toLocaleString();
</script>

<template>
  <div class="budget-bar">
    <div class="title">{{ store.itinerary.title }}</div>
    <div class="figures">
      <span class="total">{{ budget.currency }} {{ fmt(budget.low) }}–{{ fmt(budget.high) }}</span>
      <span class="target">/ {{ budget.currency }} {{ fmt(budget.target) }}</span>
      <span class="state" :style="{ color: STATE_COLOR[budget.state] }">{{ STATE_LABEL[budget.state] }}</span>
    </div>
    <div class="meter">
      <div class="fill" :style="{ width: `${pct}%`, background: STATE_COLOR[budget.state] }" />
    </div>
    <div class="disclaimer">estimates, not quotes · {{ store.itinerary.travelers }} travelers</div>
  </div>
</template>

<style scoped>
.budget-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 52px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e2e2e6;
  font-size: 13px;
  flex-shrink: 0;
}
.title { font-weight: 600; color: #1e1e24; }
.figures { display: flex; align-items: baseline; gap: 8px; }
.total { font-weight: 600; color: #1e1e24; }
.target { color: #9a9aa2; }
.state { font-weight: 600; }
.meter {
  flex: 1;
  max-width: 280px;
  height: 6px;
  background: #ececef;
  border-radius: 3px;
  overflow: hidden;
}
.fill { height: 100%; transition: width 0.2s ease; }
.disclaimer { margin-left: auto; color: #9a9aa2; font-size: 11px; }
</style>
