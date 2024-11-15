import './styles/index.scss';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { router } from './routers';
import log from 'electron-log/renderer';
import App from './App.vue';
import 'swiper/css';
import 'core-js/stable';
import 'regenerator-runtime/runtime';

const store = createPinia();

const renderLog = log.scope('Render');

import.meta.env.DEV ? null : Object.assign(console, renderLog);

document.addEventListener('DOMContentLoaded', () => {
  console.log('-------Render Process Run--------');
});

createApp(App).use(router).use(store).mount('#app');
