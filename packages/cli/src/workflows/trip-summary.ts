import type { TripSummary } from '@n8n/api-types';
import type { INode } from 'n8n-workflow';

const TRIP_START_NODE_TYPE = 'n8n-nodes-base.tripStart';

/** Nodes that annotate the itinerary rather than being a stop on it. */
const NON_STOP_NODE_TYPES = new Set([TRIP_START_NODE_TYPE, 'n8n-nodes-base.stickyNote']);

function asText(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** A zero or negative budget means the traveller has not set one. */
function asAmount(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function computeTripSummary(nodes: INode[]): TripSummary {
	const stopCount = nodes.filter((node) => !NON_STOP_NODE_TYPES.has(node.type)).length;
	const tripStart = nodes.find((node) => node.type === TRIP_START_NODE_TYPE);

	if (!tripStart) return { stopCount };

	const parameters = tripStart.parameters ?? {};

	return {
		stopCount,
		startLocation: asText(parameters.startLocation),
		startDate: asText(parameters.startDate),
		endDate: asText(parameters.endDate),
		budget: asAmount(parameters.budget),
		currency: asText(parameters.currency),
	};
}
