<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import TopBar from '@shared/components/TopBar.vue';
import '@shared/styles/tokens.css';
import '@shared/styles/base.css';
import '@shared/styles/controls.css';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const showTopBar = computed(() => auth.isLoggedIn && route.path !== '/');

function handleLogout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div id="app">
    <TopBar v-if="showTopBar" show-logout @logout="handleLogout">
      <template #nav>
        <button @click="router.push('/overview')">控制台</button>
      </template>
    </TopBar>
    <router-view />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
