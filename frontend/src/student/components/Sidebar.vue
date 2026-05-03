<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const props = defineProps<{
  open?: boolean;
}>();

const emit = defineEmits<{
  logout: [];
  close: [];
}>();

const navItems = [
  { path: '/overview', label: '概览' },
  { path: '/guide', label: '接入指导' },
  { path: '/usage', label: '调用量' },
  { path: '/models', label: '模型' },
];

function isActive(path: string) {
  return route.path === path;
}

function navigate(path: string) {
  router.push(path);
  emit('close');
}
</script>

<template>
  <aside class="sidebar" :class="{ open: props.open }">
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
      <button class="nav-item logout" @click="emit('logout')">退出</button>
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
  position: sticky;
  top: 64px;
  height: calc(100vh - 64px);
  overflow-y: auto;
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

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 64px;
    left: 0;
    height: calc(100vh - 64px);
    z-index: 20;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: none;
  }
  .sidebar.open {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
  }
}
</style>
