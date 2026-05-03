<script setup lang="ts">
import { ref } from 'vue';
import TopBar from './components/TopBar.vue';
import Sidebar from './components/Sidebar.vue';
import LoginModal from './components/LoginModal.vue';
import { useAuthStore } from './stores/auth';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import '@shared/styles/controls.css';

const auth = useAuthStore();
const sidebarOpen = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
</script>

<template>
  <div class="admin-shell">
    <template v-if="auth.isLoggedIn">
      <TopBar @toggle-sidebar="toggleSidebar" />
      <div class="console-body">
        <Sidebar :open="sidebarOpen" @close="sidebarOpen = false" @logout="auth.logout()" />
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
    <LoginModal
      :visible="!auth.isLoggedIn"
    />
  </div>
</template>

<style>
.admin-shell {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--shell);
}
.console-body {
  display: flex;
  flex: 1;
  position: relative;
}
.main-content {
  flex: 1;
  padding: 24px;
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