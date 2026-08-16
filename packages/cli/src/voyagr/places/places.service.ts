import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { Service } from '@n8n/di';

import { GlobalConfig } from '@n8n/config';
import { GooglePlacesProvider } from './google-places.provider';
import { PlaceCache } from './place-cache';
import { WikipediaEnricher } from './wikipedia.enricher';

/**
 * Deliberately short.
 *
 * A day of caching would be cheaper, but Google's terms exempt only the place
 * id from their no-caching rule — names, coordinates and ratings are not meant
 * to be retained. This window is sized to absorb the burst of duplicate calls a
 * single planning session produces, not to build a local copy of their data.
 * Revisit only with the licensing terms in hand.
 */
const SEARCH_TTL_MS = 15 * 60 * 1000;

/** Resolved photo links are short-lived upstream, so this stays shorter still. */
const PHOTO_TTL_MS = 5 * 60 * 1000;

const RESULT_LIMIT = 20;

const PHOTO_MAX_WIDTH_PX = 800;

@Service()
export class PlacesService {
	constructor(
		private readonly provider: GooglePlacesProvider,
		private readonly enricher: WikipediaEnricher,
		private readonly cache: PlaceCache,
		private readonly globalConfig: GlobalConfig,
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

	/**
	 * Turns a Google photo resource path into a URL a browser can load.
	 *
	 * `skipHttpRedirect` asks Google to hand back the image location as JSON
	 * instead of redirecting, so the key stays in this process and the traveller
	 * is sent to a plain image URL that carries no credential.
	 *
	 * Returns undefined for any failure; the caller renders a missing image.
	 */
	async resolvePhotoUrl(photoName: string): Promise<string | undefined> {
		const apiKey = this.globalConfig.voyagr.googlePlacesKey;
		if (!apiKey) return undefined;

		const cacheKey = `photo:${photoName}`;

		const cached = this.cache.get<string>(cacheKey);
		if (cached) return cached;

		const url =
			`https://places.googleapis.com/v1/${photoName}/media` +
			`?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`;

		try {
			const response = await fetch(url);
			if (!response.ok) return undefined;

			const body: unknown = await response.json();
			if (typeof body !== 'object' || body === null) return undefined;

			const { photoUri } = body as { photoUri?: string };
			if (typeof photoUri !== 'string') return undefined;

			this.cache.set(cacheKey, photoUri, PHOTO_TTL_MS);

			return photoUri;
		} catch {
			return undefined;
		}
	}
}
