import { createTestingPinia } from '@pinia/testing';
import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { createTestProject } from '../__tests__/utils';
import * as router from 'vue-router';
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';
import ProjectHeader from './ProjectHeader.vue';
import { useProjectsStore } from '../projects.store';
import type { Project, ProjectListItem } from '../projects.types';
import { ProjectTypes } from '../projects.types';
import { EnterpriseEditionFeature, VIEWS } from '@/app/constants';
import userEvent from '@testing-library/user-event';
import { waitFor, within } from '@testing-library/vue';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useProjectPages } from '@/features/collaboration/projects/composables/useProjectPages';
import { useUsersStore } from '@/features/settings/users/users.store';
import { mock } from 'vitest-mock-extended';
import type { IUser } from '@n8n/rest-api-client';

const mockPush = vi.fn();
vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');
	const params = {};
	const location = {};
	return {
		...actual,
		useRouter: () => ({
			push: mockPush,
		}),
		useRoute: () => ({
			params,
			location,
		}),
	};
});

const trackClickedNewAgent = vi.fn();
vi.mock('@/features/agents/composables/useAgentTelemetry', () => ({
	useAgentTelemetry: () => ({
		trackClickedNewAgent,
	}),
}));

vi.mock('@/features/collaboration/projects/composables/useProjectPages', () => ({
	useProjectPages: vi.fn().mockReturnValue({
		isOverviewSubPage: false,
		isSharedSubPage: false,
		isProjectsSubPage: false,
	}),
}));

const ProjectCreateResourceStub = {
	props: {
		actions: Array,
	},
	template: `
		<div>
			<div data-test-id="add-resource"><button role="button"></button></div>
			<slot></slot>
			<button data-test-id="action-credential" @click="$emit('action', 'credential')">Credentials</button>
			<button data-test-id="action-workflow" @click="$emit('action', 'workflow')">Workflow</button>
			<button data-test-id="action-dataTable" @click="$emit('action', 'dataTable')">Data Table</button>
			<button data-test-id="action-agent" @click="$emit('action', 'agent')">Agent</button>
			<div data-test-id="add-resource-actions" >
				<button v-for="action in $props.actions" :key="action.value"></button>
			</div>
		</div>
	`,
};

const renderComponent = createComponentRenderer(ProjectHeader, {
	global: {
		stubs: {
			ProjectCreateResource: ProjectCreateResourceStub,
		},
	},
});

let projectsStore: ReturnType<typeof mockedStore<typeof useProjectsStore>>;
let settingsStore: ReturnType<typeof mockedStore<typeof useSettingsStore>>;
let projectPages: ReturnType<typeof useProjectPages>;
let usersStore: ReturnType<typeof mockedStore<typeof useUsersStore>>;

describe('ProjectHeader', () => {
	beforeEach(() => {
		createTestingPinia();
		projectsStore = mockedStore(useProjectsStore);
		settingsStore = mockedStore(useSettingsStore);
		usersStore = mockedStore(useUsersStore);
		projectPages = useProjectPages();

		projectsStore.teamProjectsLimit = -1;
		settingsStore.settings.folders = { enabled: false };
		settingsStore.isDataTableFeatureEnabled = true;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should not render title icon on overview page', async () => {
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(true);
		const { container } = renderComponent();

		expect(container.querySelector('svg[data-icon=home]')).not.toBeInTheDocument();
	});

	it('should render the correct icon', async () => {
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		const { container, rerender } = renderComponent();

		// We no longer render icon for personal project
		projectsStore.currentProject = { type: ProjectTypes.Personal } as Project;
		await rerender({});
		expect(container.querySelector('svg[data-icon=user]')).not.toBeInTheDocument();

		const projectName = 'My Project';
		projectsStore.currentProject = { name: projectName } as Project;
		await rerender({});
		expect(container.querySelector('svg[data-icon=layers]')).toBeVisible();
	});

	it('Overview: should render the correct title and subtitle', async () => {
		settingsStore.isDataTableFeatureEnabled = false;
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(true);
		const { getByTestId, rerender } = renderComponent();
		const overviewSubtitle = "All the trips you're planning";

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent('My Trips');
		expect(getByTestId('project-subtitle')).toHaveTextContent(overviewSubtitle);
	});

	it('Shared with you: should render the correct title and subtitle', async () => {
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isSharedSubPage', 'get').mockReturnValue(true);
		const { getByTestId, rerender } = renderComponent();
		const sharedSubtitle = 'Workflows and credentials other users have shared with you';

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent('Shared with you');
		expect(getByTestId('project-subtitle')).toHaveTextContent(sharedSubtitle);
	});

	it('Personal: should render the correct title and subtitle', async () => {
		settingsStore.isDataTableFeatureEnabled = false;
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isSharedSubPage', 'get').mockReturnValue(false);
		const { getByTestId, rerender } = renderComponent();
		const personalSubtitle = 'Workflows and credentials owned by you';

		projectsStore.currentProject = { type: ProjectTypes.Personal } as Project;

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent('Personal');
		expect(getByTestId('project-subtitle')).toHaveTextContent(personalSubtitle);
	});

	it('Personal: should render the correct title when currentProject is null but personalProject exists', async () => {
		settingsStore.isDataTableFeatureEnabled = false;
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isSharedSubPage', 'get').mockReturnValue(false);
		const { getByTestId, rerender } = renderComponent();
		const personalSubtitle = 'Workflows and credentials owned by you';

		projectsStore.currentProject = null;
		projectsStore.personalProject = { type: ProjectTypes.Personal } as Project;

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent('Personal');
		expect(getByTestId('project-subtitle')).toHaveTextContent(personalSubtitle);
	});

	it('Team project: should render the correct title and no subtitle if there is no description', async () => {
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isSharedSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isProjectsSubPage', 'get').mockReturnValue(true);
		const { getByTestId, queryByTestId, rerender } = renderComponent();

		const projectName = 'My Project';
		projectsStore.currentProject = { name: projectName } as Project;

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent(projectName);
		expect(queryByTestId('project-subtitle')).not.toBeInTheDocument();
	});

	it('Team project: should render the correct title and subtitle if there is a description', async () => {
		vi.spyOn(projectPages, 'isOverviewSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isSharedSubPage', 'get').mockReturnValue(false);
		vi.spyOn(projectPages, 'isProjectsSubPage', 'get').mockReturnValue(true);
		const { getByTestId, rerender } = renderComponent();

		const projectName = 'My Project';
		const projectDescription = 'This is a team project description';
		projectsStore.currentProject = {
			name: projectName,
			description: projectDescription,
		} as Project;

		await rerender({});

		expect(getByTestId('project-name')).toHaveTextContent(projectName);
		expect(getByTestId('project-subtitle')).toHaveTextContent(projectDescription);
	});

	it('should create a workflow', async () => {
		const project = createTestProject({
			scopes: ['workflow:create'],
		});
		projectsStore.currentProject = project;

		const { getByTestId } = renderComponent();

		await userEvent.click(getByTestId('add-resource-workflow'));

		expect(mockPush).toHaveBeenCalledWith({
			name: VIEWS.NEW_WORKFLOW,
			query: { projectId: project.id },
		});
	});

	describe('new agent telemetry', () => {
		beforeEach(() => {
			settingsStore.isModuleActive = vi.fn().mockImplementation((mod) => mod === 'agents');
			const project = createTestProject({
				scopes: ['workflow:create', 'agent:create'],
			});
			projectsStore.currentProject = project;
			projectsStore.myProjects = [project] as unknown as ProjectListItem[];
		});

		it('tracks source=button when the agent main button is clicked', async () => {
			const { getByTestId } = renderComponent({ props: { mainButton: 'agent' } });

			await userEvent.click(getByTestId('add-resource-agent'));

			expect(trackClickedNewAgent).toHaveBeenCalledTimes(1);
			expect(trackClickedNewAgent).toHaveBeenCalledWith('button');
		});

		it('tracks source=dropdown when the agent action is selected from the dropdown', async () => {
			const { getByTestId } = renderComponent();

			await userEvent.click(within(getByTestId('add-resource')).getByRole('button'));
			await waitFor(() => expect(getByTestId('action-agent')).toBeVisible());
			await userEvent.click(getByTestId('action-agent'));

			expect(trackClickedNewAgent).toHaveBeenCalledTimes(1);
			expect(trackClickedNewAgent).toHaveBeenCalledWith('dropdown');
		});
	});

	describe('dropdown', () => {
		it('should create a credential', async () => {
			const project = createTestProject({
				scopes: ['credential:create'],
			});
			projectsStore.currentProject = project;

			const { getByTestId } = renderComponent();

			await userEvent.click(within(getByTestId('add-resource')).getByRole('button'));

			await waitFor(() => expect(getByTestId('action-credential')).toBeVisible());

			await userEvent.click(getByTestId('action-credential'));

			expect(mockPush).toHaveBeenCalledWith(
				expect.objectContaining({
					name: VIEWS.PROJECTS_CREDENTIALS,
					params: {
						projectId: project.id,
						credentialId: 'create',
					},
				}),
			);
		});
	});

	it('should not render creation button in setting page', async () => {
		projectsStore.currentProject = createTestProject({
			type: ProjectTypes.Personal,
		});
		vi.spyOn(router, 'useRoute').mockReturnValueOnce({
			name: VIEWS.PROJECT_SETTINGS,
		} as RouteLocationNormalizedLoadedGeneric);
		const { queryByTestId } = renderComponent();
		expect(queryByTestId('add-resource-buttons')).not.toBeInTheDocument();
	});

	describe('ProjectCreateResource', () => {
		it('should render menu items', () => {
			const { getByTestId } = renderComponent();
			const actionsContainer = getByTestId('add-resource-actions');
			expect(actionsContainer).toBeInTheDocument();
			expect(actionsContainer.children).toHaveLength(2);
		});

		it('should not render dataTable menu item if data table feature is disabled', () => {
			settingsStore.isDataTableFeatureEnabled = false;
			const { getByTestId } = renderComponent();
			const actionsContainer = getByTestId('add-resource-actions');
			expect(actionsContainer).toBeInTheDocument();
			expect(actionsContainer.children).toHaveLength(1);
		});
	});

	describe('mainButton prop', () => {
		it('should render workflow button as main by default', () => {
			const project = createTestProject({
				scopes: ['workflow:create'],
			});
			projectsStore.currentProject = project;

			const { getByTestId } = renderComponent();

			expect(getByTestId('add-resource-workflow')).toBeInTheDocument();
		});

		it('should render dataTable button as main when mainButton is dataTable', () => {
			const project = createTestProject({
				scopes: ['dataTable:create'],
			});
			projectsStore.currentProject = project;

			const { getByTestId } = renderComponent({ props: { mainButton: 'dataTable' } });

			expect(getByTestId('add-resource-dataTable')).toBeInTheDocument();
		});

		it('should create credential when credential is main button', async () => {
			const project = createTestProject({
				scopes: ['credential:create'],
			});
			projectsStore.currentProject = project;

			const { getByTestId } = renderComponent({ props: { mainButton: 'credential' } });

			await userEvent.click(getByTestId('add-resource-credential'));

			expect(mockPush).toHaveBeenCalledWith(
				expect.objectContaining({
					name: VIEWS.PROJECTS_CREDENTIALS,
					params: {
						projectId: project.id,
						credentialId: 'create',
					},
				}),
			);
		});

		it('should enable variable create button if project scope allows it', () => {
			const project = createTestProject({
				scopes: ['projectVariable:create'],
			});
			projectsStore.currentProject = project;
			settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Variables] = true;

			const { getByTestId } = renderComponent({ props: { mainButton: 'variable' } });

			expect(getByTestId('add-resource-variable')).toBeInTheDocument();
			expect(getByTestId('add-resource-variable')).toBeEnabled();
		});

		it('should enable create variable button if global scope allows it', () => {
			usersStore.currentUser = mock<IUser>({
				globalScopes: ['variable:create'],
			});
			settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Variables] = true;

			const { getByTestId } = renderComponent({ props: { mainButton: 'variable' } });

			expect(getByTestId('add-resource-variable')).toBeInTheDocument();
			expect(getByTestId('add-resource-variable')).toBeEnabled();
		});

		it('should not enable variable create button if no scope allows it', () => {
			const project = createTestProject({
				scopes: [],
			});
			projectsStore.currentProject = project;
			settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Variables] = true;

			const { queryByTestId } = renderComponent({ props: { mainButton: 'variable' } });

			expect(queryByTestId('add-resource-variable')).toBeDisabled();
		});

		it('should disable variable create button if Variables feature is not enabled', () => {
			const project = createTestProject({
				scopes: ['projectVariable:create'],
			});
			projectsStore.currentProject = project;
			settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Variables] = false;

			const { queryByTestId } = renderComponent({ props: { mainButton: 'variable' } });

			expect(queryByTestId('add-resource-variable')).toBeDisabled();
		});

		it('should enable agent create button when project scope allows it', () => {
			settingsStore.isModuleActive = vi.fn().mockImplementation((mod) => mod === 'agents');
			const project = createTestProject({ scopes: ['agent:create'] });
			projectsStore.currentProject = project;
			projectsStore.myProjects = [project] as unknown as ProjectListItem[];

			const { getByTestId } = renderComponent({ props: { mainButton: 'agent' } });

			expect(getByTestId('add-resource-agent')).toBeInTheDocument();
			expect(getByTestId('add-resource-agent')).toBeEnabled();
		});

		it('should disable agent create button when no scope allows it', () => {
			settingsStore.isModuleActive = vi.fn().mockImplementation((mod) => mod === 'agents');
			const project = createTestProject({ scopes: [] });
			projectsStore.currentProject = project;
			projectsStore.myProjects = [project] as unknown as ProjectListItem[];

			const { getByTestId } = renderComponent({ props: { mainButton: 'agent' } });

			expect(getByTestId('add-resource-agent')).toBeDisabled();
		});
	});
});
