import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@n8n/i18n';
import { N8nIcon } from '@n8n/design-system';
import { useUIStore } from '@/app/stores/ui.store';
import { VIEWS, VOYAGR_FEEDBACK_MODAL_KEY } from '@/app/constants';
import { hasPermission } from '@/app/utils/rbac/permissions';
import type { CommandGroup, CommandBarItem } from '../types';
import { CHAT_VIEW } from '@/features/ai/chatHub/constants';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useTemplatesStore } from '@/features/workflows/templates/templates.store';

const ITEM_ID = {
	CHAT_HUB: 'chat-hub',
	SETTINGS: 'settings',
	SIGN_OUT: 'sign-out',
	TEMPLATES: 'templates',
	VARIABLES: 'variables',
	INSIGHTS: 'insights',
	FEEDBACK: 'feedback',
} as const;

export function useGenericCommands(): CommandGroup {
	const i18n = useI18n();
	const uiStore = useUIStore();
	const router = useRouter();
	const settingsStore = useSettingsStore();
	const projectsStore = useProjectsStore();
	const templatesStore = useTemplatesStore();

	const genericCommands = computed<CommandBarItem[]>(() => [
		...(settingsStore.isChatFeatureEnabled
			? [
					{
						id: ITEM_ID.CHAT_HUB,
						title: i18n.baseText('projects.menu.chat'),
						section: i18n.baseText('commandBar.sections.general'),
						handler: () => {
							void router.push({ name: CHAT_VIEW, force: true });
						},
						icon: {
							component: N8nIcon,
							props: {
								icon: 'message-circle',
							},
						},
						keywords: ['chat', 'open chat', i18n.baseText('projects.menu.chat').toLowerCase()],
					},
				]
			: []),
		...(projectsStore.canViewProjects
			? [
					{
						id: ITEM_ID.TEMPLATES,
						title: i18n.baseText('generic.templates'),
						section: i18n.baseText('commandBar.sections.general'),
						handler: () => {
							if (templatesStore.hasCustomTemplatesHost) {
								void router.push({ name: VIEWS.TEMPLATES });
							} else {
								window.open(templatesStore.websiteTemplateRepositoryURL, '_blank');
							}
						},
						icon: {
							component: N8nIcon,
							props: {
								icon: 'package-open',
							},
						},
						keywords: [i18n.baseText('generic.templates').toLowerCase()],
					},
				]
			: []),
		...(projectsStore.canViewProjects
			? [
					{
						id: ITEM_ID.VARIABLES,
						title: i18n.baseText('mainSidebar.variables'),
						section: i18n.baseText('commandBar.sections.general'),
						handler: () => {
							void router.push({ name: VIEWS.HOME_VARIABLES });
						},
						icon: {
							component: N8nIcon,
							props: {
								icon: 'variable',
							},
						},
						keywords: [i18n.baseText('mainSidebar.variables').toLowerCase()],
					},
				]
			: []),
		...(projectsStore.canViewProjects &&
		settingsStore.isModuleActive('insights') &&
		hasPermission(['rbac'], { rbac: { scope: 'insights:list' } })
			? [
					{
						id: ITEM_ID.INSIGHTS,
						title: 'Insights',
						section: i18n.baseText('commandBar.sections.general'),
						handler: () => {
							void router.push({ name: VIEWS.INSIGHTS });
						},
						icon: {
							component: N8nIcon,
							props: {
								icon: 'chart-column-decreasing',
							},
						},
						keywords: ['insights'],
					},
				]
			: []),
		{
			id: ITEM_ID.FEEDBACK,
			title: i18n.baseText('voyagr.feedback.sidebar'),
			section: i18n.baseText('commandBar.sections.general'),
			handler: () => {
				uiStore.openModal(VOYAGR_FEEDBACK_MODAL_KEY);
			},
			icon: {
				component: N8nIcon,
				props: {
					icon: 'message-square',
				},
			},
			keywords: [i18n.baseText('voyagr.feedback.sidebar').toLowerCase()],
		},
		{
			id: ITEM_ID.SETTINGS,
			title: i18n.baseText('settings'),
			section: i18n.baseText('commandBar.sections.general'),
			handler: () => {
				void router.push({ name: VIEWS.SETTINGS });
			},
			icon: {
				component: N8nIcon,
				props: {
					icon: 'cog',
				},
			},
			keywords: [i18n.baseText('settings').toLowerCase()],
		},
		{
			id: ITEM_ID.SIGN_OUT,
			title: i18n.baseText('auth.signout'),
			section: i18n.baseText('commandBar.sections.general'),
			handler: () => {
				void router.push({ name: VIEWS.SIGNOUT });
			},
			icon: {
				component: N8nIcon,
				props: {
					icon: 'sign-out-alt',
				},
			},
			keywords: [i18n.baseText('auth.signout').toLowerCase()],
		},
	]);

	return {
		commands: genericCommands,
	};
}
