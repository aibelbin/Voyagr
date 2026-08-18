import type { INodeParameters } from 'n8n-workflow';

/**
 * What each kind of stop costs, so the canvas can price an itinerary as the
 * traveller builds it.
 *
 * Pure by design — no stores, no Vue, no clock. Every formula reads only the
 * node's own parameters plus the party size, which is what makes the whole
 * budget recomputable from the workflow document alone.
 */

/** A price. Anything not a positive finite number reads as nothing to charge. */
function amount(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** A multiplier such as nights or days, falling back to the node's own default. */
function count(value: unknown, fallback: number): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type CostFormula = (parameters: INodeParameters, travellers: number) => number;

/**
 * Per-person costs are multiplied by the party; per-unit costs are not. A hotel
 * room and a rental car carry the whole party, and Shopping is already a lump
 * sum the traveller set themselves.
 */
const FORMULAS: Record<string, CostFormula> = {
	'n8n-nodes-base.hotel': (p) => amount(p.pricePerNight) * count(p.nights, 1),
	'n8n-nodes-base.carRental': (p) => amount(p.pricePerDay) * count(p.days, 1),
	'n8n-nodes-base.shopping': (p) => amount(p.budget),
	'n8n-nodes-base.flight': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.train': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.bus': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.ferry': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.activity': (p, travellers) => amount(p.price) * travellers,
	'n8n-nodes-base.restaurant': (p, travellers) => amount(p.avgCost) * travellers,
	'n8n-nodes-base.cafe': (p, travellers) => amount(p.avgCost) * travellers,
	'n8n-nodes-base.touristDestination': (p, travellers) => amount(p.entryFee) * travellers,
	'n8n-nodes-base.freeTime': () => 0,
};

/** Zero for any node with nothing to charge, including ones added after this table. */
export function nodeCost(
	nodeType: string,
	parameters: INodeParameters,
	travellers: number,
): number {
	return FORMULAS[nodeType]?.(parameters, travellers) ?? 0;
}
