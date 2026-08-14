/**
 * Pure budget engine over the Voyagr itinerary.
 * Per-person costs are multiplied by traveler count; group costs are flat.
 */
import type { Itinerary, TravelNodeType } from './itinerary';

export type BudgetState = 'under' | 'near' | 'over';

export interface BudgetSummary {
  low: number;
  high: number;
  currency: string;
  target: number;
  state: BudgetState;
  byCategory: Partial<Record<TravelNodeType, { low: number; high: number }>>;
}

/** ≥90% of target (on the high estimate) is "near"; over target is "over". */
export const NEAR_THRESHOLD = 0.9;

export function computeBudget(itinerary: Itinerary): BudgetSummary {
  const travelers = Math.max(1, itinerary.travelers);
  let low = 0;
  let high = 0;
  const byCategory: BudgetSummary['byCategory'] = {};

  for (const a of itinerary.activities) {
    if (!a.cost) continue;
    const mult = a.cost.perPerson ? travelers : 1;
    const nLow = a.cost.low * mult;
    const nHigh = a.cost.high * mult;
    low += nLow;
    high += nHigh;
    const bucket = (byCategory[a.type] ??= { low: 0, high: 0 });
    bucket.low += nLow;
    bucket.high += nHigh;
  }

  const target = itinerary.budgetTarget;
  let state: BudgetState = 'under';
  if (high > target) state = 'over';
  else if (high >= target * NEAR_THRESHOLD) state = 'near';

  return { low, high, currency: itinerary.currency, target, state, byCategory };
}
