<script setup lang="ts">
import WorkflowDetails from '@/app/components/MainHeader/WorkflowDetails.vue';
import TripBudgetPill from '@/features/voyagr/budget/components/TripBudgetPill.vue';
import { useI18n } from '@n8n/i18n';
import { usePushConnection } from '@/app/composables/usePushConnection';
import {
	LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON,
	STICKY_NODE_TYPE,
	N8N_MAIN_GITHUB_REPO_URL,
} from '@/app/constants';
import { injectNDVStoreIfProvided } from '@/features/ndv/shared/ndv.store';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useUIStore } from '@/app/stores/ui.store';
import { useWorkflowsListStore } from '@/app/stores/workflowsList.store';
import { computed, inject, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { WorkflowDocumentStoreKey } from '@/app/constants/injectionKeys';
import { useInjectWorkflowId } from '@/app/composables/useInjectWorkflowId';

import { useLocalStorage } from '@vueuse/core';
import GithubButton from 'vue-github-button';
import type { FolderShortInfo } from '@/features/core/folders/folders.types';

import { N8nIcon } from '@n8n/design-system';
import { useToast } from '@/app/composables/useToast';
const router = useRouter();
const route = useRoute();
const locale = useI18n();
const pushConnection = usePushConnection({ router });
const toast = useToast();
// The editor header renders before a workflow document is loaded (e.g. the
// blank-canvas boot window), so use the non-throwing accessor and guard reads.
const ndvStore = injectNDVStoreIfProvided();
const uiStore = useUIStore();
const workflowsListStore = useWorkflowsListStore();
const settingsStore = useSettingsStore();

const githubButtonHidden = useLocalStorage(LOCAL_STORAGE_HIDE_GITHUB_STAR_BUTTON, false);

const activeNode = computed(() => ndvStore.value?.activeNode ?? null);
const hideMenuBar = computed(() =>
	Boolean(activeNode.value && activeNode.value.type !== STICKY_NODE_TYPE),
);
const workflowId = useInjectWorkflowId();
const workflowDocumentStore = inject(WorkflowDocumentStoreKey, null);
const workflowName = computed(() => workflowDocumentStore?.value?.name ?? '');
const workflowTags = computed(() => workflowDocumentStore?.value?.tags ?? []);
const workflowIsArchived = computed(() => workflowDocumentStore?.value?.isArchived ?? false);
const workflowDescription = computed(() => workflowDocumentStore?.value?.description ?? '');
const onWorkflowPage = computed(() => !!(route.meta.nodeView || route.meta.keepWorkflowAlive));

const isEnterprise = computed(
	() => settingsStore.isQueueModeEnabled && settingsStore.isWorkerViewAvailable,
);
const isTelemetryEnabled = computed((): boolean => {
	return settingsStore.isTelemetryEnabled;
});
const showGitHubButton = computed(
	() =>
		!isEnterprise.value &&
		!settingsStore.settings.inE2ETests &&
		!githubButtonHidden.value &&
		isTelemetryEnabled.value,
);

const parentFolderForBreadcrumbs = computed<FolderShortInfo | undefined>(() => {
	const folder = workflowDocumentStore?.value?.parentFolder;
	if (!folder) return undefined;
	return {
		id: folder.id,
		name: folder.name,
		parentFolder: folder.parentFolderId ?? undefined,
	};
});

onBeforeMount(() => {
	pushConnection.initialize();
});

onBeforeUnmount(() => {
	pushConnection.terminate();
});

function hideGithubButton() {
	githubButtonHidden.value = true;
}

async function onWorkflowDeactivated() {
	if (
		settingsStore.isModuleActive('mcp') &&
		workflowDocumentStore?.value?.settings?.availableInMCP
	) {
		try {
			// Fetch the updated workflow to get the latest settings after backend processing
			const updatedWorkflow = await workflowsListStore.fetchWorkflow(workflowId.value);
			workflowDocumentStore?.value?.hydrate(updatedWorkflow);
			toast.showToast({
				title: locale.baseText('mcp.workflowDeactivated.title'),
				message: locale.baseText('mcp.workflowDeactivated.message'),
				type: 'info',
			});
		} catch (error) {
			toast.showError(error, locale.baseText('workflowSettings.showError.fetchSettings.title'));
		}
	}
}
</script>

<template>
	<div :class="$style.container">
		<div
			:class="{
				[$style['main-header']]: true,
				[$style.expanded]: !uiStore.sidebarMenuCollapsed,
				[$style['canvas-only']]: settingsStore.isCanvasOnly,
			}"
		>
			<div v-show="!hideMenuBar && !settingsStore.isCanvasOnly" :class="$style['top-menu']">
				<WorkflowDetails
					v-if="workflowName"
					:id="workflowId"
					:tags="workflowTags"
					:name="workflowName"
					:current-folder="parentFolderForBreadcrumbs"
					:is-archived="workflowIsArchived"
					:description="workflowDescription"
					@workflow:deactivated="onWorkflowDeactivated"
				/>
				<div v-if="showGitHubButton" :class="[$style['github-button'], 'hidden-sm-and-down']">
					<div :class="$style['github-button-container']">
						<GithubButton
							:href="N8N_MAIN_GITHUB_REPO_URL"
							:data-color-scheme="uiStore.appliedTheme"
							data-size="large"
							data-show-count="true"
							:aria-label="locale.baseText('editor.mainHeader.githubButton.label')"
						>
							{{ locale.baseText('generic.star') }}
						</GithubButton>
						<N8nIcon
							:class="$style['close-github-button']"
							icon="circle-x"
							size="medium"
							@click="hideGithubButton"
						/>
					</div>
				</div>
			</div>
			<TripBudgetPill v-if="onWorkflowPage" />
		</div>
	</div>
</template>

<style module lang="scss">
.container {
	display: flex;
	position: relative;
	width: 100%;
	align-items: center;
}

.main-header {
	min-height: var(--navbar--height);
	background-color: var(--color--background--light-3);
	width: 100%;
	box-sizing: border-box;
	border-bottom: var(--border-width) var(--border-style) var(--color--foreground);
}

.canvas-only {
	min-height: 0;
	border-bottom: none;
	background-color: transparent;
}

.top-menu {
	position: relative;
	display: flex;
	height: var(--navbar--height);
	align-items: center;
	font-size: 0.9em;
	font-weight: var(--font-weight--regular);
	overflow-x: auto;
	overflow-y: hidden;
}

.github-button {
	display: flex;
	align-items: center;
	align-self: stretch;
	padding: var(--spacing--5xs) var(--spacing--md);
	background-color: var(--color--background--light-3);
	border-left: var(--border-width) var(--border-style) var(--color--foreground);
}

.close-github-button {
	display: none;
	position: absolute;
	right: 0;
	top: 0;
	transform: translate(50%, -46%);
	color: var(--color--foreground--shade-2);
	background-color: var(--color--background--light-3);
	border-radius: 100%;
	cursor: pointer;

	&:hover {
		color: var(--color--orange-400);
	}
}
.github-button-container {
	position: relative;
}

.github-button:hover .close-github-button {
	display: block;
}

@media (max-width: 1390px) {
	.github-button {
		padding: var(--spacing--5xs) var(--spacing--xs);
	}
}

@media (max-width: 1340px) {
	.github-button {
		border-left: 0;
		padding-left: 0;
	}
}

@media (max-width: 1290px) {
	.github-button {
		display: none;
	}
}
</style>
