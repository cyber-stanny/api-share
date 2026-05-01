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
    <div class="sidebar-header">
      <h1>API Share</h1>
      <button class="logout-btn" @click="auth.logout(); router.push('/login')">退出</button>
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
  </aside>
</template>

<style scoped>
.sidebar {
  width: 216px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  flex: 0 0 auto;
}
.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-header h1 {
  font-size: 18px;
  font-weight: 700;
}
.logout-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 13px;
}
.logout-btn:hover { color: #333; }
.sidebar-nav {
  padding: 12px 0;
}
.nav-item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 20px;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  border-left: 2px solid transparent;
}
.nav-item:hover { background: #f9fafb; }
.nav-item.active {
  color: #4f46e5;
  background: #eef2ff;
  border-left-color: #4f46e5;
  font-weight: 600;
}
</style>
