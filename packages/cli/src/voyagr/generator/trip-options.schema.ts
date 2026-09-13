import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * The shape the model must return.
 *
 * `providerId` is deliberately a plain string validated against the pool after
 * the fact rather than an enum: a pool of sixty ids would bloat the schema,
 * and anything unrecognised is dropped by the materialiser anyway.
 *
 * Deliberately free of `.min()` / `.max()` on the arrays. Strict structured
 * output accepts only a subset of JSON Schema — `minItems`/`maxItems` are not
 * in it, and a schema carrying them is rejected. Cardinality is enforced in the
 * service after parsing instead, where a violation can degrade quietly rather
 * than fail the request.
 */
export const tripOptionsSchema = z.object({
	options: z.array(
		z.object({
			name: z.string(),
			rationale: z.string(),
			stops: z.array(
				z.object({
					providerId: z.string(),
					kind: z.enum(['hotel', 'restaurant', 'cafe', 'attraction', 'activity', 'shopping']),
					dayOffset: z.number().int(),
				}),
			),
		}),
	),
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Makes a converted schema safe to send with `strict: true`.
 *
 * The provider rejects a strict schema unless every object sets
 * `additionalProperties: false` and repeats every one of its properties in
 * `required`. `zod-to-json-schema` already emits both for these objects, but
 * that is a property of the current version rather than a promise, so this
 * re-asserts them rather than trusting them. It also drops `$schema`, which is
 * metadata the strict subset has no use for.
 */
function toStrictJsonSchema(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(toStrictJsonSchema);
	if (!isRecord(node)) return node;

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(node)) {
		if (key === '$schema') continue;
		result[key] = toStrictJsonSchema(value);
	}

	const properties = result.properties;
	if (result.type === 'object' && isRecord(properties)) {
		result.required = Object.keys(properties);
		result.additionalProperties = false;
	}

	return result;
}

/**
 * Derived once at module load — the schema never varies per request.
 *
 * `$refStrategy: 'none'` inlines everything: strict mode is happier with a
 * self-contained schema than with `$ref`/`$defs` indirection.
 */
const converted = toStrictJsonSchema(zodToJsonSchema(tripOptionsSchema, { $refStrategy: 'none' }));

export const tripOptionsJsonSchema: Record<string, unknown> = isRecord(converted) ? converted : {};
