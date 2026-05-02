<script setup lang="ts">
defineProps<{
  visible: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click="onOverlayClick">
      <div class="panel modal-card">
        <h2 v-if="title" class="panel-title">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Teleported overlay — must be global since scoped styles don't follow Teleport */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(45,40,36,.45);
  backdrop-filter: blur(4px);
  z-index: 40;
}
</style>

<style scoped>
.panel { background: var(--surface); border-radius: 12px; }
.modal-card {
  width: min(680px, 100%);
  padding: 24px;
  box-shadow: 0 12px 36px rgba(45,45,45,.06), 0 0 0 1px rgba(45,45,45,.03);
}
.panel-title {
  font: 700 24px var(--serif);
  margin: 0 0 5px;
}
</style>
