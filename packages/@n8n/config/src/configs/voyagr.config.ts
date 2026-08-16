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

	/**
	 * Groq API key used to generate trip itineraries. Operator-owned —
	 * Voyagr users never see or enter it. Generation is disabled gracefully
	 * when this is empty.
	 */
	@Env('VOYAGR_GROQ_KEY')
	groqKey: string = '';
}
