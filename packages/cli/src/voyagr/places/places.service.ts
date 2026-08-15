import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { Service } from '@n8n/di';

import { FoursquareProvider } from './foursquare.provider';
import { PlaceCache } from './place-cache';
import { WikipediaEnricher } from './wikipedia.enricher';

/**
 * Short enough that a place closing or re-rating shows up within a day, long
 * enough that repeat searches for the same city cost nothing.
 *
 * Confirm the provider's caching terms before deploying and set this to match.
 */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

const RESULT_LIMIT = 20;

@Service()
export class PlacesService {
	constructor(
		private readonly provider: FoursquareProvider,
		private readonly enricher: WikipediaEnricher,
		private readonly cache: PlaceCache,
	) {}

	async search(kind: PlaceKind, near: string, query?: string): Promise<PlaceResult[]> {
		const key = `search:${kind}:${near.trim().toLowerCase()}:${query?.trim().toLowerCase() ?? ''}`;

		const cached = this.cache.get<PlaceResult[]>(key);
		if (cached) return cached;

		const results = await this.provider.search({ kind, near, query, limit: RESULT_LIMIT });

		// Only landmarks are worth a second round trip; the rest already carry
		// a photo and a rating from the primary provider.
		const enriched = kind === 'attraction' ? await this.enricher.enrich(results) : results;

		if (enriched.length > 0) this.cache.set(key, enriched, SEARCH_TTL_MS);

		return enriched;
	}
}
