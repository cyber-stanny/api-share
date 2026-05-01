import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const Landing = () => import('./views/Landing.vue');
const Overview = () => import('./views/Overview.vue');
const Guide = () => import('./views/Guide.vue');
const Usage = () => import('./views/Usage.vue');
const Models = () => import('./views/Models.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Landing },
    { path: '/overview', component: Overview },
    { path: '/guide', component: Guide },
    { path: '/usage', component: Usage },
    { path: '/models', component: Models },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.isLoggedIn && to.path !== '/') {
    return '/';
  }
});

export default router;
