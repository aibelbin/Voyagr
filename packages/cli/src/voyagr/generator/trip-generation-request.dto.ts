import { Z } from '@n8n/api-types';
import { z } from 'zod';

/**
 * Everything the six-field form collects.
 *
 * `@Body` needs a class carrying a `safeParse` for the controller registry to
 * inject it at all, so this mirrors `TripGenerationRequest` as a zod class.
 *
 * Deliberately free of `.min()` and range checks: a thin or odd payload must
 * come back as one quiet "couldn't plan this" rather than a validation error,
 * so emptiness is settled downstream — an unknown destination simply finds no
 * places. The sliders are clamped rather than rejected for the same reason.
 */
export class TripGenerationRequestDto extends Z.class({
	destination: z.string(),
	startLocation: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	budget: z.number(),
	currency: z.string(),
	// Clamped rather than rejected, like the sliders: a thin payload must come
	// back as one quiet "couldn't plan this", never a validation error.
	travellers: z.number().min(1).catch(1),
	tastes: z.object({
		pace: z.number().min(0).max(100).catch(50),
		terrain: z.number().min(0).max(100).catch(50),
	}),
}) {}
