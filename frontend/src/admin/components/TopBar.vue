<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function handleLogout() {
  auth.logout();
  router.push('/admin/login');
}
</script>

<template>
  <div class="topbar">
    <div class="brand" @click="router.push('/admin')">
      <div class="brand-mark">A</div>
      <div class="brand-name">API Share</div>
    </div>
    <div class="nav">
      <button @click="router.push('/admin')">管理后台</button>
      <button @click="handleLogout" class="btn-logout">退出</button>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  width: 100%;
  height: 64px;
  padding: 0 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,.78);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
  position: sticky;
  top: 0;
  z-index: 10;
  box-sizing: border-box;
}
.brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.brand-mark {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--primary); color: white;
  display: grid; place-items: center;
  font: 700 14px var(--mono);
}
.brand-name { font: 700 16px var(--serif); }
.nav { display: flex; align-items: center; gap: 18px; color: var(--muted); font-size: 13px; }
.nav button { border: 0; background: transparent; color: inherit; padding: 8px; }
.nav button:hover { color: var(--primary); }
.btn-logout { color: var(--muted) !important; }
.btn-logout:hover { color: var(--danger) !important; }
</style>
