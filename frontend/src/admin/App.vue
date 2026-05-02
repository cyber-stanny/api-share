<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import TopBar from './components/TopBar.vue';
import Sidebar from './components/Sidebar.vue';
import LoginModal from './components/LoginModal.vue';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import '@shared/styles/controls.css';

const auth = useAuthStore();
</script>

<template>
  <div class="admin-shell">
    <template v-if="auth.isLoggedIn">
      <TopBar />
      <div class="console-body">
        <Sidebar />
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
}
.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
</style>
