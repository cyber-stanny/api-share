import { createRouter, createWebHashHistory } from 'vue-router';

const Students = () => import('./views/Students.vue');
const Whitelist = () => import('./views/Whitelist.vue');
const UsageLog = () => import('./views/UsageLog.vue');
const UsageSummary = () => import('./views/UsageSummary.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/students' },
    { path: '/students', component: Students },
    { path: '/whitelist', component: Whitelist },
    { path: '/usage', component: UsageLog },
    { path: '/usage-summary', component: UsageSummary },
  ],
});

export default router;
