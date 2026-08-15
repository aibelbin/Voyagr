import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import type { INodeParameters } from 'n8n-workflow';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';

import type { INodeUi, IUpdateInformation } from '@/Interface';
import { ndvEventBus } from '@/features/ndv/shared/ndv.eventBus';

/** The trigger node that carries the trip's destination. */
const TRIP_START_NODE_TYPE = 'n8n-nodes-base.tripStart';

/** Only these node types get suggestions; anything else hides the panel. */
const NODE_TYPE_TO_PLACE_KIND: Record<string, PlaceKind> = {
	'n8n-nodes-base.hotel': 'hotel',
	'n8n-nodes-base.restaurant': 'restaurant',
	'n8n-nodes-base.cafe': 'cafe',
	'n8n-nodes-base.touristDestination': 'attraction',
	'n8n-nodes-base.activity': 'activity',
	'n8n-nodes-base.shopping': 'shopping',
};

/** The headline name field differs per node. */
const KIND_TO_NAME_PARAM: Record<PlaceKind, string> = {
	hotel: 'hotelName',
	restaurant: 'restaurantName',
	cafe: 'name',
	attraction: 'placeName',
	activity: 'name',
	shopping: 'name',
};

export function usePlacesPanel(
	activeNode: ComputedRef<INodeUi | null>,
	allNodes: ComputedRef<INodeUi[]>,
) {
	const placeKind = computed<PlaceKind | null>(() =>
		activeNode.value ? (NODE_TYPE_TO_PLACE_KIND[activeNode.value.type] ?? null) : null,
	);

	const tripDestination = computed(() => {
		const tripStart = allNodes.value.find((node) => node.type === TRIP_START_NODE_TYPE);
		const destination = tripStart?.parameters.destination;
		return typeof destination === 'string' ? destination : '';
	});

	function pickPlace(place: PlaceResult): void {
		const node = activeNode.value;
		const kind = placeKind.value;

		if (!node || !kind) {
			return;
		}

		const parameters: INodeParameters = {
			[KIND_TO_NAME_PARAM[kind]]: place.name,
			placeId: place.providerId,
			rating: place.rating ?? 0,
			priceTier: place.priceTier ?? 0,
			photoUrl: place.photoUrl ?? '',
		};

		// Only overwrite the location when the provider actually gave us one, so
		// picking a place never blanks an address the traveller typed by hand.
		if (place.address) {
			parameters.location = place.address;
		}

		// One bulk emit, not one per field: NodeSettings listens on this bus with
		// the very handler its own parameter inputs use, so the write lands via
		// `setNodeParameters` with the form's mirror, dirty flag and node issues
		// all kept in step. Sequential emits would read stale parameters and the
		// earlier fields would be lost.
		const update: IUpdateInformation = {
			name: 'parameters',
			node: node.name,
			value: parameters,
		};

		ndvEventBus.emit('updateParameterValue', update);
	}

	return { placeKind, tripDestination, pickPlace };
}
