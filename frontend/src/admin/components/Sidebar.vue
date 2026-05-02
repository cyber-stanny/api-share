<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navItems = [
  { path: '/students', label: '学生管理' },
  { path: '/whitelist', label: '白名单' },
  { path: '/usage', label: '调用日志' },
];

function isActive(path: string) {
  return route.path === path;
}

function navigate(path: string) {
  router.push(path);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-mark">A</div>
      <div class="brand-name">API Share</div>
    </div>
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        @click="navigate(item.path)"
      >
        {{ item.label }}
      </button>
    </nav>
    <div class="sidebar-footer">
      <button class="nav-item logout" @click="auth.logout(); router.push('/login')">退出</button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  display: grid;
  place-items: center;
  font: 700 14px var(--mono);
}
.brand-name {
  font: 700 16px var(--serif);
}
.sidebar-nav {
  flex: 1;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 20px;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: color .15s, background .15s;
}
.nav-item:hover {
  color: var(--text);
  background: var(--bg);
}
.nav-item.active {
  color: var(--primary);
  background: var(--primary-light);
  border-left-color: var(--primary);
  font-weight: 600;
}
.sidebar-footer {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.logout {
  color: var(--muted);
  font-weight: 400;
}
.logout:hover {
  color: var(--danger);
}
</style>
