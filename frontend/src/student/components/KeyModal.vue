<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  visible: boolean;
  apiKey: string;
}>();

const emit = defineEmits<{
  close: [];
  copied: [];
}>();

const copied = ref(false);

async function copyKey() {
  try {
    await navigator.clipboard.writeText(props.apiKey);
  } catch {
    const el = document.createElement('textarea');
    el.value = props.apiKey;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  copied.value = true;
  emit('copied');
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="panel modal-card">
        <h2 class="panel-title">保存你的 API Key</h2>
        <p class="panel-sub">完整 Key 只显示这一次。关闭后只能重新生成。</p>
        <div class="saved-key">{{ apiKey }}</div>
        <div class="form-actions">
          <button class="btn" :class="{ success: copied }" @click="copyKey">
            {{ copied ? '已复制 ✓' : '复制 Key' }}
          </button>
          <button class="btn primary" @click="emit('close')">我已保存</button>
        </div>
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
.modal-card { width: min(680px, 100%); padding: 24px; }
.panel { background: var(--surface); border-radius: 12px; }
.panel-title { font: 700 24px var(--serif); margin: 0 0 5px; }
.panel-sub { margin: 0 0 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.saved-key {
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font: 12px/1.6 var(--mono);
  word-break: break-all;
}
.form-actions { display: flex; gap: 12px; margin-top: 20px; }
.btn.success { background: #3DB88B; color: white; border-color: #3DB88B; }
</style>
