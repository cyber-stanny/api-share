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
const navItems = [
  { path: '/overview', label: '概览' },
  { path: '/guide', label: '接入指导' },
  { path: '/usage', label: '调用量' },
  { path: '/models', label: '模型' },
];

function handleLogout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div id="app">
    <TopBar v-if="showTopBar" show-logout @logout="handleLogout">
      <template #nav>
        <button
          v-for="item in navItems"
          :key="item.path"
          :class="{ active: route.path === item.path }"
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </button>
      </template>
    </TopBar>
    <router-view />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}
.active {
  color: var(--primary);
}
</style>
