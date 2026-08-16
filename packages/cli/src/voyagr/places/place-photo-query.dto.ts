import { Z } from '@n8n/api-types';
import { z } from 'zod';

/**
 * A Google photo resource path, e.g. `places/<place>/photos/<photo>`.
 *
 * Pattern-checked rather than taken on trust: this value is interpolated into
 * an outbound URL, so anything looser would let a caller point the server at a
 * host of their choosing.
 */
export class PlacePhotoQueryDto extends Z.class({
	name: z
		.string()
		.regex(/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/)
		.optional(),
}) {}
