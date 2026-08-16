import type { GeneratedTripOption, PlaceKind, PlaceResult } from '@n8n/api-types';
import type { IConnections, INode } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export type TripWorkflowParams = {
	startLocation: string;
	destination: string;
	startDate: string;
	endDate: string;
	budget: number;
	currency: string;
};

const TRIGGER_NAME = 'Start Trip';

const KIND_TO_NODE_TYPE: Record<PlaceKind, string> = {
	hotel: 'n8n-nodes-base.hotel',
	restaurant: 'n8n-nodes-base.restaurant',
	cafe: 'n8n-nodes-base.cafe',
	attraction: 'n8n-nodes-base.touristDestination',
	activity: 'n8n-nodes-base.activity',
	shopping: 'n8n-nodes-base.shopping',
};

/** Each node type names its headline field differently. */
const KIND_TO_NAME_PARAM: Record<PlaceKind, string> = {
	hotel: 'hotelName',
	restaurant: 'restaurantName',
	cafe: 'name',
	attraction: 'placeName',
	activity: 'name',
	shopping: 'name',
};

const STOP_SPACING = 250;
const BRANCH_SPACING = 220;

/**
 * Turns generated options into a canvas: one trigger fanning out to one branch
 * per option, so a traveller can compare them side by side, keep the one they
 * like, and splice pieces between them.
 *
 * Pure and deterministic — no clock, no randomness, no I/O.
 */
export function buildTripWorkflow(
	params: TripWorkflowParams,
	options: GeneratedTripOption[],
	placesById: Map<string, PlaceResult>,
): { nodes: INode[]; connections: IConnections } {
	const trigger: INode = {
		id: 'trip-start',
		name: TRIGGER_NAME,
		type: 'n8n-nodes-base.tripStart',
		typeVersion: 1,
		position: [0, 0],
		parameters: {
			startLocation: params.startLocation,
			destination: params.destination,
			startDate: params.startDate,
			endDate: params.endDate,
			budget: params.budget,
			currency: params.currency,
		},
	};

	const nodes: INode[] = [trigger];
	const connections: IConnections = {};
	const branchHeads: string[] = [];
	const usedNames = new Set<string>([TRIGGER_NAME]);

	options.forEach((option, optionIndex) => {
		// Centre the branches vertically on the trigger.
		const y = (optionIndex - (options.length - 1) / 2) * BRANCH_SPACING;
		let previousName: string | undefined;
		let stopIndex = 0;

		for (const stop of option.stops) {
			const place = placesById.get(stop.providerId);

			// The model may only choose from the pool we supplied. Anything else
			// is dropped rather than drawn as a node we cannot vouch for.
			if (!place) continue;

			const name = uniqueName(place.name, usedNames);
			usedNames.add(name);

			nodes.push({
				id: `${optionIndex}-${stopIndex}`,
				name,
				type: KIND_TO_NODE_TYPE[stop.kind],
				typeVersion: 1,
				position: [(stopIndex + 1) * STOP_SPACING, y],
				parameters: {
					[KIND_TO_NAME_PARAM[stop.kind]]: place.name,
					location: place.address ?? '',
					placeId: place.providerId,
					rating: place.rating ?? 0,
					priceTier: place.priceTier ?? 0,
					photoUrl: place.photoUrl ?? '',
				},
			});

			if (previousName === undefined) {
				branchHeads.push(name);
			} else {
				connections[previousName] = {
					[NodeConnectionTypes.Main]: [
						[{ node: name, type: NodeConnectionTypes.Main, index: 0 }],
					],
				};
			}

			previousName = name;
			stopIndex += 1;
		}
	});

	if (branchHeads.length > 0) {
		connections[TRIGGER_NAME] = {
			[NodeConnectionTypes.Main]: [
				branchHeads.map((node) => ({ node, type: NodeConnectionTypes.Main, index: 0 })),
			],
		};
	}

	return { nodes, connections };
}

/** n8n requires node names to be unique within a workflow. */
function uniqueName(preferred: string, taken: Set<string>): string {
	if (!taken.has(preferred)) return preferred;

	let suffix = 1;
	while (taken.has(`${preferred} ${suffix}`)) suffix += 1;

	return `${preferred} ${suffix}`;
}
