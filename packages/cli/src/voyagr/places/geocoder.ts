import { Service } from '@n8n/di';

import { PlaceCache } from './place-cache';

type Coordinates = { lat: number; lon: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Cities do not move, so a geocode stays good for a long time. */
const GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Turns a destination string into coordinates using OpenStreetMap's Nominatim,
 * which needs no API key. Its usage policy requires a descriptive User-Agent
 * and roughly one request per second; the cache keeps us far inside that.
 */
@Service()
export class Geocoder {
	constructor(private readonly cache: PlaceCache) {}

	async geocode(place: string): Promise<Coordinates | undefined> {
		const key = `geocode:${place.trim().toLowerCase()}`;

		const cached = this.cache.get<Coordinates>(key);
		if (cached) return cached;

		const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(place)}`;

		const response = await fetch(url, {
			headers: { 'User-Agent': 'Voyagr/1.0 (travel itinerary planner)' },
		});

		if (!response.ok) return undefined;

		const body: unknown = await response.json();
		if (!Array.isArray(body) || body.length === 0) return undefined;

		const first: unknown = body[0];
		if (typeof first !== 'object' || first === null) return undefined;

		const { lat, lon } = first as { lat?: string; lon?: string };
		if (typeof lat !== 'string' || typeof lon !== 'string') return undefined;

		const coordinates = { lat: Number(lat), lon: Number(lon) };
		if (Number.isNaN(coordinates.lat) || Number.isNaN(coordinates.lon)) return undefined;

		this.cache.set(key, coordinates, GEOCODE_TTL_MS);

		return coordinates;
	}
}
