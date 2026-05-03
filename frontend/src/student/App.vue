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
