import { createWebHashHistory, createRouter } from 'vue-router';
import HomePage from '@renderer/views/Home.vue';
import VersionPage from '@renderer/views/VersionPage.vue';

const routes = [
  {
    path: '/',
    name: 'Home page',
    component: HomePage,
    meta: {
      title: 'Home page',
      enterActiveClass: 'animate__zoomIn',
      leaveActiveClass: 'animate__zoomOut'
    }
  },
  {
    path: '/version',
    name: 'Version page',
    component: VersionPage,
    meta: {
      title: 'Version page',
      enterActiveClass: 'animate__zoomIn',
      leaveActiveClass: 'animate__zoomOut'
    }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior() {
    // 始终滚动到顶部
    return { top: 0 };
  },
  routes
});

router.beforeEach(async (to, _from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }

  next();
});
