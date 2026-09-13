import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export async function fetchPlaces(
	context: IRestApiContext,
	params: { kind: PlaceKind; near: string; q?: string },
): Promise<PlaceResult[]> {
	return await makeRestApiRequest<PlaceResult[]>(context, 'GET', '/voyagr/places', params);
}
