import './styles/index.scss';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { router } from './routers';
import log from 'electron-log/renderer';
import App from './App.vue';

const store = createPinia();

createApp(App).use(router).use(store).mount('#app');
const newLog = log.scope('Render');
Object.assign(console, newLog);
document.addEventListener('DOMContentLoaded', () => {
  newLog.info('Renderer Process loaded');
});
