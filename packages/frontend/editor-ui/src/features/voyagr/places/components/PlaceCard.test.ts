import type { PlaceResult } from '@n8n/api-types';
import { nextTick } from 'vue';

import { createComponentRenderer } from '@/__tests__/render';

import PlaceCard from './PlaceCard.vue';

const place: PlaceResult = {
	providerId: 'gpl:1',
	name: 'Hanging Restaurant & Bar',
	address: 'Sekumpul, Buleleng',
	lat: -8.2,
	lon: 115.1,
	rating: 4.3,
	ratingCount: 538,
	priceTier: 2,
	photoUrl: '/rest/voyagr/places/photo?name=places/a/photos/b',
};

const otherPlace: PlaceResult = {
	providerId: 'gpl:2',
	name: 'Beachside Grill',
	address: 'Lovina, Buleleng',
	lat: -8.15,
	lon: 115.03,
	photoUrl: '/rest/voyagr/places/photo?name=places/c/photos/d',
};

const renderComponent = createComponentRenderer(PlaceCard);

describe('PlaceCard', () => {
	it('renders the photo when the place has one', () => {
		const { container } = renderComponent({ props: { place } });

		expect(container.querySelector('img')).not.toBeNull();
	});

	it('drops the photo when it fails to load, leaving a clean card', async () => {
		const { container, getByText, getByRole } = renderComponent({ props: { place } });

		const image = container.querySelector('img');
		expect(image).not.toBeNull();

		image?.dispatchEvent(new Event('error'));
		await nextTick();

		expect(container.querySelector('img')).toBeNull();
		// The rest of the card survives — only the decoration is gone.
		expect(getByText('Hanging Restaurant & Bar')).toBeVisible();
		expect(getByText(/4\.3/)).toBeVisible();
		expect(getByRole('button', { name: 'Add to trip' })).toBeVisible();
	});

	it('retries the photo when the card is reused for a different place', async () => {
		const { container, rerender } = renderComponent({ props: { place } });

		const image = container.querySelector('img');
		expect(image).not.toBeNull();

		image?.dispatchEvent(new Event('error'));
		await nextTick();

		expect(container.querySelector('img')).toBeNull();

		// A recycled card (e.g. in a v-for) gets a different place with a different
		// photo — it should retry the photo rather than keep hiding it forever.
		await rerender({ place: otherPlace });

		expect(container.querySelector('img')).not.toBeNull();
	});
});
