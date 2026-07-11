<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import TopBar from '@shared/components/TopBar.vue';
import Sidebar from './components/Sidebar.vue';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import '@shared/styles/controls.css';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const showSidebar = computed(() => auth.isLoggedIn && route.path !== '/');
const sidebarOpen = ref(false);

const NOTICE_KEY = 'service-sunset-20260831-notice-dismissed';
const showNotice = ref(localStorage.getItem(NOTICE_KEY) !== '1');

function dismissNotice() {
  showNotice.value = false;
  localStorage.setItem(NOTICE_KEY, '1');
}

function handleLogout() {
  sidebarOpen.value = false;
  auth.logout();
  router.push('/');
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
</script>

<template>
  <div id="app">
    <div v-if="showNotice" class="notice-bar">
      <span class="notice-text">
        服务公告：当前提供 DeepSeek 与智谱 GLM 模型。2026 年 8 月 31 日起，本平台 API 将停止供应，请提前迁移。
      </span>
      <button class="notice-close" @click="dismissNotice" aria-label="关闭">&times;</button>
    </div>
    <template v-if="showSidebar">
      <TopBar @toggle-sidebar="toggleSidebar" />
      <div class="console-body">
        <Sidebar :open="sidebarOpen" @close="sidebarOpen = false" @logout="handleLogout" />
        <div
          v-if="sidebarOpen"
          class="sidebar-overlay"
          @click="sidebarOpen = false"
        />
        <main class="main-content">
          <router-view />
        </main>
      </div>
    </template>
    <router-view v-else />
  </div>
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.notice-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #FFF3CD;
  border-bottom: 1px solid #FFE08A;
  color: #856404;
  font-size: 13px;
  line-height: 1.4;
  flex-shrink: 0;
}
.notice-text {
  flex: 1;
  padding: 8px 0;
}
.notice-close {
  border: 0;
  background: transparent;
  color: #856404;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.notice-close:hover {
  background: rgba(133, 100, 4, 0.12);
}
.console-body {
  display: flex;
  flex: 1;
  position: relative;
}
.main-content {
  flex: 1;
  overflow-y: auto;
}
.sidebar-overlay {
  display: none;
}
@media (max-width: 768px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 15;
    backdrop-filter: blur(2px);
  }
}
</style>
