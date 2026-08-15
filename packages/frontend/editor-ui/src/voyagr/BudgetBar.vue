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
  under: 'var(--color-success)',
  near: 'var(--color-warning)',
  over: 'var(--color-danger)',
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
  gap: var(--spacing-s, 16px);
  height: 52px;
  padding: 0 var(--spacing-s, 16px);
  background: var(--color-background-xlight, #fff);
  border-bottom: var(--border-base, 1px solid var(--color-foreground-base, #dbdfe7));
  font-size: var(--font-size-2xs, 13px);
  color: var(--color-text-base, #7d7d87);
  flex-shrink: 0;
}
.title {
  font-weight: var(--font-weight-bold, 600);
  color: var(--color-text-dark, #2d2e3a);
}
.figures { display: flex; align-items: baseline; gap: var(--spacing-3xs, 8px); }
.total {
  font-weight: var(--font-weight-bold, 600);
  color: var(--color-text-dark, #2d2e3a);
}
.target { color: var(--color-text-light, #9a9aa2); }
.state { font-weight: var(--font-weight-bold, 600); }
.meter {
  flex: 1;
  max-width: 280px;
  height: 6px;
  background: var(--color-foreground-base, #ececef);
  border-radius: var(--border-radius-base, 4px);
  overflow: hidden;
}
.fill { height: 100%; transition: width 0.2s ease; }
.disclaimer {
  margin-left: auto;
  color: var(--color-text-light, #9a9aa2);
  font-size: var(--font-size-3xs, 11px);
}
</style>
