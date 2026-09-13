import type { PlaceKind, PlaceResult } from '@n8n/api-types';

export type PlaceSearchOptions = {
	kind: PlaceKind;
	/** A place name to search near, e.g. "Kyoto, Japan". */
	near: string;
	/** Optional free text to narrow the search within that area. */
	query?: string;
	limit: number;
};

/** A source of real places. The panel never learns which one answered. */
export interface PlaceSearchProvider {
	search(opts: PlaceSearchOptions): Promise<PlaceResult[]>;
}
