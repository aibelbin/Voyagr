/**
 * Voyagr trip state (Pinia). Holds the reactive itinerary + canvas selection.
 * The canvas maps this into n8n CanvasNodes; the drawer edits it in place.
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { buildSampleItinerary, type Itinerary, type TravelActivity } from './domain/itinerary';

export const useVoyagrTripStore = defineStore('voyagrTrip', () => {
  const itinerary = ref<Itinerary>(buildSampleItinerary());
  const selectedId = ref<string | null>(null);

  const selectedActivity = computed<TravelActivity | null>(
    () => itinerary.value.activities.find((a) => a.id === selectedId.value) ?? null,
  );

  function select(id: string | null) {
    selectedId.value = id;
  }

  function updateActivity(id: string, patch: Partial<TravelActivity>) {
    const activity = itinerary.value.activities.find((a) => a.id === id);
    if (activity) Object.assign(activity, patch);
  }

  return { itinerary, selectedId, selectedActivity, select, updateActivity };
});
