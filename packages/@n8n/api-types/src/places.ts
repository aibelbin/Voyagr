/** The kinds of place Voyagr can suggest, one per travel node type. */
export type PlaceKind =
	| 'hotel'
	| 'restaurant'
	| 'cafe'
	| 'attraction'
	| 'activity'
	| 'shopping';

/** A real place, normalised across whichever provider returned it. */
export type PlaceResult = {
	/** Provider-prefixed identifier, e.g. "fsq:4b0588...". */
	providerId: string;
	name: string;
	address?: string;
	lat: number;
	lon: number;
	/** Normalised to 0-5 regardless of the provider's own scale. */
	rating?: number;
	ratingCount?: number;
	priceTier?: 1 | 2 | 3 | 4;
	photoUrl?: string;
	/** A tip snippet or encyclopaedia extract, one line. */
	blurb?: string;
	website?: string;
};
