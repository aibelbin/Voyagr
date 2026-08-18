import type { PlaceKind } from './places';

/**
 * Where the traveller sits on each slider, 0-100.
 *
 * `pace`: 0 is chill, 100 is active.
 * `terrain`: 0 is mountain, 100 is beach.
 */
export type TripTastes = {
	pace: number;
	terrain: number;
};

/** Everything the five-field form collects. */
export type TripGenerationRequest = {
	destination: string;
	startLocation: string;
	startDate: string;
	endDate: string;
	budget: number;
	currency: string;
	tastes: TripTastes;
	/** Party size. Per-person costs are multiplied by this. */
	travellers: number;
};

export type GeneratedStop = {
	/** Must match a place from the candidate pool. */
	providerId: string;
	kind: PlaceKind;
	/** Days after the trip starts, 0-based. */
	dayOffset: number;
};

export type GeneratedTripOption = {
	name: string;
	rationale: string;
	stops: GeneratedStop[];
};
