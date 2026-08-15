import type { PlaceKind, PlaceResult } from '@n8n/api-types';
import { ref } from 'vue';

import { useRootStore } from '@n8n/stores/useRootStore';

import { fetchPlaces } from './places.api';

export function usePlaceSearch() {
	const rootStore = useRootStore();

	const results = ref<PlaceResult[]>([]);
	const loading = ref(false);
	const failed = ref(false);

	async function search(kind: PlaceKind, near: string, q?: string): Promise<void> {
		if (!near) {
			results.value = [];
			return;
		}

		loading.value = true;
		failed.value = false;

		try {
			results.value = await fetchPlaces(rootStore.restApiContext, { kind, near, q });
		} catch {
			// The panel is an assist, never a blocker: a failure shows a quiet
			// message and the traveller carries on typing the place by hand.
			results.value = [];
			failed.value = true;
		} finally {
			loading.value = false;
		}
	}

	return { results, loading, failed, search };
}
