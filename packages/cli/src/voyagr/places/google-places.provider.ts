import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';

import { Geocoder } from './geocoder';
import type { PlaceSearchOptions, PlaceSearchProvider } from './place-provider';

const SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * The New API has no default field set — an absent mask is an error, and every
 * field named here is billed. `rating`, `userRatingCount` and `priceLevel` are
 * Enterprise-tier: they are what make a card worth showing, and also what makes
 * the call expensive. Do not widen this mask casually.
 */
const FIELD_MASK = [
	'places.id',
	'places.displayName',
	'places.formattedAddress',
	'places.shortFormattedAddress',
	'places.location',
	'places.rating',
	'places.userRatingCount',
	'places.priceLevel',
	'places.photos',
].join(',');

/** How far around the destination centre to look. */
const SEARCH_RADIUS_METRES = 15000;

/**
 * Google place types per Voyagr kind, from the Table A supported-types list.
 *
 * Several types per kind on purpose: "attraction" spans museums and landmarks,
 * "hotel" spans hostels and ryokan-style inns. The first entry is the primary
 * one, used when the traveller types a free-text query and we fall back to Text
 * Search, which accepts only a single type.
 */
const TYPES: Record<PlaceKind, string[]> = {
	hotel: ['hotel', 'lodging', 'resort_hotel', 'motel', 'hostel', 'bed_and_breakfast', 'inn'],
	restaurant: ['restaurant', 'fine_dining_restaurant'],
	cafe: ['cafe', 'coffee_shop', 'tea_house'],
	attraction: [
		'tourist_attraction',
		'historical_landmark',
		'cultural_landmark',
		'museum',
		'monument',
	],
	activity: ['amusement_park', 'park', 'zoo', 'aquarium', 'national_park'],
	shopping: ['shopping_mall', 'department_store', 'market', 'clothing_store'],
};

/** Google returns an enum; every Voyagr consumer expects 1-4 or nothing. */
const PRICE_TIERS: Record<string, 1 | 2 | 3 | 4> = {
	PRICE_LEVEL_INEXPENSIVE: 1,
	PRICE_LEVEL_MODERATE: 2,
	PRICE_LEVEL_EXPENSIVE: 3,
	PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type GooglePlace = {
	id?: string;
	displayName?: { text?: string };
	formattedAddress?: string;
	shortFormattedAddress?: string;
	location?: { latitude?: number; longitude?: number };
	rating?: number;
	userRatingCount?: number;
	priceLevel?: string;
	photos?: Array<{ name?: string }>;
};

@Service()
export class GooglePlacesProvider implements PlaceSearchProvider {
	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly geocoder: Geocoder,
	) {}

	/** False when no key is configured, so callers can degrade quietly. */
	get isConfigured(): boolean {
		return this.globalConfig.voyagr.googlePlacesKey !== '';
	}

	async search(opts: PlaceSearchOptions): Promise<PlaceResult[]> {
		if (!this.isConfigured) return [];

		const request = opts.query
			? await this.textSearchRequest(opts)
			: await this.nearbySearchRequest(opts);

		if (!request) return [];

		try {
			const response = await fetch(request.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Goog-Api-Key': this.globalConfig.voyagr.googlePlacesKey,
					'X-Goog-FieldMask': FIELD_MASK,
				},
				body: JSON.stringify(request.body),
			});

			if (!response.ok) return [];

			const body: unknown = await response.json();
			if (typeof body !== 'object' || body === null) return [];

			const { places } = body as { places?: GooglePlace[] };
			if (!Array.isArray(places)) return [];

			return places.flatMap((place) => this.toPlaceResult(place));
		} catch {
			// The panel is an assist, never a blocker.
			return [];
		}
	}

	/** Free-text search, used when the traveller typed something specific. */
	private async textSearchRequest(opts: PlaceSearchOptions) {
		return {
			url: SEARCH_TEXT_URL,
			body: {
				textQuery: `${opts.query} in ${opts.near}`,
				// Text Search takes exactly one type, so the kind's primary applies.
				includedType: TYPES[opts.kind][0],
				pageSize: opts.limit,
				...this.locale(),
			},
		};
	}

	/** Browse-by-category, the default path behind the suggestions panel. */
	private async nearbySearchRequest(opts: PlaceSearchOptions) {
		const coordinates = await this.geocoder.geocode(opts.near);
		if (!coordinates) return undefined;

		return {
			url: SEARCH_NEARBY_URL,
			body: {
				includedTypes: TYPES[opts.kind],
				maxResultCount: opts.limit,
				rankPreference: 'POPULARITY',
				locationRestriction: {
					circle: {
						center: { latitude: coordinates.lat, longitude: coordinates.lon },
						radius: SEARCH_RADIUS_METRES,
					},
				},
				...this.locale(),
			},
		};
	}

	/**
	 * English names keep the cards readable for the traveller planning the trip,
	 * rather than the language of wherever they are going.
	 */
	private locale() {
		return { languageCode: 'en' };
	}

	/** Returns an empty array for a place too incomplete to show on a card. */
	private toPlaceResult(place: GooglePlace): PlaceResult[] {
		const latitude = place.location?.latitude;
		const longitude = place.location?.longitude;
		const name = place.displayName?.text;

		if (!place.id || !name || latitude === undefined || longitude === undefined) {
			return [];
		}

		const photo = place.photos?.[0]?.name;

		return [
			{
				providerId: `gpl:${place.id}`,
				name,
				address: place.shortFormattedAddress ?? place.formattedAddress,
				lat: latitude,
				lon: longitude,
				// Google already rates out of 5, so this passes through untouched.
				rating: place.rating,
				ratingCount: place.userRatingCount,
				priceTier: place.priceLevel ? PRICE_TIERS[place.priceLevel] : undefined,
				// Deliberately our own endpoint, not Google's: their media URL takes
				// the API key as a query parameter, so linking it directly would ship
				// an operator's billable key to every browser that renders a card.
				photoUrl: photo ? `/rest/voyagr/places/photo?name=${encodeURIComponent(photo)}` : undefined,
			},
		];
	}
}
