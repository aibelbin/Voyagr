import type { PlaceKind, PlaceResult, TripTastes } from '@n8n/api-types';
import { Service } from '@n8n/di';

import { PlacesService } from '../places/places.service';

/** Above this on the pace slider counts as an active traveller. */
const ACTIVE_THRESHOLD = 55;

/** How far from the middle a terrain preference must sit to count. */
const TERRAIN_MARGIN = 15;

/**
 * Which kinds of place to gather for this traveller.
 *
 * Everyone needs somewhere to sleep, eat and visit. Beyond that the pace slider
 * decides: an active traveller is offered things to do, a relaxed one is
 * offered places to linger.
 */
export function kindsForTastes(tastes: TripTastes): PlaceKind[] {
	const kinds: PlaceKind[] = ['hotel', 'restaurant', 'attraction'];

	if (tastes.pace >= ACTIVE_THRESHOLD) {
		kinds.push('activity');
	} else {
		kinds.push('cafe', 'shopping');
	}

	return kinds;
}

/**
 * A search hint drawn from the terrain slider, applied only to the kinds where
 * landscape actually changes the answer. Returns undefined near the middle,
 * where the traveller has expressed no real preference.
 */
export function terrainHint(tastes: TripTastes): string | undefined {
	if (tastes.terrain >= 50 + TERRAIN_MARGIN) return 'beach';
	if (tastes.terrain <= 50 - TERRAIN_MARGIN) return 'mountain';

	return undefined;
}

/** Kinds where the surrounding landscape changes which places are a good fit. */
const TERRAIN_SENSITIVE: PlaceKind[] = ['attraction', 'activity'];

@Service()
export class CandidatePoolBuilder {
	constructor(private readonly placesService: PlacesService) {}

	/** Real places for the model to choose from. Never invented, always fetched. */
	async build(destination: string, tastes: TripTastes): Promise<PlaceResult[]> {
		const hint = terrainHint(tastes);

		const perKind = await Promise.all(
			kindsForTastes(tastes).map(
				async (kind) =>
					await this.placesService.search(
						kind,
						destination,
						TERRAIN_SENSITIVE.includes(kind) ? hint : undefined,
					),
			),
		);

		const seen = new Set<string>();

		return perKind.flat().filter((place) => {
			if (seen.has(place.providerId)) return false;
			seen.add(place.providerId);
			return true;
		});
	}
}
