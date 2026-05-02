<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import Sidebar from './components/Sidebar.vue';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import '@shared/styles/controls.css';

const route = useRoute();
const auth = useAuthStore();

const showSidebar = computed(() => auth.isLoggedIn && route.path !== '/login');
</script>

<template>
  <div class="admin-shell">
    <template v-if="showSidebar">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </template>
    <router-view v-else />
  </div>
</template>

<style>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--shell);
}
.main-content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>
