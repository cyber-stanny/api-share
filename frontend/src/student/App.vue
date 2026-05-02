<script setup lang="ts">
import { computed } from 'vue';
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

function handleLogout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div id="app">
    <template v-if="showSidebar">
      <TopBar />
      <div class="console-body">
        <Sidebar @logout="handleLogout" />
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
}
.main-content {
  flex: 1;
  overflow-y: auto;
}
</style>
