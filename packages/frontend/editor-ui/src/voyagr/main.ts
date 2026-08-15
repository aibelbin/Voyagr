import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import '@vue-flow/node-resizer/dist/style.css';
import '@n8n/design-system/css/index.scss';

import { i18nInstance } from '@n8n/i18n';
import { IconBodyLoaderKey } from '@n8n/design-system';
import { loadLucideIconBody } from '@n8n/design-system/icons/lucide';

import { GlobalComponentsPlugin } from '@/app/plugins/components';
import { GlobalDirectivesPlugin } from '@/app/plugins/directives';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';

import App from './App.vue';
import { VOYAGR_NODE_TYPES } from './voyagr-nodes';

const app = createApp(App);
const pinia = createPinia();

// n8n's NodeSettings uses useRoute(); provide a minimal in-memory router.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', name: 'voyagr', component: { render: () => null } }],
});

app.provide(IconBodyLoaderKey, loadLucideIconBody);
app.use(pinia);
app.use(router);
app.use(GlobalComponentsPlugin);
app.use(GlobalDirectivesPlugin);
app.use(i18nInstance);

// Register synthetic travel node types so n8n's NodeSettings renders them.
useNodeTypesStore(pinia).setNodeTypes(VOYAGR_NODE_TYPES);

await router.isReady();
app.mount('#app');
