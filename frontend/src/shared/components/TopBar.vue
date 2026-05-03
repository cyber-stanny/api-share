<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../student/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const emit = defineEmits<{
  'toggle-sidebar': [];
}>();

function handleLogout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div class="topbar">
    <button class="hamburger" @click="emit('toggle-sidebar')">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <div class="brand" @click="router.push('/')">
      <div class="brand-mark">A</div>
      <div class="brand-name">API Share</div>
    </div>
    <div class="nav">
      <button @click="router.push('/')">首页</button>
      <button @click="router.push('/overview')">控制台</button>
      <button v-if="auth.isLoggedIn" @click="handleLogout" class="btn-logout">退出</button>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  width: 100%;
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 16px;
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
.nav { display: flex; align-items: center; gap: 18px; color: var(--muted); font-size: 13px; margin-left: auto; }
.nav button { border: 0; background: transparent; color: inherit; padding: 8px; }
.nav button:hover { color: var(--primary); }
.btn-logout { color: var(--muted) !important; }
.btn-logout:hover { color: var(--danger) !important; }
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  flex-shrink: 0;
}
.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--text);
  border-radius: 1px;
  transition: background 0.2s;
}
.hamburger:hover span {
  background: var(--primary);
}

@media (max-width: 768px) {
  .hamburger {
    display: flex;
  }
  .nav {
    gap: 8px;
  }
  .nav button {
    padding: 6px;
  }
}
</style>
