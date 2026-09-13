import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { useGenericCommands } from './useGenericCommands';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useUIStore } from '@/app/stores/ui.store';
import { VIEWS, VOYAGR_FEEDBACK_MODAL_KEY } from '@/app/constants';
import { hasPermission } from '@/app/utils/rbac/permissions';

const routerPush = vi.fn();
vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: routerPush,
	}),
	useRoute: () => ({ params: {} }),
	RouterLink: vi.fn(),
}));

vi.mock('@n8n/i18n', async (importOriginal) => ({
	...(await importOriginal()),
	useI18n: () => ({
		baseText: (key: string) => key,
	}),
}));

vi.mock('@/app/utils/rbac/permissions', () => ({
	hasPermission: vi.fn(),
}));

describe('useGenericCommands', () => {
	let settingsStore: ReturnType<typeof useSettingsStore>;
	let uiStore: ReturnType<typeof useUIStore>;

	beforeEach(() => {
		setActivePinia(createTestingPinia());

		routerPush.mockClear();
		vi.mocked(hasPermission).mockReset().mockReturnValue(true);

		settingsStore = useSettingsStore();
		uiStore = useUIStore();
	});

	describe('insights command', () => {
		it('is not offered when the insights module is inactive (the default)', () => {
			vi.spyOn(settingsStore, 'isModuleActive').mockReturnValue(false);

			const { commands } = useGenericCommands();

			expect(commands.value.find((cmd) => cmd.id === 'insights')).toBeUndefined();
		});

		it('is not offered when the module is active but the user lacks the rbac scope', () => {
			vi.spyOn(settingsStore, 'isModuleActive').mockImplementation(
				(name: string) => name === 'insights',
			);
			vi.mocked(hasPermission).mockReturnValue(false);

			const { commands } = useGenericCommands();

			expect(commands.value.find((cmd) => cmd.id === 'insights')).toBeUndefined();
		});

		it('is offered, and navigates to the Insights view, when the module is active and permitted', () => {
			vi.spyOn(settingsStore, 'isModuleActive').mockImplementation(
				(name: string) => name === 'insights',
			);
			vi.mocked(hasPermission).mockReturnValue(true);

			const { commands } = useGenericCommands();

			const insightsCommand = commands.value.find((cmd) => cmd.id === 'insights');
			expect(insightsCommand).toBeDefined();

			insightsCommand?.handler?.();
			expect(routerPush).toHaveBeenCalledWith({ name: VIEWS.INSIGHTS });
		});
	});

	describe('feedback command', () => {
		it('opens the Voyagr feedback modal instead of filing an n8n GitHub issue', () => {
			vi.spyOn(settingsStore, 'isModuleActive').mockReturnValue(false);

			const { commands } = useGenericCommands();

			const feedbackCommand = commands.value.find((cmd) => cmd.id === 'feedback');
			expect(feedbackCommand).toBeDefined();
			expect(feedbackCommand?.title).toBe('voyagr.feedback.sidebar');

			feedbackCommand?.handler?.();
			expect(uiStore.openModal).toHaveBeenCalledWith(VOYAGR_FEEDBACK_MODAL_KEY);
		});
	});

	describe('n8n help group removal', () => {
		it('no longer offers the n8n help menu items', () => {
			vi.spyOn(settingsStore, 'isModuleActive').mockReturnValue(false);

			const { commands } = useGenericCommands();
			const ids = commands.value.map((cmd) => cmd.id);

			expect(ids).not.toContain('whats-new');
			expect(ids).not.toContain('quickstart');
			expect(ids).not.toContain('documentation');
			expect(ids).not.toContain('forum');
			expect(ids).not.toContain('course');
			expect(ids).not.toContain('report-bug');
			expect(ids).not.toContain('about');
		});
	});
});
