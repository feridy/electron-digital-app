import { createWebHashHistory, createRouter } from 'vue-router';
import HomePage from '../views/Home.vue';
import Video from '@renderer/views/Video.vue';
import GenerateAudio from '@renderer/views/GenerateAudio.vue';

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
    path: '/video',
    name: 'Video page',
    component: Video,
    meta: {
      title: 'Video page',
      enterActiveClass: 'animate__zoomIn',
      leaveActiveClass: 'animate__zoomOut'
    }
  },
  {
    path: '/generate',
    component: GenerateAudio,
    meta: {
      title: 'Generate Audio Page',
      enterActiveClass: 'animate__zoomIn',
      leaveActiveClass: 'animate__zoomOut'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
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
