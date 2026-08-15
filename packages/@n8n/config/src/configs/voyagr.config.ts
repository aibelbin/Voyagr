import { Config, Env } from '../decorators';

@Config
export class VoyagrConfig {
	/**
	 * Foursquare Places API key used to suggest hotels, restaurants and sights.
	 * Operator-owned — Voyagr users never see or enter it. Suggestions are
	 * disabled gracefully when this is empty.
	 */
	@Env('VOYAGR_PLACES_KEY')
	placesKey: string = '';
}
