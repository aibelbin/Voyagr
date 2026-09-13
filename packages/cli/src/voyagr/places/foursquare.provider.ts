import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';

import { Geocoder } from './geocoder';
import type { PlaceSearchOptions, PlaceSearchProvider } from './place-provider';

const FOURSQUARE_SEARCH_URL = 'https://places-api.foursquare.com/places/search';

/** Required on every call; pinning it keeps the response shape from drifting under us. */
const FOURSQUARE_API_VERSION = '2025-06-17';

/** Foursquare category ids, one set per Voyagr place kind. */
const CATEGORIES: Record<PlaceKind, string> = {
	hotel: '19014',
	restaurant: '13065',
	cafe: '13032',
	attraction: '16000',
	activity: '18000',
	shopping: '17000',
};

type FoursquarePlace = {
	fsq_place_id?: string;
	name?: string;
	rating?: number;
	price?: number;
	location?: { formatted_address?: string; locality?: string };
	latitude?: number;
	longitude?: number;
	photos?: Array<{ prefix?: string; suffix?: string }>;
	website?: string;
	stats?: { total_ratings?: number };
};

@Service()
export class FoursquareProvider implements PlaceSearchProvider {
	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly geocoder: Geocoder,
	) {}

	/** False when no key is configured, so callers can degrade quietly. */
	get isConfigured(): boolean {
		return this.globalConfig.voyagr.placesKey !== '';
	}

	async search(opts: PlaceSearchOptions): Promise<PlaceResult[]> {
		if (!this.isConfigured) return [];

		const coordinates = await this.geocoder.geocode(opts.near);
		if (!coordinates) return [];

		const params = new URLSearchParams({
			ll: `${coordinates.lat},${coordinates.lon}`,
			fsq_category_ids: CATEGORIES[opts.kind],
			limit: String(opts.limit),
			fields: 'fsq_place_id,name,location,latitude,longitude,rating,price,photos,website,stats',
		});

		if (opts.query) params.set('query', opts.query);

		const response = await fetch(`${FOURSQUARE_SEARCH_URL}?${params.toString()}`, {
			headers: {
				Authorization: `Bearer ${this.globalConfig.voyagr.placesKey}`,
				Accept: 'application/json',
				'X-Places-Api-Version': FOURSQUARE_API_VERSION,
			},
		});

		if (!response.ok) return [];

		const body: unknown = await response.json();
		if (typeof body !== 'object' || body === null) return [];

		const { results } = body as { results?: FoursquarePlace[] };
		if (!Array.isArray(results)) return [];

		return results.flatMap((place) => this.toPlaceResult(place));
	}

	/** Returns an empty array for a place too incomplete to show on a card. */
	private toPlaceResult(place: FoursquarePlace): PlaceResult[] {
		const { latitude, longitude } = place;

		if (!place.fsq_place_id || !place.name || latitude === undefined || longitude === undefined) {
			return [];
		}

		const photo = place.photos?.[0];

		return [
			{
				providerId: `fsq:${place.fsq_place_id}`,
				name: place.name,
				address: place.location?.formatted_address ?? place.location?.locality,
				lat: latitude,
				lon: longitude,
				// Foursquare rates out of 10; every consumer expects 0-5.
				rating: typeof place.rating === 'number' ? place.rating / 2 : undefined,
				ratingCount: place.stats?.total_ratings,
				priceTier: this.toPriceTier(place.price),
				photoUrl:
					photo?.prefix && photo.suffix ? `${photo.prefix}original${photo.suffix}` : undefined,
				website: place.website,
			},
		];
	}

	private toPriceTier(price: number | undefined): 1 | 2 | 3 | 4 | undefined {
		return price === 1 || price === 2 || price === 3 || price === 4 ? price : undefined;
	}
}
