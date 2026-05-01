<script setup lang="ts">
defineProps<{
  showLogout?: boolean;
}>();

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">A</div>
      <div class="brand-name">API Share</div>
    </div>
    <div class="nav">
      <slot name="nav" />
      <button v-if="showLogout" @click="emit('logout')">退出</button>
    </div>
  </div>
</template>

<style scoped>
.topbar {
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
}
.brand { display: flex; align-items: center; gap: 10px; }
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
</style>
