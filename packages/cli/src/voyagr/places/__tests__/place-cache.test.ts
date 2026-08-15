import { PlaceCache } from '../place-cache';

class TestCache extends PlaceCache {
	public clock = 0;

	protected now(): number {
		return this.clock;
	}
}

describe('PlaceCache', () => {
	it('returns a stored value before it expires', () => {
		const cache = new TestCache();
		cache.set('kyoto', ['a'], 1000);

		cache.clock = 999;

		expect(cache.get('kyoto')).toEqual(['a']);
	});

	it('drops a value once its ttl has passed', () => {
		const cache = new TestCache();
		cache.set('kyoto', ['a'], 1000);

		cache.clock = 1000;

		expect(cache.get('kyoto')).toBeUndefined();
	});

	it('returns undefined for a key it never held', () => {
		expect(new TestCache().get('osaka')).toBeUndefined();
	});
});
