import { getChildNodes } from 'n8n-workflow';
import type { IConnections } from 'n8n-workflow';

import type { INodeUi } from '@/Interface';

import { nodeCost } from './tripCost';

const TRIP_START_NODE_TYPE = 'n8n-nodes-base.tripStart';

const DEFAULT_CURRENCY = 'USD';

export type TripBudgetBranch = {
	/**
	 * 1-based, in Start Trip's connection order — which is the order
	 * `buildTripWorkflow` lays branches out down the canvas, so "Option 2" in the
	 * pill is the second branch the traveller sees.
	 */
	index: number;
	total: number;
};

export type TripBudget = {
	/**
	 * Zero or negative means the traveller has not set one, matching
	 * `computeTripSummary`'s semantics — though this side also coerces a
	 * numeric string, since node parameters can legitimately arrive as one.
	 */
	budget: number;
	currency: string;
	travellers: number;
	costByNodeId: Map<string, number>;
	branches: TripBudgetBranch[];
};

/**
 * A zero or negative budget means unset, not free — same semantics as
 * `computeTripSummary`'s `asAmount`, but this also coerces a numeric string
 * rather than treating it as unset.
 */
function readAmount(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readTravellers(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function readCurrency(value: unknown): string {
	return typeof value === 'string' && value.trim() !== '' ? value : DEFAULT_CURRENCY;
}

/**
 * Prices a canvas.
 *
 * Branches matter because a generated trip is three alternative itineraries
 * fanning out of one trigger: summing the canvas would read as instantly over
 * budget. Each branch is totalled on its own so the options can be compared
 * against the same budget.
 *
 * Pure — no stores, no clock. `useTripBudget` is the reactive wrapper.
 */
export function computeTripBudget(nodes: INodeUi[], connections: IConnections): TripBudget {
	const tripStart = nodes.find((node) => node.type === TRIP_START_NODE_TYPE);
	const parameters = tripStart?.parameters ?? {};

	const travellers = readTravellers(parameters.travellers);

	const costByNodeId = new Map<string, number>();
	const costByNodeName = new Map<string, number>();

	for (const node of nodes) {
		const cost = nodeCost(node.type, node.parameters ?? {}, travellers);
		costByNodeId.set(node.id, cost);
		costByNodeName.set(node.name, cost);
	}

	const total = (names: Iterable<string>) => {
		let sum = 0;
		for (const name of names) sum += costByNodeName.get(name) ?? 0;
		return sum;
	};

	// No trigger yet (a canvas mid-build): price everything as one itinerary,
	// which is what a traveller laying out a single trip would expect.
	const branches: TripBudgetBranch[] = tripStart
		? (connections[tripStart.name]?.main?.[0] ?? []).map((edge, position) => ({
				index: position + 1,
				// A branch is the edge's own node plus everything downstream of it;
				// `getChildNodes` excludes the queried node, so it's re-added here.
				total: total([edge.node, ...getChildNodes(connections, edge.node, 'main', -1)]),
			}))
		: [{ index: 1, total: total(costByNodeName.keys()) }];

	return {
		budget: readAmount(parameters.budget),
		currency: readCurrency(parameters.currency),
		travellers,
		costByNodeId,
		branches,
	};
}
