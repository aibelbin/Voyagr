import { Service } from '@n8n/di';

type Entry = { value: unknown; expiresAt: number };

/**
 * In-memory TTL cache for provider responses.
 *
 * One operator-owned key on a free tier serves every Voyagr user, so caching is
 * what keeps the feature inside quota rather than a nice-to-have. Entries are
 * lost on restart, which is acceptable: a redeploy costs one cold window, not a
 * sustained increase in call volume.
 */
@Service()
export class PlaceCache {
	private readonly entries = new Map<string, Entry>();

	/** Bounded so a long-running instance cannot grow without limit. */
	private readonly maxEntries = 500;

	get<T>(key: string): T | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;

		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}

		return entry.value as T;
	}

	set<T>(key: string, value: T, ttlMs: number): void {
		if (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (!oldest.done) this.entries.delete(oldest.value);
		}

		this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
	}

	/** Seam for tests. */
	protected now(): number {
		return Date.now();
	}
}
