import type { PlaceResult } from '@n8n/api-types';
import { Service } from '@n8n/di';

const WIKI_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';

/**
 * Fills in a photo and a one-line blurb for landmarks the primary provider is
 * thin on. Keyless, and best-effort: a miss simply leaves the card as it was.
 */
@Service()
export class WikipediaEnricher {
	async enrich(results: PlaceResult[]): Promise<PlaceResult[]> {
		return await Promise.all(
			results.map(async (result) =>
				result.photoUrl && result.blurb ? result : await this.enrichOne(result),
			),
		);
	}

	private async enrichOne(result: PlaceResult): Promise<PlaceResult> {
		try {
			const response = await fetch(`${WIKI_SUMMARY_URL}/${encodeURIComponent(result.name)}`, {
				headers: { 'User-Agent': 'Voyagr/1.0 (travel itinerary planner)' },
			});

			if (!response.ok) return result;

			const body: unknown = await response.json();
			if (typeof body !== 'object' || body === null) return result;

			const { extract, thumbnail } = body as {
				extract?: string;
				thumbnail?: { source?: string };
			};

			return {
				...result,
				photoUrl: result.photoUrl ?? thumbnail?.source,
				blurb: result.blurb ?? extract,
			};
		} catch {
			return result;
		}
	}
}
