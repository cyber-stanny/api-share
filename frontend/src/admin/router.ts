import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const Login = () => import('./views/Login.vue');
const Students = () => import('./views/Students.vue');
const Whitelist = () => import('./views/Whitelist.vue');
const UsageLog = () => import('./views/UsageLog.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/students' },
    { path: '/login', component: Login },
    { path: '/students', component: Students },
    { path: '/whitelist', component: Whitelist },
    { path: '/usage', component: UsageLog },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.isLoggedIn && to.path !== '/login') {
    return '/login';
  }
  if (auth.isLoggedIn && to.path === '/login') {
    return '/students';
  }
});

export default router;
