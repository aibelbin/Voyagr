import { Config, Env } from '../decorators';

@Config
export class VoyagrConfig {
	/**
	 * Google Places API (New) key used to suggest hotels, restaurants and sights.
	 * Operator-owned — Voyagr users never see or enter it, and it must never
	 * reach the browser, which is why photos are proxied rather than linked.
	 * Suggestions are disabled gracefully when this is empty.
	 */
	@Env('VOYAGR_GOOGLE_PLACES_KEY')
	googlePlacesKey: string = '';

	/**
	 * Foursquare Places API key.
	 *
	 * Nothing reads this today: `PlacesService` injects the Google provider, and
	 * `FoursquareProvider` is kept only as a working second implementation of
	 * `PlaceSearchProvider` should the licensing or cost calculus change. Setting
	 * this key on its own will not enable suggestions.
	 */
	@Env('VOYAGR_PLACES_KEY')
	placesKey: string = '';

	/**
	 * Groq API key used to generate trip itineraries. Operator-owned —
	 * Voyagr users never see or enter it. Generation is disabled gracefully
	 * when this is empty.
	 */
	@Env('VOYAGR_GROQ_KEY')
	groqKey: string = '';
}
