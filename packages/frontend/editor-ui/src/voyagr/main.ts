import { createApp } from 'vue';
import { createPinia } from 'pinia';

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

import App from './App.vue';

const app = createApp(App);

app.provide(IconBodyLoaderKey, loadLucideIconBody);
app.use(createPinia());
app.use(GlobalComponentsPlugin);
app.use(GlobalDirectivesPlugin);
app.use(i18nInstance);

app.mount('#app');
