import type { GeneratedTripOption, PlaceResult, TripGenerationRequest } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import OpenAI from 'openai';

import type { CandidateGroup } from './candidate-pool';
import { CandidatePoolBuilder } from './candidate-pool';
import { tripOptionsJsonSchema, tripOptionsSchema } from './trip-options.schema';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const MODEL = 'openai/gpt-oss-120b';

/**
 * Groq's free tier allows 8,000 tokens per minute across input and output
 * combined, so this ceiling is a budget, not a safety margin. Reasoning tokens
 * count towards it too, which is why effort is held low: the hard thinking here
 * is choosing between places we already vetted, not solving anything.
 */
const MAX_COMPLETION_TOKENS = 4000;

/**
 * How many places of each kind to offer. The pool holds up to twenty per kind
 * across five kinds; sending all hundred would spend most of the per-minute
 * budget on candidates the model was never going to pick. Twelve of each is
 * still far more combinations than three itineraries can use.
 */
const PER_KIND_LIMIT = 12;

/** Three is the product requirement; the model is asked for exactly this many. */
const OPTION_COUNT = 3;

export type GenerationResult = {
	options: GeneratedTripOption[];
	placesById: Map<string, PlaceResult>;
};

@Service()
export class GeneratorService {
	constructor(
		private readonly globalConfig: GlobalConfig,
		private readonly pool: CandidatePoolBuilder,
		private readonly logger: Logger,
	) {}

	get isConfigured(): boolean {
		return this.globalConfig.voyagr.groqKey !== '';
	}

	/** Returns undefined whenever generation cannot run, for any reason. */
	async generate(request: TripGenerationRequest): Promise<GenerationResult | undefined> {
		if (!this.isConfigured) return undefined;

		const groups = (await this.pool.buildByKind(request.destination, request.tastes))
			.map((group) => ({ kind: group.kind, places: group.places.slice(0, PER_KIND_LIMIT) }))
			.filter((group) => group.places.length > 0);

		const places = groups.flatMap((group) => group.places);
		if (places.length === 0) return undefined;

		const client = new OpenAI({
			apiKey: this.globalConfig.voyagr.groqKey,
			baseURL: GROQ_BASE_URL,
		});

		try {
			const response = await client.chat.completions.create({
				model: MODEL,
				max_completion_tokens: MAX_COMPLETION_TOKENS,
				reasoning_effort: 'low',
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'trip_options',
						// Constrained decoding: the model physically cannot emit a
						// token that breaks the schema, which is what guarantees a
						// provider id rather than an invented place name.
						strict: true,
						schema: tripOptionsJsonSchema,
					},
				},
				messages: [{ role: 'user', content: this.buildPrompt(request, groups) }],
			});

			const choice = response.choices[0];

			// A declined request comes back 200 with a stop reason rather than an
			// error, so this has to be checked before touching the content.
			if (choice?.finish_reason === 'content_filter') {
				this.logger.warn('Trip generation was declined by the model');
				return undefined;
			}

			const content = choice?.message?.content;
			if (!content) return undefined;

			// Strict mode makes malformed JSON very unlikely, but the boundary is
			// still untrusted input: parse and validate rather than assume.
			const parsed = tripOptionsSchema.safeParse(JSON.parse(content));
			if (!parsed.success) {
				this.logger.warn('Trip generation returned an unusable shape', {
					error: parsed.error,
				});
				return undefined;
			}

			const options = parsed.data.options
				.filter((option) => option.stops.length > 0)
				.slice(0, OPTION_COUNT);

			if (options.length === 0) return undefined;

			return {
				options,
				placesById: new Map(places.map((place) => [place.providerId, place])),
			};
		} catch (error) {
			this.logger.warn('Trip generation failed', { error });
			return undefined;
		}
	}

	/**
	 * One line per place, and nothing per place we don't need.
	 *
	 * Blurbs, websites, photo URLs and addresses are all left out: they would
	 * more than double the prompt without changing which places suit a trip,
	 * and the whole exchange has to fit inside a per-minute token budget shared
	 * with the answer. The workflow the traveller ends up looking at carries the
	 * full record anyway — the model only ever needs enough to choose.
	 */
	private buildPrompt(request: TripGenerationRequest, groups: CandidateGroup[]): string {
		const pool = groups
			.map((group) => {
				const lines = group.places.map((place) => {
					const rating = place.rating === undefined ? '' : ` ${place.rating.toFixed(1)}/5`;
					const price = place.priceTier === undefined ? '' : ` ${'$'.repeat(place.priceTier)}`;

					return `${place.providerId} | ${place.name}${rating}${price}`;
				});

				return [`## ${group.kind}`, ...lines].join('\n');
			})
			.join('\n');

		return [
			`Plan a trip to ${request.destination}, leaving from ${request.startLocation}.`,
			`Dates: ${request.startDate} to ${request.endDate}. Budget: ${request.budget} ${request.currency}.`,
			'',
			`The traveller's pace preference is ${request.tastes.pace}/100, where 0 is very relaxed and 100 is packed with activity.`,
			`Their landscape preference is ${request.tastes.terrain}/100, where 0 is mountains and 100 is beaches.`,
			'',
			'Here are the real places available, grouped by kind and listed as',
			'"providerId | name rating price". You may only choose from this list, by providerId,',
			'and each stop\'s kind must be the heading it was listed under:',
			pool,
			'',
			`Produce ${OPTION_COUNT} itineraries. All ${OPTION_COUNT} must suit the preferences above — they are not`,
			'meant to be relaxed-versus-packed alternatives. What should differ between them is the',
			'combination of specific places: different hotels, different places to eat, different',
			'things to see. Give each option a short name and one line saying what makes it distinct.',
			'',
			"Order each option's stops in the order the traveller would visit them, and set dayOffset",
			'to the day of the trip each stop falls on, counting from 0. Never invent a place: every',
			'providerId must appear in the list above.',
		].join('\n');
	}
}
