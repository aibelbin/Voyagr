import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { Get, Query, RestController } from '@n8n/decorators';

import { PlacesQueryDto } from './places-query.dto';
import { PlacesService } from './places.service';

const PLACE_KINDS: PlaceKind[] = [
	'hotel',
	'restaurant',
	'cafe',
	'attraction',
	'activity',
	'shopping',
];

function isPlaceKind(value: string): value is PlaceKind {
	return PLACE_KINDS.some((kind) => kind === value);
}

@RestController('/voyagr')
export class PlacesController {
	constructor(private readonly placesService: PlacesService) {}

	/**
	 * Suggestions for one kind of stop near one destination.
	 *
	 * No scope decorator: this is a keyless read-only lookup against a third
	 * party, not an operation on a Voyagr resource, so there is no resource to
	 * authorize against. It sits behind the same session auth as every other
	 * REST route.
	 */
	@Get('/places')
	async getPlaces(
		_req: unknown,
		_res: unknown,
		@Query query: PlacesQueryDto,
	): Promise<PlaceResult[]> {
		const { kind, near, q } = query;

		if (!kind || !isPlaceKind(kind) || !near) return [];

		return await this.placesService.search(kind, near, q);
	}
}
