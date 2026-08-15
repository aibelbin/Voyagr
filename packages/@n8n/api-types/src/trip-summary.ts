/** Itinerary-level summary of a trip, derived from its Start Trip node. */
export type TripSummary = {
	startLocation?: string;
	startDate?: string;
	endDate?: string;
	budget?: number;
	currency?: string;
	stopCount: number;
};
