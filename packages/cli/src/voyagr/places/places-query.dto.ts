import { Z } from '@n8n/api-types';
import { z } from 'zod';

/**
 * Every field is an optional string. `kind`/`near` validity is checked in the
 * controller, not here: an unrecognised kind or a missing destination must
 * degrade to an empty result (200) rather than a 400, so the panel has one
 * empty state to render.
 */
export class PlacesQueryDto extends Z.class({
	kind: z.string().optional(),
	near: z.string().optional(),
	q: z.string().optional(),
}) {}
