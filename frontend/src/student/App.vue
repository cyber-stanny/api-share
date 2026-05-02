<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
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
      <Sidebar @logout="handleLogout" />
      <main class="main-content">
        <router-view />
      </main>
    </template>
    <router-view v-else />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
  display: flex;
}
.main-content {
  flex: 1;
  overflow: auto;
}
</style>
